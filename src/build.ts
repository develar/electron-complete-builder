import * as fs from "fs"
import * as path from "path"
import {
  DEFAULT_APP_DIR_NAME,
  packageJson,
  readPackageJson,
  installDependencies,
  parallelTask,
  addTasks,
  handler
} from "./util"
import { spawn, execFile } from "child_process"
import { createKeychain, deleteKeychain, CodeSigningInfo } from "./codeSign"

const merge = require("merge")

const packager = require("electron-packager")
const series = require("run-series")
const parallel = require("run-parallel")

export interface Options {
  arch?: string

  dist?: boolean

  sign?: string
  platform?: string
  appDir?: string
}

interface AppMetadata {
  version: string
  name: string
  description: string
  author: string

  build: BuildMetadata

  windowsPackager: any
  darwinPackager: any
}

interface BuildMetadata {

}

export function setDefaultOptionValues(options: Options) {
  if (options.arch == null) {
    options.arch = "all"
  }
  if (options.platform == null) {
    options.platform = process.platform
  }
}

export class Packager {
  private appDir: string
  private appPackageFile: string

  private outDir: string
  private distDir: string

  private metadata: AppMetadata

  private isTwoPackageJsonProjectLayoutUsed = true

  constructor(private options: Options = {}) {
    setDefaultOptionValues(options)

    this.appDir = this.computeAppDirectory()
    this.appPackageFile = path.join(this.appDir, "package.json")
    this.metadata = readPackageJson(this.appPackageFile)
    this.checkMetadata()

    this.distDir = path.join(process.cwd(), "dist")
    this.outDir = this.computeOutDirectory()

    console.log("Removing %s", this.outDir)
    require("rimraf").sync(this.outDir)

    const tasks: Array<((callback: (error: any, result: any) => void) => void)> = []
    const cleanupTasks: Array<((callback: (error: any, result: any) => void) => void)> = []

    const isMac = this.isMac
    let keychainTaskAdded = false
    let codeSigningInfo: CodeSigningInfo = null
    const archs = isMac ? ["x64"] : (options.arch == null || options.arch === "all" ? ["ia32", "x64"] : [options.arch])
    for (let arch of archs) {
      const distPath = path.join(this.outDir, this.metadata.name + (isMac ? ".app" : "-win32-" + arch))
      if (process.env.CSC_LINK != null && process.env.CSC_KEY_PASSWORD != null) {
        // set macCscName to null - we sign app ourselves
        const packTask = this.pack.bind(this, arch, null)
        if (keychainTaskAdded) {
          tasks.push(packTask)
        }
        else {
          keychainTaskAdded = true
          tasks.push(parallelTask(packTask, (callback) => {
            createKeychain(handler(callback, (result: CodeSigningInfo) => { codeSigningInfo = result }))
          }))
          cleanupTasks.push(deleteKeychain)
        }

        addTasks(tasks, (callback) => {
          console.log("Signing app")
          execFile("codesign", ["--deep", "--force", "--sign", codeSigningInfo.cscName, distPath, "--keychain", codeSigningInfo.cscKeychainName], callback)
        })
      }
      else {
        tasks.push(this.pack.bind(this, arch, this.options.sign || process.env.CSC_NAME))
      }

      if (options.dist) {
        const distTask = this.packageInDistributableFormat.bind(this, arch, distPath)
        if (isMac) {
          tasks.push(parallelTask(distTask, this.zipMacApp.bind(this)))
        }
        else {
          tasks.push(distTask)
        }
        tasks.push(this.adjustDistLayout.bind(this, arch))
      }
    }

    series(tasks, (error: any) => {
      parallel(cleanupTasks, (cleanupError: any) => {
        if (error == null) {
          error = cleanupError
        }

        if (error != null) {
          if (typeof error === "string") {
            console.error(error)
          }
          else if (error.message == null) {
            console.error(error, error.stack)
          }
          else {
            console.error(error.message)
          }

          process.exit(1)
        }
      })
    })
  }

  private get isMac(): boolean {
    return this.options.platform === "darwin"
  }

