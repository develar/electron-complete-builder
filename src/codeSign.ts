import * as fs from "fs"
import { execFile } from "child_process"
import { parallelTask, seriesTask } from "./util"
import { download } from "./httpRequest"
import { tmpdir } from "os"
import * as path from "path"

const crypto = require("crypto")
const keychainName = "csc-" + crypto.randomBytes(16).toString("hex") + "keychain"
const developerCertPath = path.join(tmpdir(), "developer.p12")
let cscName: string = null

export interface CodeSigningInfo {
  cscName: string
  cscKeychainName: string
}

export function createKeychain(callback: (error: Error|string, result: CodeSigningInfo) => void) {
  const appleCertPath = path.join(tmpdir(), "apple.cer")

  seriesTask(
    parallelTask(
      (callback) => { download("https://developer.apple.com/certificationauthority/AppleWWDRCA.cer", appleCertPath, callback) },
      (callback) => { download(process.env.CSC_LINK, developerCertPath, callback) },
      seriesTask(
        (callback) => { execFile("security", ["create-keychain", "-p", "travis", keychainName], callback) },
        (callback) => { execFile("security", ["unlock-keychain", "-p", "travis", keychainName], callback) },
        (callback) => { execFile("security", ["set-keychain-settings", "-t", "3600", "-u", keychainName], callback) }
      )
    ),
    (callback) => { execFile("security", ["import", appleCertPath, "-k", keychainName, "-T", "/usr/bin/codesign"], callback) },
    (callback) => { execFile("security", ["import", developerCertPath, "-k", keychainName, "-T", "/usr/bin/codesign", "-P", process.env.CSC_KEY_PASSWORD], callback) },
    extractCommonName
  )((error: any) => {
    // delete temp files in final callback - to delete if error occurred
    parallelTask(
      fs.unlink.bind(fs, appleCertPath),
      fs.unlink.bind(fs, developerCertPath)
    )((deleteTempFilesError: any) => {
      callback(error || deleteTempFilesError, {
        cscName: cscName,
        cscKeychainName: keychainName
      })
    })
  })
}

function extractCommonName(callback: (error: any) => void) {
  //noinspection JSUnusedLocalSymbols
  execFile("openssl", ["pkcs12", "-nokeys", "-nodes", "-passin", "pass:" + process.env.CSC_KEY_PASSWORD, "-nomacver", "-clcerts", "-in", developerCertPath], (error: Error, output: Buffer, errorOutput: Buffer) => {
    if (error != null) {
      callback(error)
      return
    }

    const match = output.toString().match(/^subject.*\/CN=([^\/]+)/m)
    if (match == null || match[1] == null) {
      callback("Cannot extract common name from p12")
    }
    else {
      cscName = match[1]
      callback(null)
    }
  })
}

export function deleteKeychain(callback: (error: any) => void) {
  execFile("security", ["delete-keychain", keychainName], callback)
}