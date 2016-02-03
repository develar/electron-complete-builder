import { createKeychain, deleteKeychain, generateKeychainName } from "../out/codeSign"
import assertThat from "should/as-function"
import test from "ava-tf"
import { CSC_NAME, CSC_LINK, CSC_KEY_PASSWORD } from "./helpers/codeSignData"
const promises = require("../out/promise")

test("create keychain", async function () {
  const keychainName = generateKeychainName()
  await promises.executeFinally(createKeychain(keychainName, CSC_LINK, CSC_KEY_PASSWORD)
    .then(result => {
      assertThat(result.cscKeychainName).not.empty()
      assertThat(result.cscName).equal(CSC_NAME)
    }), error => promises.all([deleteKeychain(keychainName)]))
})