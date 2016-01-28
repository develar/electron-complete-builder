import * as fs from "fs"
import * as path from "path"
import { DEFAULT_APP_DIR_NAME, installDependencies, log, getElectronVersion, spawn } from "./util"
import { renameFile, readFile, deleteDirectory } from "./promisifed-fs"
import { createKeychain, deleteKeychain, CodeSigningInfo, generateKeychainName, sign } from "./codeSign"
import { all, executeFinally } from "./promise"
import { EventEmitter } from "events"
import packager = require("electron-packager")
import Promise = require("bluebird")
import appDmg = require("appdmg")

export interface PackagerOptions {
  arch?: string

  dist?: boolean
  githubToken?: string

  sign?: string
  platform?: string
  appDir?: string

  projectDir?: string

  cscLink?: string
  cscKeyPassword?: string
}

interface RepositoryInfo {
  url: string
}

interface Metadata {
  repository: string | RepositoryInfo
}

interface DevMetadata extends Metadata {
  build: DevBuildMetadata
}

interface DevBuildMetadata {
  osx: appdmg.Specification
}

interface AppMetadata extends Metadata {
  version: string
  name: string
  description: string
  author: string

  build: BuildMetadata

  windowsPackager: any
}

interface BuildMetadata {
}

function addHandler(emitter: EventEmitter, event: string, handler: Function) {
  emitter.on(event, handler)
}

export function setDefaultOptionValues(options: PackagerOptions) {
  if (options.arch == null) {
    options.arch = "all"
  }
  if (options.platform == null) {
    options.platform = process.platform
  }
}

export class Packager {
  private projectDir: string

  private appDir: string

  private outDir: string
  private distDir: string

  public metadata: AppMetadata
  public devMetadata: DevMetadata

  private isTwoPackageJsonProjectLayoutUsed = true

  private electronVersion: string

  private eventEmitter = new EventEmitter()

  constructor(private options?: PackagerOptions) {
    setDefaultOptionValues(options || {})

    this.projectDir = options.projectDir == null ? process.cwd() : path.resolve(options.projectDir)
    this.appDir = this.computeAppDirectory()
  }

  artifactCreated(handler: (path: string) => void): Packager {
    addHandler(this.eventEmitter, "artifactCreated", handler)
    return this
  }

  private dispatchArtifactCreated(path: string) {
    this.eventEmitter.emit("artifactCreated", path)
  }

  private get isMac(): boolean {
    return this.options.platform === "darwin"
  }

  public get devPackageFile(): string {
    return path.join(this.projectDir, "package.json")
  }

  async build(): Promise<any> {
    const buildPackageFile = this.devPackageFile
    const appPackageFile = this.projectDir === this.appDir ? buildPackageFile : path.join(this.appDir, "package.json")
    await Promise.all(Array.from(new Set([buildPackageFile, appPackageFile]), readFile))
      .then((result: any[]) => {
        this.metadata = result[result.length - 1]
        this.devMetadata = result[0]
        this.checkMetadata(appPackageFile)

        this.electronVersion = getElectronVersion(this.devMetadata, buildPackageFile)
        this.distDir = path.join(this.projectDir, "dist")
        this.outDir = this.computeOutDirectory()
      })

    log("Removing %s", this.outDir)
    await deleteDirectory(this.outDir)

    const cleanupTasks: Array<() => Promise<any>> = []
    return executeFinally(this.doBuild(cleanupTasks), error => all(cleanupTasks.map(it => it())))
  }

  private async doBuild(cleanupTasks: Array<() => Promise<any>>): Promise<any> {
    const isMac = this.isMac
    const archs = isMac ? ["x64"] : (this.options.arch == null || this.options.arch === "all" ? ["ia32", "x64"] : [this.options.arch])
    let codeSigningInfo: CodeSigningInfo = null
    let keychainName: string = null

    for (let arch of archs) {
      await this.installAppDependencies(arch)

      const distPath = path.join(this.outDir, this.metadata.name + (isMac ? ".app" : "-win32-" + arch))
      if (isMac) {
        if (keychainName == null && (this.options.cscLink != null && this.options.cscKeyPassword != null)) {
          keychainName = generateKeychainName()
          cleanupTasks.push(() => deleteKeychain(keychainName))
          await Promise.all([
            this.pack(arch),
            createKeychain(keychainName, this.options.cscLink, this.options.cscKeyPassword)
              .then(it => codeSigningInfo = it)
          ])
        }
        else {
          await this.pack(arch)
        }
        await this.signMac(distPath, codeSigningInfo)
      }
      else {
        await this.pack(arch)
      }

      if (this.options.dist) {
        const distPromise = this.packageInDistributableFormat(arch, distPath)
          .then(path => this.dispatchArtifactCreated(path))
        await (isMac ? Promise.all([
          distPromise,
          this.zipMacApp()
            .then(path => this.dispatchArtifactCreated(path))
        ]) : distPromise)
      }
    }

    return null
  }

  private signMac(distPath: string, codeSigningInfo: CodeSigningInfo): Promise<any> {
    if (codeSigningInfo == null) {
      codeSigningInfo = {cscName: this.options.sign || process.env.CSC_NAME}
    }

    if (codeSigningInfo.cscName == null) {
      log("App is not signed: CSC_LINK or CSC_NAME are not specified")
      return Promise.resolve()
    }
    else {
      log("Signing app")
      return sign(distPath, codeSigningInfo)
    }
  }

