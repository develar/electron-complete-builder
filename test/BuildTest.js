const assertThat = require("should/as-function")
const childProcess = require("child_process")
const path = require("path")
const merge = require("merge")
const fs = require('fs')
const plist = require("plist")

describe("Build", function () {
  // default 2 seconds is not enough
  this.timeout(60 * 1000)

  it("pack", function (done) {
    // use http://www.cert-depot.com to generate p12 file to test
    childProcess.execFile("node", ["../../out/build-cli.js"],
      {
        cwd: path.join(process.cwd(), "test", "testApp"),
        env: merge(process.env, {
          CSC_LINK: "https://www.dropbox.com/s/d47tc2s4225u7rn/4ce0ece9-d9b7-4fc4-bf67-5006944af35a.p12?dl=1",
          CSC_KEY_PASSWORD: "password"
        })
      }, function (error, output, errorOutput) {
        // self-signed cert cannot be used to sign app, it is ok (todo: apple self-signed cert should be ok and we should try to use it)
        if (error != null && !error.message.includes("FooBar: this identity cannot be used for signing code")) {
          done(error)
          return
        }

        const info = plist.parse(fs.readFileSync(__dirname + "/testApp/dist/TestApp-darwin-x64/TestApp.app/Contents/Info.plist", "utf8"));
        assertThat(info).have.properties({
          CFBundleDisplayName: "TestApp",
          CFBundleIdentifier: "your.id",
          LSApplicationCategoryType: "your.app.category.type",
          CFBundleVersion: "1.0.0"
        })
        done()
      })
  })
})