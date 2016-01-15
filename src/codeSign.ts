import * as fs from "fs"
import { execFile } from "child_process"
import { parallelTask, seriesTask } from "./util"
import { download } from "./httpRequest"

const keyChainName = "csc.keychain"

export function createKeychain(callback: (error: any, keychainName: string) => void) {
  const developerCertPath = "/tmp/developer.p12"
  const appleCertPath = "/tmp/apple.cer"

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
    parallelTask(
      fs.unlink.bind(fs, appleCertPath),
      fs.unlink.bind(fs, developerCertPath)
    ))((error: any) => {
    callback(error, keyChainName)
  })
}

export function deleteKeychain(callback: (error: any) => void) {
  execFile("security", ["delete-keychain", keyChainName], callback)
}