  // Auto-detect app/ (two package.json project layout (development and app)) or fallback to use working directory if not explicitly specified
  private computeAppDirectory(): string {
    let customAppPath = this.options.appDir
    let required = true
    if (customAppPath == null) {
      customAppPath = DEFAULT_APP_DIR_NAME
      required = false
    }

    let absoluteAppPath = path.join(this.projectDir, customAppPath)
    try {
      fs.accessSync(absoluteAppPath)
    }
    catch (e) {
      if (required) {
        throw new Error(customAppPath + " doesn't exists, " + e.message)
      }
      else {
        this.isTwoPackageJsonProjectLayoutUsed = false
        return this.projectDir
      }
    }
    return absoluteAppPath
  }

  private computeOutDirectory() {
    let relativeDirectory: string
    if (this.isMac) {
      relativeDirectory = this.metadata.name + "-darwin-x64"
    }
    else {
      relativeDirectory = "win"
    }
    return path.join(this.distDir, relativeDirectory)
  }

  private checkMetadata(appPackageFile: string): void {
    const reportError = (missedFieldName: string) => {
      throw new Error("Please specify '" + missedFieldName + "' in the application package.json ('" + appPackageFile + "')")
    }

    const metadata = this.metadata
    if (metadata.name == null) {
      reportError("name")
    }
    else if (metadata.description == null) {
      reportError("description")
    }
    else if (metadata.version == null) {
      reportError("version")
    }
    else if (metadata.build == null) {
      throw new Error("Please specify 'build' configuration in the application package.json ('" + appPackageFile + "'), at least\n\n" +
          JSON.stringify({
            build: {
              "app-bundle-id": "your.id",
              "app-category-type": "your.app.category.type"
            }
          }, null, "  ") + "\n\n is required.\n")
    }
    else if (metadata.author == null) {
      reportError("author")
    }
  }

  private pack(arch: string) {
    return new Promise((resolve, reject) => {
      packager(Object.assign({
        dir: this.appDir,
        out: this.options.platform === "win32" ? path.join(this.distDir, "win") : this.distDir,
        name: this.metadata.name,
        platform: this.options.platform,
        arch: arch,
        version: this.electronVersion,
        icon: path.join(this.projectDir, "build", "icon"),
        asar: true,
        "app-version": this.metadata.version,
        "build-version": this.metadata.version,
        "version-string": {
          CompanyName: this.metadata.author,
          FileDescription: this.metadata.description,
          FileVersion: this.metadata.version,
          ProductVersion: this.metadata.version,
          ProductName: this.metadata.name,
          InternalName: this.metadata.name,
        }
      }, this.metadata.build), error => error == null ? resolve(null) : reject(error))
    })
  }

  private installAppDependencies(arch: string): Promise<any> {
    if (this.isTwoPackageJsonProjectLayoutUsed) {
      return installDependencies(this.appDir, arch, this.electronVersion)
    }
    else {
      log("Skipping app dependencies installation because dev and app dependencies are not separated")
      return Promise.resolve(null)
    }
  }

  private zipMacApp(): Promise<string> {
    log("Creating ZIP for Squirrel.Mac")
    const appName = this.metadata.name
    // -y param is important - "store symbolic links as the link instead of the referenced file"
    const resultPath = `${appName}-${this.metadata.version}-mac.zip`
    return spawn("zip", ["-ryXq", resultPath, appName + ".app"], {
      cwd: this.outDir,
      stdio: "inherit",
    })
      .thenReturn(this.outDir + "/" + resultPath)
  }

  // returns absolute artifact path
  private packageInDistributableFormat(arch: string, distPath: string): Promise<string> {
    const appName = this.metadata.name
    if (this.options.platform === "win32") {
      return new Promise<any>((resolve, reject) => {
        require("electron-installer-squirrel-windows")(Object.assign({
          name: this.metadata.name,
          path: distPath,
          product_name: this.metadata.name,
          out: path.join(this.outDir, arch),
          version: this.metadata.version,
          description: this.metadata.description,
          authors: this.metadata.author,
          setup_icon: path.join(this.projectDir, "build", "icon.ico"),
        }, this.metadata.windowsPackager || {}), (error: Error) => error == null ? resolve(null) : reject(error))
      })
        .then(() => renameFile(path.join(this.outDir, arch, appName + "Setup.exe"), path.join(this.outDir, appName + "Setup-" + this.metadata.version + ((arch === "x64") ? "-x64" : "") + ".exe")))
    }
    else {
      return new Promise<any>((resolve, reject) => {
        log("Creating DMG")
        const artifactPath = path.join(this.outDir, this.metadata.name + "-" + this.metadata.version + ".dmg")

        const specification: appdmg.Specification = {
          title: this.metadata.name,
          icon: "build/icon.icns",
          "icon-size": 80,
          background: "build/background.png",
          contents: [
            {
              "x": 410, "y": 220, "type": "link", "path": "/Applications"
            },
            {
              "x": 130, "y": 220, "type": "file"
            }
          ]
        }

        const buildMetadata = this.devMetadata.build
        if (buildMetadata != null && buildMetadata.osx != null) {
          Object.assign(specification, buildMetadata.osx)
        }

        if (specification.title == null) {
          specification.title = this.metadata.name
        }

        specification.contents[1].path = distPath

        const emitter = appDmg({
          target: artifactPath,
          basepath: this.projectDir,
          specification: specification
        })
        emitter.on("error", reject)
        emitter.on("finish", resolve)
      })
    }
  }
}