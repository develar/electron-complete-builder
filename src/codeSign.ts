import * as fs from "fs"
import { execFile } from "child_process"
import { parallelTask, seriesTask } from "./util"
import { download } from "./httpRequest"
import { tmpdir } from "os"
import * as path from "path"

const keyChainName = "csc.keychain"
const developerCertPath = path.join(tmpdir(), "developer.p12")

export function createKeychain(callback: (error: any, keychainName: string) => void) {
  const appleCertPath = path.join(tmpdir(), "apple.cer")

  seriesTask(
    parallelTask(
      (callback) => { download("https://developer.apple.com/certificationauthority/AppleWWDRCA.cer", appleCertPath, callback) },
      (callback) => { download(process.env.CSC_LINK, developerCertPath, callback) },
      seriesTask(
        (callback) => { execFile("security", ["create-keychain", "-p", "travis", keyChainName], callback) },
        (callback) => { process.env.TEST_MODE === "true" ? callback(null) : execFile("security", ["default-keychain", "-s", keyChainName], callback) },
        (callback) => { execFile("security", ["unlock-keychain", "-p", "travis", keyChainName], callback) },
        (callback) => { execFile("security", ["unlock-keychain", "-p", "travis", keyChainName], callback) },
        (callback) => { execFile("security", ["set-keychain-settings", "-t", "3600", "-u", keyChainName], callback) }
      )
    ),
    (callback) => { execFile("security", ["import", appleCertPath, "-k", keyChainName, "-T", "/usr/bin/codesign"], callback) },
    (callback) => { execFile("security", ["import", developerCertPath, "-k", keyChainName, "-T", "/usr/bin/codesign", "-P", process.env.CSC_KEY_PASSWORD], callback) },
    extractCommonName
  )((error: any) => {
    // delete temp files in final callback - to delete if error occurred
    parallelTask(
      fs.unlink.bind(fs, appleCertPath),
      fs.unlink.bind(fs, developerCertPath)
    )((deleteTempFilesError: any) => {
      callback(error || deleteTempFilesError, keyChainName)
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
      process.env.CSC_NAME = match[1]
      callback(null)
    }
  })
}

export function deleteKeychain(callback: (error: any) => void) {
  execFile("security", ["delete-keychain", keyChainName], callback)
}