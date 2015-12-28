#! /usr/bin/env node

"use strict"

const fs = require("fs")
const path = require("path")
const util = require("../main")
const packager = require("electron-packager")

const args = require("command-line-args")(util.commonArgs.concat(
  {name: "arch", type: String, defaultValue: "all"},
  {name: "build", type: Boolean, defaultValue: false},
  {name: "sign", type: String},
  {name: "platform", type: String, defaultValue: process.platform}
)).parse()

const appPackageJsonFile = path.normalize(path.join(process.cwd(), args.appDir, "package.json"))
const appPackageJson = util.readPackageJson(appPackageJsonFile)
checkMetadata()

const version = appPackageJson.version

const arch = args.platform == "darwin" ? ["x64"] : (args.arch == null || args.arch === "all" ? ["ia32", "x64"] : [args.arch])
let currentArchIndex = 0

const distDir = path.join(process.cwd(), "dist")
const outDir = computeOutDirectory()

console.log("Removing " + outDir)
require("rimraf").sync(outDir)

pack()

function computeOutDirectory() {
  let relativeDirectory
  if (args.platform === "darwin") {
    relativeDirectory = appPackageJson.name + "-darwin-x64"
  }
  else {
    relativeDirectory = "win"
  }
  return path.join(distDir, relativeDirectory)
}

function checkMetadata() {
  function error(missedFieldName) {
    throw new Error("Please specify " + missedFieldName + " in the application package.json ('" + appPackageJsonFile + "')")
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
    error("build")
  }
  else if (appPackageJson.author == null) {
    error("author")
  }
}

function pack() {
  const currentArch = arch[currentArchIndex]
  console.log("Installing dependencies for arch " + currentArch)
  util.installDependencies(currentArch)

  packager(Object.assign(appPackageJson.build || {}, {
    dir: "app",
    out: args.platform === "win32" ? path.join(distDir, "win") : distDir,
    name: appPackageJson.name,
    platform: args.platform,
    arch: currentArch,
    version: util.packageJson.devDependencies["electron-prebuilt"].substring(1),
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
  }), function (error) {
    if (error != null) {
      //noinspection JSClosureCompilerSyntax
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

function build(arch, doneHandler) {
  const appName = appPackageJson.name
  const appPath = path.join(outDir, appName + (args.platform === "darwin" ? ".app" : "-win32-" + arch))

  const callback = function(error) {
    if (error != null) {
      //noinspection JSClosureCompilerSyntax
      throw new Error(error)
    }

    if (args.platform === "darwin") {
      fs.renameSync(path.join(outDir, appName + ".dmg"), path.join(outDir, appName + "-" + version + ".dmg"))
      const spawnSync = require("child_process").spawnSync
      util.reportResult(spawnSync("zip", ["-ryX", `${outDir}/${appName}-${version}-mac.zip`, appName + ".app"], {
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