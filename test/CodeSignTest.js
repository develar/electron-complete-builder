const codeSign = require("../out/codeSign")
const assertThat = require("should/as-function")
require("should")
const codeSignData = require("./codeSignData")
const promises = require("../out/promise")

describe("Code Sign", function () {
  // default 2 seconds is not enough
  this.timeout(10 * 1000)

  it("create keychain", function () {
    const keychainName = codeSign.generateKeychainName()
    return promises.executeFinally(codeSign.createKeychain(keychainName, codeSignData.CSC_LINK, codeSignData.CSC_KEY_PASSWORD)
      .then(result => {
        assertThat(result.cscKeychainName).not.empty()
        assertThat(result.cscName).equal(codeSignData.CSC_NAME)
      }), error => promises.all([codeSign.deleteKeychain(keychainName)]))
  })
})