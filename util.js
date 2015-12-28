"use strict"

const path = require("path")
const packageJson = JSON.parse(require("fs").readFileSync(path.join(process.cwd(), "package.json")))

const DEFAULT_APP_DIR_NAME = "app"

function reportResult(result) {
  if (result.status != 0) {
    console.log(result)
  }
}

exports.installDependencies = function (arch, appDir) {
  if (appDir == null) {
    appDir = "app"
  }

  const electronPrebuiltDep = packageJson.devDependencies["electron-prebuilt"]
  if (electronPrebuiltDep == null) {
    throw new Error("Cannot find electron-prebuilt dependency to get electron version")
  }

  const env = Object.assign(process.env, {
    npm_config_disturl: "https://atom.io/download/atom-shell",
    npm_config_target: electronPrebuiltDep.substring(1),
    npm_config_runtime: "electron",
    HOME: require("os").homedir() + "/.electron-gyp",
  })

  if (arch != null) {
    env.npm_config_arch = arch
  }

  const processWorkingDirectory = path.join(process.cwd(), appDir)
  console.log("Installing production dependencies to " + processWorkingDirectory)
  reportResult(require("child_process").spawnSync(process.platform === "win32" ? "C:\\Program Files\\nodejs\\npm.cmd" : "npm", ["install"], {
    cwd: processWorkingDirectory,
    stdio: "inherit",
    env: env
  }))
}

exports.reportResult = reportResult
exports.packageJson = packageJson
exports.DEFAULT_APP_DIR_NAME = DEFAULT_APP_DIR_NAME