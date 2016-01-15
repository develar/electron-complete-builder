#! /usr/bin/env node

import * as fs from "fs"
import * as path from "path"
import { DEFAULT_APP_DIR_NAME, packageJson, commonArgs, readPackageJson, installDependencies } from "./util"
import { spawn } from "child_process"
import { createKeychain } from "./codeSign"
const merge = require("merge")

const packager = require("electron-packager")
const series = require("run-series")
const parallel = require("run-parallel")
const auto = require("run-auto")

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

const distDir = path.join(process.cwd(), "dist")
const outDir = computeOutDirectory()

console.log("Removing %s", outDir)
require("rimraf").sync(outDir)

const tasks: Array<((callback: (error: any, result: any) => void) => void)> = []

if (process.env.CSC_LINK != null && process.env.CSC_KEY_PASSWORD != null) {
  tasks.push(createKeychain)
}

for (let arch of args.platform === "darwin" ? ["x64"] : (args.arch == null || args.arch === "all" ? ["ia32", "x64"] : [args.arch])) {
  tasks.push(pack.bind(null, arch))
  if (args.build) {
    const distPath = path.join(outDir, appPackageJson.name + (args.platform === "darwin" ? ".app" : "-win32-" + arch))
    const buildTask = build.bind(null, arch, distPath)
    if (args.platform === "darwin") {
      tasks.push((callback: () => void) => {
        //noinspection JSReferencingMutableVariableFromClosure
        parallel([buildTask, zipMacApp], callback)
      })
    }
    else {
      tasks.push(buildTask)
    }
    tasks.push(adjustDistLayout.bind(null, arch))
  }
}

series(tasks, (error: any) => {
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

function zipMacApp(callback: (error?: any, result?: any) => void) {
  console.log("Zipping app")
  const appName = appPackageJson.name
  // -y param is important - "store symbolic links as the link instead of the referenced file"
  spawn("zip", ["-ryXq", `${outDir}/${appName}-${version}-mac.zip`, appName + ".app"], {
    cwd: outDir,
    stdio: "inherit",
  })
    .on("close", (exitCode: number) => {
      console.log("Finished zipping app")
      callback(exitCode === 0 ? null : "Failed, exit code " + exitCode)
    })
}

function adjustDistLayout(arch: string, callback: (error?: any, result?: any) => void) {
  const appName = appPackageJson.name
  if (args.platform === "darwin") {
    fs.rename(path.join(outDir, appName + ".dmg"), path.join(outDir, appName + "-" + version + ".dmg"), callback)
  }
  else {
    fs.rename(path.join(outDir, arch, appName + "Setup.exe"), path.join(outDir, appName + "Setup-" + version + ((arch === "x64") ? "-x64" : "") + ".exe"), callback)
  }
}

function pack(arch: string, callback: (error: any, result: any) => void) {
  if (isTwoPackageJsonProjectLayoutUsed) {
    installDependencies(arch)
  }
  else {
    console.log("Skipping app dependencies installation because dev and app dependencies are not separated")
  }

  packager(merge(appPackageJson.build || {}, {
    dir: appDir,
    out: args.platform === "win32" ? path.join(distDir, "win") : distDir,
    name: appPackageJson.name,
    platform: args.platform,
    arch: arch,
    version: packageJson.devDependencies["electron-prebuilt"].substring(1),
    icon: path.join(process.cwd(), "build", "icon"),
    asar: true,
    "app-version": version,
    "build-version": version,
    sign: args.sign || process.env.CSC_NAME,
    "version-string": {
      CompanyName: appPackageJson.authors,
      FileDescription: appPackageJson.description,
      FileVersion: version,
      ProductVersion: version,
      ProductName: appPackageJson.name,
      InternalName: appPackageJson.name,
    }
  }), callback)
}

function build(arch: string, distPath: string, callback: (error: any, result: any) => void) {
  if (args.platform === "darwin") {
    require("electron-builder").init().build({
      "appPath": distPath,
      "platform": args.platform === "darwin" ? "osx" : (args.platform == "win32" ? "win" : args.platform),
      "out": outDir,
      "config": path.join(process.cwd(), "build", "packager.json"),
    }, callback)
  }
  else {
    require('electron-installer-squirrel-windows')({
      name: appPackageJson.name,
      path: distPath,
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