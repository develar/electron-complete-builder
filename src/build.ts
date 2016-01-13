#! /usr/bin/env node

import * as fs from "fs"
import * as path from "path"
import { DEFAULT_APP_DIR_NAME, reportResult, packageJson, commonArgs, readPackageJson, installDependencies } from "./util"

const packager = require("electron-packager")

let isTwoPackageJsonProjectLayoutUsed = true

interface AppArgs {
  arch: string
  build: boolean
  sign?: string
  platform: string
  appDir?: string
}

const args: AppArgs = require("command-line-args")(commonArgs.concat(
  {name: "arch", type: String, defaultValue: "all"},
  {name: "build", type: Boolean, defaultValue: false},
  {name: "sign", type: String},
  {name: "platform", type: String, defaultValue: process.platform}
)).parse()

const appDir = computeAppDirectory()
const appPackageJsonFile = path.join(appDir, "package.json")
const appPackageJson = readPackageJson(appPackageJsonFile)
checkMetadata()

const version = appPackageJson.version

const arch = args.platform === "darwin" ? ["x64"] : (args.arch == null || args.arch === "all" ? ["ia32", "x64"] : [args.arch])
let currentArchIndex = 0

const distDir = path.join(process.cwd(), "dist")
const outDir = computeOutDirectory()

console.log("Removing %s", outDir)
require("rimraf").sync(outDir)

pack()

function pack() {
  const currentArch = arch[currentArchIndex]
  if (isTwoPackageJsonProjectLayoutUsed) {
    installDependencies(currentArch)
  }
  else {
    console.log("Skipping app dependencies installation because dev and app dependencies are not separated")
  }

  packager(Object.assign(appPackageJson.build || {}, {
    dir: appDir,
    out: args.platform === "win32" ? path.join(distDir, "win") : distDir,
    name: appPackageJson.name,
    platform: args.platform,
    arch: currentArch,
    version: packageJson.devDependencies["electron-prebuilt"].substring(1),
    icon: path.join(process.cwd(), "build", "icon"),
    asar: true,
    "app-version": version,
    "build-version": version,
    sign: args.sign,
    "version-string": {
      CompanyName: appPackageJson.authors,
      FileDescription: appPackageJson.description,
      FileVersion: version,
      ProductVersion: version,
      ProductName: appPackageJson.name,
      InternalName: appPackageJson.name,
    }
  }), function (error: any) {
    if (error != null) {
      throw new Error(error)
    }

    currentArchIndex++
    if (args.build) {
      build(currentArch, currentArchIndex < arch.length ? function () {
        pack()
      } : null)
    }
    else if (currentArchIndex < arch.length) {
      pack()
    }
  })
}

function build(arch: string, doneHandler: () => void) {
  const appName = appPackageJson.name
  const appPath = path.join(outDir, appName + (args.platform === "darwin" ? ".app" : "-win32-" + arch))

  const callback = function(error: any) {
    if (error != null) {
      //noinspection JSClosureCompilerSyntax
      throw new Error(error)
    }

    if (args.platform === "darwin") {
      fs.renameSync(path.join(outDir, appName + ".dmg"), path.join(outDir, appName + "-" + version + ".dmg"))
      const spawnSync = require("child_process").spawnSync
      reportResult(spawnSync("zip", ["-ryX", `${outDir}/${appName}-${version}-mac.zip`, appName + ".app"], {
        cwd: outDir,
        stdio: "inherit",
      }))
    }
    else {
      fs.renameSync(path.join(outDir, arch, appName + "Setup.exe"), path.join(outDir, appName + "Setup-" + version + ((arch === "x64") ? "-x64" : "") + ".exe"))
    }

    if (doneHandler != null) {
      doneHandler()
    }
  }

  if (args.platform === "darwin") {
    require("electron-builder").init().build({
      "appPath": appPath,
      "platform": args.platform === "darwin" ? "osx" : (args.platform == "win32" ? "win" : args.platform),
      "out": outDir,
      "config": path.join(process.cwd(), "build", "packager.json"),
    }, callback)
  }
  else {
    require('electron-installer-squirrel-windows')({
      name: appPackageJson.name,
      path: appPath,
      product_name: appPackageJson.name,
      out: path.join(outDir, arch),
      version: version,
      description: appPackageJson.description,
      authors: appPackageJson.author,
      setup_icon: path.join(process.cwd(), "build", "icon.ico"),
    }, callback)
  }
}

// Auto-detect app/ (two package.json project layout (development and app)) or fallback to use working directory if not explicitly specified
function computeAppDirectory() {
  let customAppPath = args.appDir
  let required = true
  if (customAppPath == null) {
    customAppPath = DEFAULT_APP_DIR_NAME
    required = false
  }

  let absoluteAppPath = path.normalize(path.join(process.cwd(), customAppPath))
  try {
    fs.accessSync(absoluteAppPath)
  }
  catch (e) {
    if (required) {
      throw new Error(customAppPath + " doesn't exists, " + e.message)
    }
    else {
      isTwoPackageJsonProjectLayoutUsed = false
      return process.cwd()
    }
  }
  return absoluteAppPath
}

function computeOutDirectory() {
  let relativeDirectory: string
  if (args.platform === "darwin") {
    relativeDirectory = appPackageJson.name + "-darwin-x64"
  }
  else {
    relativeDirectory = "win"
  }
  return path.join(distDir, relativeDirectory)
}

function checkMetadata() {
  function error(missedFieldName: string) {
    throw new Error("Please specify '" + missedFieldName + "' in the application package.json ('" + appPackageJsonFile + "')")
  }

  if (appPackageJson.name == null) {
    error("name")
  }
  else if (appPackageJson.description == null) {
    error("description")
  }
  else if (appPackageJson.version == null) {
    error("version")
  }
  else if (appPackageJson.build == null) {
    throw new Error("Please specify 'build' configuration in the application package.json ('" + appPackageJsonFile + "'), at least\n\n" +
        '\t"build": {\n' +
        '\t  "app-bundle-id": "your.id",\n' +
        '\t  "app-category-type": "your.app.category.type"\n'
        + '\t}' + "\n\n is required.\n")
  }
  else if (appPackageJson.author == null) {
    error("author")
  }
}