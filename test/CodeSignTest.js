const codeSign = require("../out/codeSign")
const assertThat = require("should/as-function")

// use http://www.cert-depot.com to generate p12 file to test
process.env.CSC_LINK = "https://www.dropbox.com/s/d47tc2s4225u7rn/4ce0ece9-d9b7-4fc4-bf67-5006944af35a.p12?dl=1"
process.env.CSC_KEY_PASSWORD = "password"
process.env.TEST_MODE = "true"

describe("Code Sign", function () {
  // default 2 seconds is not enough
  this.timeout(10 * 1000)

  afterEach(function (done) {
    codeSign.deleteKeychain(done)
  })

  it("create keychain", function (done) {
    codeSign.createKeychain(function (error, keychainName) {
      if (error != null) {
        done(error)
        return
      }

      assertThat(keychainName).not.empty()
      assertThat(process.env.CSC_NAME).equal("FooBar")
      done(null)
    })
  })
})