  // Auto-detect app/ (two package.json project layout (development and app)) or fallback to use working directory if not explicitly specified
  private computeAppDirectory(): string {
    let customAppPath = this.options.appDir
    let required = true
    if (customAppPath == null) {
      customAppPath = DEFAULT_APP_DIR_NAME
      required = false
    }

    let absoluteAppPath = path.join(process.cwd(), customAppPath)
    try {
      fs.accessSync(absoluteAppPath)
    }
    catch (e) {
      if (required) {
        throw new Error(customAppPath + " doesn't exists, " + e.message)
      }
      else {
        this.isTwoPackageJsonProjectLayoutUsed = false
        return process.cwd()
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

  private checkMetadata(): void {
    const reportError = (missedFieldName: string) => {
      throw new Error("Please specify '" + missedFieldName + "' in the application package.json ('" + this.appPackageFile + "')")
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
      throw new Error("Please specify 'build' configuration in the application package.json ('" + this.appPackageFile + "'), at least\n\n" +
        '\t"build": {\n' +
        '\t  "app-bundle-id": "your.id",\n' +
        '\t  "app-category-type": "your.app.category.type"\n'
        + '\t}' + "\n\n is required.\n")
    }
    else if (metadata.author == null) {
      reportError("author")
    }
  }

  private pack(arch: string, macCscName: string, callback: (error: any, result: any) => void) {
    if (this.isTwoPackageJsonProjectLayoutUsed) {
      installDependencies(arch)
    }
    else {
      console.log("Skipping app dependencies installation because dev and app dependencies are not separated")
    }

    packager(merge({
      dir: this.appDir,
      out: this.options.platform === "win32" ? path.join(this.distDir, "win") : this.distDir,
      name: this.metadata.name,
      platform: this.options.platform,
      arch: arch,
      version: packageJson.devDependencies["electron-prebuilt"].substring(1),
      icon: path.join(process.cwd(), "build", "icon"),
      asar: true,
      "app-version": this.metadata.version,
      "build-version": this.metadata.version,
      sign: macCscName,
      "version-string": {
        CompanyName: this.metadata.author,
        FileDescription: this.metadata.description,
        FileVersion: this.metadata.version,
        ProductVersion: this.metadata.version,
        ProductName: this.metadata.name,
        InternalName: this.metadata.name,
      }
    }, this.metadata.build), callback)
  }

  private zipMacApp(callback: (error?: any, result?: any) => void) {
    console.log("Zipping app")
    const appName = this.metadata.name
    // -y param is important - "store symbolic links as the link instead of the referenced file"
    spawn("zip", ["-ryXq", `${this.outDir}/${appName}-${this.metadata.version}-mac.zip`, appName + ".app"], {
      cwd: this.outDir,
      stdio: "inherit",
    })
      .on("close", (exitCode: number) => {
        console.log("Finished zipping app")
        callback(exitCode === 0 ? null : "Failed, exit code " + exitCode)
      })
  }


  private packageInDistributableFormat(arch: string, distPath: string, callback: (error: any, result: any) => void) {
    if (this.options.platform == "win32") {
      require('electron-installer-squirrel-windows')(merge({
        name: this.metadata.name,
        path: distPath,
        product_name: this.metadata.name,
        out: path.join(this.outDir, arch),
        version: this.metadata.version,
        description: this.metadata.description,
        authors: this.metadata.author,
        setup_icon: path.join(process.cwd(), "build", "icon.ico"),
      }, this.metadata.windowsPackager || {}), callback)
    }
    else {
      require("electron-builder").init().build(merge({
        "appPath": distPath,
        "platform": this.isMac ? "osx" : this.options.platform,
        "out": this.outDir,
        "config": path.join(process.cwd(), "build", "packager.json"),
      }, this.metadata.darwinPackager || {}), callback)
    }
  }

  private adjustDistLayout(arch: string, callback: (error?: any, result?: any) => void) {
    const appName = this.metadata.name
    if (this.options.platform === "darwin") {
      fs.rename(path.join(this.outDir, appName + ".dmg"), path.join(this.outDir, appName + "-" + this.metadata.version + ".dmg"), callback)
    }
    else {
      fs.rename(path.join(this.outDir, arch, appName + "Setup.exe"), path.join(this.outDir, appName + "Setup-" + this.metadata.version + ((arch === "x64") ? "-x64" : "") + ".exe"), callback)
    }
  }
}