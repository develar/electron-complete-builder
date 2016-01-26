import * as fs from "fs"
import rimraf = require("rimraf")
import Promise = require("bluebird")

const readFileAsync: ((filename: string, encoding?: string) => Promise<string | Buffer>) = Promise.promisify(fs.readFile)

export function readFile(file: string): Promise<any> {
  return readFileAsync(file, "utf8").
    then((it: string) => parseJson(it, file))
}

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

export function deleteFile(path: string, ignoreIfNotExists: boolean = false): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    fs.unlink(path, error => error == null || (ignoreIfNotExists && error.code === "ENOENT") ? resolve(null) : reject(error))
  })
}

export function deleteDirectory(path: string) {
  return new Promise<any>((resolve, reject) => {
    rimraf(path, {glob: false}, error => error == null ? resolve(null) : reject(error))
  })
}

export function renameFile(oldPath: string, newPath: string): Promise<string> {
  return new Promise<any>((resolve, reject) => {
    fs.rename(oldPath, newPath, error => error == null ? resolve(newPath) : reject(error))
  })
}

const statFileAsync: ((filename: string) => Promise<fs.Stats>) = Promise.promisify(fs.stat)

export function stat(path: string): Promise<fs.Stats> {
  return statFileAsync(path)
}