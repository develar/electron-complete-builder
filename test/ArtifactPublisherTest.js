const gitHubPublisher = require("../out/gitHubPublisher")
require("should")
const GitHubPublisher = gitHubPublisher.GitHubPublisher
const path = require("path")
const promises = require("../out/promise")

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function versionNumber() {
  return getRandomInt(0, 99) + "." + Date.now() + "." + getRandomInt(0, 9);
}

describe("Artifacts Uploader", function () {
  this.timeout(20 * 1000)

  const token = new Buffer("MDk3ZjI5ZTRmNTRkMjYwMGNiNzU0OWU3YzNhYjJhMTYwNzIxODU0Yg ==", "base64").toString()

  xit("GitHub unauthorized", () => {
    return new GitHubPublisher("github-releases-test", "test-repo", versionNumber(), "incorrect token")
      .releasePromise
      .should.rejectedWith(/(Bad credentials|Unauthorized|API rate limit exceeded)/)
  })
  it("GitHub upload", () => {
    const publisher = new GitHubPublisher("github-releases-test", "test-repo", versionNumber(), token)
    return promises.executeFinally(
      publisher.upload(path.join(process.cwd(), "test", "test-app", "build", "icon.icns")),
      () => publisher.deleteRelease())
  })
  it("GitHub overwrite on upload", () => {
    const publisher = new GitHubPublisher("github-releases-test", "test-repo", versionNumber(), token)
    return promises.executeFinally(
      publisher.upload(path.join(process.cwd(), "test", "test-app", "build", "icon.icns"))
        .then(() => publisher.upload(path.join(process.cwd(), "test", "test-app", "build", "icon.icns"))),
      () => publisher.deleteRelease())
  })
})