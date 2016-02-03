import * as fs from "fs"
import * as path from "path"
import { DEFAULT_APP_DIR_NAME, installDependencies, log, getElectronVersion, spawn } from "./util"
import { renameFile, parseJsonFile, deleteDirectory, stat } from "./promisifed-fs"
import { createKeychain, deleteKeychain, CodeSigningInfo, generateKeychainName, sign } from "./codeSign"
import { all, executeFinally } from "./promise"
import { EventEmitter } from "events"
import { Promise as BluebirdPromise } from "bluebird"
import { tsAwaiter } from "./awaiter"
import { MetadataProvider, AppMetadata, DevMetadata, InfoRetriever, DevBuildMetadata } from "./repositoryInfo"
import packager = require("electron-packager-tf")

const __awaiter = tsAwaiter
Array.isArray(__awaiter)

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

export class Packager implements MetadataProvider {
  private projectDir: string

  private appDir: string

  private outDir: string

  metadata: AppMetadata
  devMetadata: DevMetadata

  private isTwoPackageJsonProjectLayoutUsed = true

  private electronVersion: string

  private eventEmitter = new EventEmitter()

  constructor(private options?: PackagerOptions, private repositoryInfo: InfoRetriever = null) {
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

  get devPackageFile(): string {
    return path.join(this.projectDir, "package.json")
  }

  async build(): Promise<any> {
    const buildPackageFile = this.devPackageFile
    const appPackageFile = this.projectDir === this.appDir ? buildPackageFile : path.join(this.appDir, "package.json")
    await BluebirdPromise.all(Array.from(new Set([buildPackageFile, appPackageFile]), parseJsonFile))
      .then((result: any[]) => {
        this.metadata = result[result.length - 1]
        this.devMetadata = result[0]
        this.checkMetadata(appPackageFile)

        this.electronVersion = getElectronVersion(this.devMetadata, buildPackageFile)
      })

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

      this.outDir = path.join(this.projectDir, "dist", this.metadata.name + "-" + this.options.platform + "-" + arch)
      log("Removing %s", this.outDir)
      await deleteDirectory(this.outDir)

      const distPath = path.join(this.outDir, this.metadata.name + (isMac ? ".app" : "-win32-" + arch))
      if (isMac) {
        if (keychainName == null && (this.options.cscLink != null && this.options.cscKeyPassword != null)) {
          keychainName = generateKeychainName()
          cleanupTasks.push(() => deleteKeychain(keychainName))
          await BluebirdPromise.all([
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
      else if (this.options.dist && this.options.platform === "win32") {
        const installerOut = this.outDir + "-installer"
        log("Removing %s", installerOut)
        await BluebirdPromise.all([this.pack(arch), deleteDirectory(installerOut)])
      }
      else {
        await this.pack(arch)
      }

      if (this.options.dist && this.options.platform !== "linux") {
        const distPromise = this.packageInDistributableFormat(arch, distPath)
        if (isMac) {
          await BluebirdPromise.all([
            distPromise,
            this.zipMacApp()
              .then(it => this.dispatchArtifactCreated(it))
          ])
        }
        else {
          await distPromise
        }
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
              "app-category-type": "your.app.category.type",
              "iconUrl": "see https://github.com/develar/electron-complete-builder#in-short",
            }
          }, null, "  ") + "\n\n is required.\n")
    }
    else if (metadata.author == null) {
      reportError("author")
    }
  }

  private pack(arch: string) {
    return new BluebirdPromise((resolve, reject) => {
      const version = this.metadata.version
      let buildVersion = version
      const buildNumber = process.env.TRAVIS_BUILD_NUMBER || process.env.APPVEYOR_BUILD_NUMBER || process.env.CIRCLE_BUILD_NUM
      if (buildNumber != null) {
        buildVersion += "." + buildNumber
      }

      const options = Object.assign({
        dir: this.appDir,
        out: path.dirname(this.outDir),
        name: this.metadata.name,
        platform: this.options.platform,
        arch: arch,
        version: this.electronVersion,
        icon: path.join(this.projectDir, "build", "icon"),
        asar: true,
        "app-version": version,
        "build-version": buildVersion,
        "version-string": {
          CompanyName: this.metadata.author,
          FileDescription: this.metadata.description,
          ProductVersion: version,
          FileVersion: buildVersion,
          ProductName: this.metadata.name,
          InternalName: this.metadata.name,
        }
      }, this.metadata.build, {"use-temp-dir": false})

      // this option only for windows-installer
      delete options.iconUrl
      packager(options, error => error == null ? resolve(null) : reject(error))
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

  private async packageInDistributableFormat(arch: string, distPath: string): Promise<any> {
    const buildMetadata = this.devMetadata.build
    if (this.options.platform === "win32") {
      return this.packageWinInDistributableFormat(buildMetadata, arch)
    }
    else {
      return this.packageMacInDistributableFormat(buildMetadata, distPath)
    }
  }

  private async packageWinInDistributableFormat(buildMetadata: DevBuildMetadata, arch: string): Promise<any> {
    const customOptions = buildMetadata == null ? null : buildMetadata.win
    let iconUrl = this.metadata.build.iconUrl
    if (!iconUrl) {
      if (customOptions != null) {
        iconUrl = customOptions.iconUrl
      }
      if (!iconUrl) {
        if (this.repositoryInfo != null) {
          const info = await this.repositoryInfo.getInfo(this)
          if (info != null) {
            iconUrl = `https://raw.githubusercontent.com/${info.user}/${info.project}/master/build/icon.ico`
          }
        }

        if (!iconUrl) {
          throw new Error("iconUrl is not specified, please see https://github.com/develar/electron-complete-builder#in-short")
        }
      }
    }

    const version = this.metadata.version
    const outputDirectory = this.outDir + "-installer"
    const options = Object.assign({
      name: this.metadata.name,
      appDirectory: this.outDir,
      outputDirectory: outputDirectory,
      productName: this.metadata.name,
      version: version,
      description: this.metadata.description,
      authors: this.metadata.author,
      iconUrl: iconUrl,
      setupIcon: path.join(this.projectDir, "build", "icon.ico"),
    }, customOptions)

    try {
      await new BluebirdPromise<any>((resolve, reject) => {
        require("electron-winstaller-temp-fork").build(options, (error: Error) => error == null ? resolve(null) : reject(error))
      })
    }
    catch (e) {
      if (e.message.indexOf("Unable to set icon") < 0) {
        throw e
      }
      else {
        let fileInfo: fs.Stats
        try {
          fileInfo = await stat(options.setupIcon)
        }
        catch (e) {
          throw new Error("Please specify correct setupIcon, file " + options.setupIcon + " not found")
        }

        if (fileInfo.isDirectory()) {
          throw new Error("Please specify correct setupIcon, " + options.setupIcon + " is a directory")
        }
      }
    }

    const appName = this.metadata.name
    const archSuffix = (arch === "x64") ? "-x64" : ""
    return Promise.all([
      renameFile(path.join(outputDirectory, appName + "Setup.exe"), path.join(outputDirectory, appName + "Setup-" + version + archSuffix + ".exe"))
        .then(it => this.dispatchArtifactCreated(it)),
      renameFile(path.join(outputDirectory, appName + "-" + version + "-full.nupkg"), path.join(outputDirectory, appName + "-" + version + archSuffix + "-full.nupkg"))
        .then(it => this.dispatchArtifactCreated(it))
    ])
  }

  private packageMacInDistributableFormat(buildMetadata: DevBuildMetadata, distPath: string): Promise<any> {
    const artifactPath = path.join(this.outDir, this.metadata.name + "-" + this.metadata.version + ".dmg")
    return new BluebirdPromise<any>((resolve, reject) => {
      log("Creating DMG")

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

      if (buildMetadata != null && buildMetadata.osx != null) {
        Object.assign(specification, buildMetadata.osx)
      }

      if (specification.title == null) {
        specification.title = this.metadata.name
      }

      specification.contents[1].path = distPath

      const appDmg = require("appdmg")
      const emitter = appDmg({
        target: artifactPath,
        basepath: this.projectDir,
        specification: specification
      })
      emitter.on("error", reject)
      emitter.on("finish", () => resolve())
    })
      .then(() => this.dispatchArtifactCreated(artifactPath))
  }
}