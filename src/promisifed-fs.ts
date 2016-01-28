import * as fs from "fs"
import { parse as _parseJson } from "json-parse-helpfulerror"
import rimraf = require("rimraf")
import Promise = require("bluebird")

const readFileAsync: ((filename: string, encoding?: string) => Promise<string | Buffer>) = Promise.promisify(fs.readFile)

export function readFile(file: string): Promise<string> {
  return <Promise<string>>readFileAsync(file, "utf8")
}

export function parseJsonFile(file: string): Promise<any> {
  return readFile(file).
    then(it => parseJson(it, file))
}

export function parseJson(data: string, path: string): any {
  try {
    return _parseJson(data)
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
    fs.unlink(path, it => it == null || (ignoreIfNotExists && it.code === "ENOENT") ? resolve(null) : reject(it))
  })
}

export function deleteDirectory(path: string) {
  return new Promise<any>((resolve, reject) => {
    rimraf(path, {glob: false}, error => error == null ? resolve(null) : reject(error))
  })
}

// returns new name
export function renameFile(oldPath: string, newPath: string): Promise<string> {
  return new Promise<any>((resolve, reject) => {
    fs.rename(oldPath, newPath, error => error == null ? resolve(newPath) : reject(error))
  })
}

const statFileAsync: ((filename: string) => Promise<fs.Stats>) = Promise.promisify(fs.stat)

export function stat(path: string): Promise<fs.Stats> {
  return statFileAsync(path)
}