const assertThat = require("should/as-function")
const path = require("path")
const fs = require('fs')
const plist = require("plist")
const Packager = require("../out/packager")
const util = require("../out/util")
const promisifedFs = require("../out/promisifed-fs")
const codeSignData = require("./codeSignData")
require("should")

function assertPack(projectDir, platform) {
  const packager = new Packager.Packager({
    projectDir: projectDir,
    cscLink: codeSignData.CSC_LINK,
    cscKeyPassword: codeSignData.CSC_KEY_PASSWORD,
    dist: true,
    platform: platform,
  })
  return promisifedFs.deleteDirectory(path.join(projectDir, "dist"))
    .then(() => {
      return packager.build()
        .then(() => {
          if (platform === "darwin") {
            const packedAppDir = projectDir + "/dist/TestApp-darwin-x64/TestApp.app"
            const info = plist.parse(fs.readFileSync(packedAppDir + "/Contents/Info.plist", "utf8"));
            assertThat(info).have.properties({
              CFBundleDisplayName: "TestApp",
              CFBundleIdentifier: "your.id",
              LSApplicationCategoryType: "your.app.category.type",
              CFBundleVersion: "1.0.0"
            })

            return util.exec("codesign", ["--verify", packedAppDir])
              .then(it => assertThat(it[0].toString()).not.match(/is not signed at all/))
          }
        })
    })
}

describe("Build", function () {
  // default 2 seconds is not enough
  this.timeout(4 * 60 * 1000)

  it("pack two-package.json project", function () {
    return assertPack(path.join(__dirname, "test-app"))
  })

  it("pack one-package.json project", function () {
    return assertPack(path.join(__dirname, "test-app-one"))
  })


  it("pack two-package.json project win", function () {
    return assertPack(path.join(__dirname, "test-app"), "win32")
  })
})