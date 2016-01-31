import assertThat from "should/as-function";
import test from "ava";
const codeSignData = require("./codeSignData")
const promises = require("../out/promise")

test("create keychain", async function () {
  const keychainName = generateKeychainName()
  await promises.executeFinally(createKeychain(keychainName, codeSignData.CSC_LINK, codeSignData.CSC_KEY_PASSWORD)
    .then(result => {
      assertThat(result.cscKeychainName).not.empty()
      assertThat(result.cscName).equal(codeSignData.CSC_NAME)
    }), error => promises.all([deleteKeychain(keychainName)]))
})