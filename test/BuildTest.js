import test from "ava";
import fse from "fs-extra";
import tmp from "tmp";
import Promise from "bluebird";
import assertThat from "should/as-function";
import * as path from "path";
import {parse as parsePlist} from "plist";

const copyDir = Promise.promisify(fse.copy)
const tmpDir = Promise.promisify(tmp.dir)

async function assertPack(assert, projectDir, platform) {
  if (platform === "win32") {
    // win test uses the same dir as mac test, but we cannot share node_modules (because tests executed in parallel)
    let dir = await tmpDir()
    await copyDir(projectDir, dir, {
      filter: function (p) {
        const basename = path.basename(p);
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
  await deleteDirectory(path.join(projectDir, "dist"))
  await packager.build()
  if (platform === "darwin") {
    const packedAppDir = projectDir + "/dist/TestApp-darwin-x64/TestApp.app"
    const info = parsePlist(await readFile(packedAppDir + "/Contents/Info.plist", "utf8"))
    assertThat(info).has.properties({
      CFBundleDisplayName: "TestApp",
      CFBundleIdentifier: "your.id",
      LSApplicationCategoryType: "your.app.category.type",
      CFBundleVersion: "1.0.0"
    })

    const result = await exec("codesign", ["--verify", packedAppDir])
    assertThat(result[0].toString()).not.match(/is not signed at all/)
  }
}

if (!process.env.APPVEYOR) {
  test("pack two-package.json project", async function (t) {
    await assertPack(t, path.join(__dirname, "test-app"), "darwin")
  })

  test("pack one-package.json project", async function (t) {
    await assertPack(t, path.join(__dirname, "test-app-one"), "darwin")
  })
}

if (!process.env.TRAVIS) {
  test("pack two-package.json project win", async function (t) {
    assertPack(t, path.join(__dirname, "test-app"), "win32")
  })
}
