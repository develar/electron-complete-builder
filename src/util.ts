"use strict"

const fs = require("fs")
const path = require("path")
const series = require("run-series")
const parallel = require("run-parallel")
const merge = require("merge")

export const packageJson = readPackageJson(path.join(process.cwd(), "package.json"))

export const DEFAULT_APP_DIR_NAME = "app"

export const commonArgs: any[] = [
  {
    name: "appDir",
    type: String,
    description: "Relative (to the working directory) path to the folder containing the application package.json. Working directory or app/ by default."
  }
]

export function reportResult(result: any) {
  if (result.status != 0) {
    if (result.error != null) {
      console.error(result.error)
    }
    process.exit(result.status)
  }
}

export function readPackageJson(path: string) {
  try {
    return JSON.parse(fs.readFileSync(path))
  }
  catch (e) {
    if (e instanceof SyntaxError) {
      console.error(path + " is not a valid JSON file")
    }
    throw e
  }
}

export function installDependencies(arch: string, appDir?: string) {
  if (appDir == null) {
    appDir = DEFAULT_APP_DIR_NAME
  }

  const processWorkingDirectory = path.join(process.cwd(), appDir)
  console.log("Installing production dependencies for arch " + (arch || process.arch) + " to " + processWorkingDirectory)

  const electronPrebuiltDep = packageJson.devDependencies["electron-prebuilt"]
  if (electronPrebuiltDep == null) {
    throw new Error("Cannot find electron-prebuilt dependency to get electron version")
  }

  const env = merge(process.env, {
    npm_config_disturl: "https://atom.io/download/atom-shell",
    npm_config_target: electronPrebuiltDep.substring(1),
    npm_config_runtime: "electron",
    HOME: require("os").homedir() + "/.electron-gyp",
  })

  if (arch != null) {
    env.npm_config_arch = arch
  }

  let npmExecPath = process.env.npm_execpath || process.env.NPM_CLI_JS
  let npmExecArgs = ["install"]
  if (npmExecPath == null) {
    npmExecPath = "npm"
  }
  else {
    npmExecArgs.unshift(npmExecPath)
    npmExecPath = (process.env.npm_node_execpath || process.env.NODE_EXE || process.env.NODE_EXE || "node")
  }
  reportResult(require("child_process").spawnSync(npmExecPath, npmExecArgs, {
    cwd: processWorkingDirectory,
    stdio: "inherit",
    env: env
  }))
}

export function parallelTask(...tasks: ((error?: any) => void)[]) {
  return parallel.bind(null, tasks)
}

export function seriesTask(...tasks: ((error?: any) => void)[]) {
  return series.bind(null, tasks)
}

// typescript cannot infer function parameters type if use push directly
function createTasks(...callbacks: ((error?: any) => void)[]) {
  return callbacks
}

// typescript cannot infer function parameters type if use push directly
function addTasks(target: Array<((callback: (error: any, result: any) => void) => void)>, ...tasks: ((error?: any) => void)[]): void {
  target.push.apply(target, tasks)
}

function task(dependencies: string[], task: (callback: (error?: any) => void) => void): Array<((callback: (error: any, result: any) => void) => void) | string> {
  if (dependencies == null) {
    return [task]
  }

  const result = Array<any>(dependencies.length + 1)
  result.push.apply(result, dependencies)
  result.push(task)
  return result
}