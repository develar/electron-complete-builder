import test from "ava-tf"
import fse from "fs-extra"
import tmp from "tmp"
import Promise from "bluebird"
import assertThat from "should/as-function"
import * as path from "path"
import { parse as parsePlist } from "plist"
import { Packager } from "../out/packager"
import { exec } from "../out/util"
import { deleteDirectory, readFile } from "../out/promisifed-fs"
import { CSC_LINK, CSC_KEY_PASSWORD } from "./helpers/codeSignData"

const copyDir = Promise.promisify(fse.copy)
const tmpDir = Promise.promisify(tmp.dir)

async function assertPack(projectDir, platform) {
  projectDir = path.join(__dirname, "fixtures", projectDir)
  const isMac = platform === "darwin"
  if (!isMac) {
    // non-osx test uses the same dir as osx test, but we cannot share node_modules (because tests executed in parallel)
    const dir = await tmpDir({
      unsafeCleanup: true,
      prefix: platform
    })
    await copyDir(projectDir, dir, {
      filter: function (p) {
        const basename = path.basename(p)
        return basename !== "dist" && basename !== "node_modules" && basename[0] !== "."
      }
    })
    projectDir = dir
  }

  const packager = new Packager({
    projectDir: projectDir,
    cscLink: CSC_LINK,
    cscKeyPassword: CSC_KEY_PASSWORD,
    dist: true,
    platform: platform,
  })

  // for non-osx we always use temp dir, so, don't need to clean
  if (isMac) {
    await deleteDirectory(path.join(projectDir, "dist"))
  }

  await packager.build()
  if (platform === "darwin") {
    const packedAppDir = projectDir + "/dist/TestApp-darwin-x64/TestApp.app"
    const info = parsePlist(await readFile(packedAppDir + "/Contents/Info.plist", "utf8"))
    assertThat(info).has.properties({
      CFBundleDisplayName: "TestApp",
      CFBundleIdentifier: "your.id",
      LSApplicationCategoryType: "your.app.category.type",
      CFBundleVersion: "1.0.0" + "." + (process.env.TRAVIS_BUILD_NUMBER || process.env.CIRCLE_BUILD_NUM)
    })

    const result = await exec("codesign", ["--verify", packedAppDir])
    assertThat(result[0].toString()).not.match(/is not signed at all/)
  }
}

if (!process.env.APPVEYOR) {
  if (process.env.TRAVIS !== "true") {
    // we don't use CircleCI, so, we can safely set this env
    process.env.CIRCLE_BUILD_NUM = 42
  }

  test("mac: two-package.json", async t => {
    await assertPack("test-app", "darwin")
  })

  test("mac: one-package.json", async t => {
    await assertPack("test-app-one", "darwin")
  })

  test("linux: two-package.json", async t => {
    await assertPack("test-app-one", "linux")
  })
}

if (!process.env.TRAVIS) {
  test("win: two-package.json", async t => {
    await assertPack("test-app-one", "win32")
  })
}
