import assertThat from "should/as-function"
import test from "ava-tf"
import { GitHubPublisher } from "../out/gitHubPublisher"
import { join } from "path"

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function versionNumber() {
  return getRandomInt(0, 99) + "." + Date.now() + "." + getRandomInt(0, 9);
}

const token = new Buffer("MDk3ZjI5ZTRmNTRkMjYwMGNiNzU0OWU3YzNhYjJhMTYwNzIxODU0Yg ==", "base64").toString()
const iconPath = join(__dirname, "fixtures", "test-app", "build", "icon.icns")

//test("GitHub unauthorized", async (t) => {
//  t.throws(await new GitHubPublisher("github-releases-test", "test-repo", versionNumber(), "incorrect token")
//    .releasePromise, /(Bad credentials|Unauthorized|API rate limit exceeded)/)
//})

test("GitHub upload", async function () {
  const publisher = new GitHubPublisher("github-releases-test", "test-repo", versionNumber(), token)
  try {
    await publisher.upload(iconPath)
  }
  finally {
    await publisher.deleteRelease()
  }
})

test("GitHub overwrite on upload", async() => {
  const publisher = new GitHubPublisher("github-releases-test", "test-repo", versionNumber(), token)
  try {
    await publisher.upload(iconPath)
    await publisher.upload(iconPath)
  }
  finally {
    await publisher.deleteRelease()
  }
})
