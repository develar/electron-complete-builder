import { exec, deleteFile } from "./util"
import { download } from "./httpRequest"
import { tmpdir } from "os"
import * as path from "path"
import { executeFinally, all } from "./promise"
import Promise = require("bluebird")
import crypto = require("crypto")

export interface CodeSigningInfo {
  cscName: string
  cscKeychainName?: string
}

function randomString(): string {
  return crypto.randomBytes(8).toString("hex")
}

export function generateKeychainName(): string {
  return "csc-" + randomString() + ".keychain"
}

export function createAutoDisposableKeychain(cscLink: string, cscKeyPassword: string) {
  const keychainName = generateKeychainName()
  return createKeychain(keychainName, cscLink, cscKeyPassword)
    .disposer((info: CodeSigningInfo, promise: any) => deleteKeychain(keychainName, false))
}

export function createKeychain(keychainName: string, cscLink: string, cscKeyPassword: string): Promise<CodeSigningInfo> {
  console.log(tmpdir())
  const appleCertPath = path.join(tmpdir(), randomString() + ".cer")
  const developerCertPath = path.join(tmpdir(), randomString() + ".p12")

  return executeFinally(Promise.join(
    download("https://developer.apple.com/certificationauthority/AppleWWDRCA.cer", appleCertPath),
    download(cscLink, developerCertPath),
    Promise.mapSeries([
      ["create-keychain", "-p", "travis", keychainName],
      ["unlock-keychain", "-p", "travis", keychainName],
      ["set-keychain-settings", "-t", "3600", "-u", keychainName]
    ], args => exec("security", args)))
    .then(() => importCerts(keychainName, appleCertPath, developerCertPath, cscKeyPassword)),
    error => {
      const tasks = [deleteFile(appleCertPath), deleteFile(developerCertPath)]
      if (error != null) {
        tasks.push(deleteKeychain(keychainName))
      }
      return all(tasks)
    })
}

async function importCerts(keychainName: string, appleCertPath: string, developerCertPath: string, cscKeyPassword: string): Promise<CodeSigningInfo> {
  await exec("security", ["import", appleCertPath, "-k", keychainName, "-T", "/usr/bin/codesign"])
  await exec("security", ["import", developerCertPath, "-k", keychainName, "-T", "/usr/bin/codesign", "-P", cscKeyPassword])
  let cscName = await extractCommonName(cscKeyPassword, developerCertPath)
  return {
    cscName: cscName,
    cscKeychainName: keychainName
  }
}

function extractCommonName(password: string, certPath: string): Promise<string> {
  return exec("openssl", ["pkcs12", "-nokeys", "-nodes", "-passin", "pass:" + password, "-nomacver", "-clcerts", "-in", certPath])
    .then(result => {
      const match = result[0].toString().match(/^subject.*\/CN=([^\/]+)/m)
      if (match == null || match[1] == null) {
        throw new Error("Cannot extract common name from p12")
      }
      else {
        return match[1]
      }
    })
}

export function sign(path: string, options: CodeSigningInfo): Promise<any> {
  const args = ["--deep", "--force", "--sign", options.cscName, path]
  if (options.cscKeychainName != null) {
    args.push("--keychain", options.cscKeychainName)
  }
  return exec("codesign", args)
}

export function deleteKeychain(keychainName: string, ignoreNotFound: boolean = true): Promise<any> {
  const result = exec("security", ["delete-keychain", keychainName])
  if (!ignoreNotFound) {
    result.catch(error => {
      if (!error.message.includes("The specified keychain could not be found.")) {
        throw error
      }
    })
  }
  return result
}