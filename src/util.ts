import * as fs from "fs"
import { execFile } from "child_process"
import "source-map-support/register"
import Promise = require("bluebird")
import rimraf = require("rimraf")

export const log = console.log

export const DEFAULT_APP_DIR_NAME = "app"

export const commonArgs: any[] = [
  {
    name: "appDir",
    type: String,
    description: "Relative (to the working directory) path to the folder containing the application package.json. Working directory or app/ by default."
  }
]

export function parseJson(data: string, path: string): any {
  try {
    return JSON.parse(data)
  }
  catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error("Cannot parse '" + path + "': " + e.message)
    }
    else {
      throw e
    }
  }
}

export function installDependencies(appDir: string, arch: string, electronVersion: string): Promise<Buffer[]> {
  log("Installing app dependencies for arch %s to %s", arch || process.arch, appDir)
  const env = Object.assign({}, process.env, {
    npm_config_disturl: "https://atom.io/download/atom-shell",
    npm_config_target: electronVersion,
    npm_config_runtime: "electron",
    HOME: require("os").homedir() + "/.electron-gyp",
  })

  if (arch != null) {
    env.npm_config_arch = arch
  }

  let npmExecPath = process.env.npm_execpath || process.env.NPM_CLI_JS
  const npmExecArgs = ["install"]
  if (npmExecPath == null) {
    npmExecPath = "npm"
  }
  else {
    npmExecArgs.unshift(npmExecPath)
    npmExecPath = process.env.npm_node_execpath || process.env.NODE_EXE || "node"
  }

  return exec(npmExecPath, npmExecArgs, {
    cwd: appDir,
    env: env
  })
    .catch(e => {
      console.error(process.env)
      throw e
    })
}

interface ExecOptions {
  cwd?: string
  stdio?: any
  customFds?: any
  env?: any
  encoding?: string
  timeout?: number
  maxBuffer?: number
  killSignal?: string
}

export function exec(file: string, args?: string[], options?: ExecOptions): Promise<Buffer[]> {
  return new Promise<Buffer[]>((resolve, reject) => {
    execFile(file, args, options, (error, out, errorOut) => {
      if (error == null) {
        resolve([out, errorOut])
      }
      else {
        reject(error)
      }
    })
  })
}

const readFileAsync: ((filename: string, encoding?: string) => Promise<string | Buffer>) = Promise.promisify(fs.readFile)

export function readFile(file: string): Promise<any> {
  return readFileAsync(file, "utf8").
    then((it: string) => parseJson(it, file))
}

export function getElectronVersion(packageData: any, filePath: string): string {
  const devDependencies = packageData.devDependencies
  let electronPrebuiltDep = devDependencies == null ? null : devDependencies["electron-prebuilt"]
  if (electronPrebuiltDep == null) {
    const dependencies = packageData.dependencies
    electronPrebuiltDep = dependencies == null ? null : dependencies["electron-prebuilt"]
  }

  if (electronPrebuiltDep == null) {
    throw new Error("Cannot find electron-prebuilt dependency to get electron version in the '" + filePath + "'")
  }
  return electronPrebuiltDep.substring(1)
}

export function deleteFile(path: string, ignoreIfNotExists: boolean = false): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    fs.unlink(path, error => error == null ? resolve(null) : reject(error))
  })
}

export function deleteDirectory(path: string) {
  return new Promise<any>((resolve, reject) => {
    rimraf(path, {glob: false}, error => error == null ? resolve(null) : reject(error))
  })
}

export function renameFile(oldPath: string, newPath: string): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    fs.rename(oldPath, newPath, error => error == null ? resolve(null) : reject(error))
  })
}