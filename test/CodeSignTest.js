const codeSign = require("../out/codeSign")
const assertThat = require("should/as-function")
require("should")
const Promise = require("bluebird")
const codeSignData = require("./codeSignData")

// use https://developer.apple.com/library/mac/documentation/Security/Conceptual/CodeSigningGuide/Procedures/Procedures.html
// "To use the Certificate Assistant to create a self-signed signing identity"
const CSC_LINK = "https://www.dropbox.com/s/86zaffzbao198xe/test.p12?dl=1"
const CSC_KEY_PASSWORD = "password"

describe("Code Sign", function () {
  // default 2 seconds is not enough
  this.timeout(10 * 1000)

  it("create keychain", function () {
    return Promise.using(codeSign.createAutoDisposableKeychain(codeSignData.CSC_LINK, codeSignData.CSC_KEY_PASSWORD), result => result)
      .then(result => {
        assertThat(result.cscKeychainName).not.empty()
        assertThat(result.cscName).equal(codeSignData.CSC_NAME)
      })
  })
})