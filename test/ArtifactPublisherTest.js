const gitHubPublisher = require("../out/gitHubPublisher")
require("should")
const GitHubPublisher = gitHubPublisher.GitHubPublisher

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function versionNumber() {
  return getRandomInt(0, 99) + "." + Date.now() + "." + getRandomInt(0, 9);
}

describe("Artifacts Uploader", function () {
  it("GitHub unauthorized", function () {
    return new GitHubPublisher("github-releases-test", "test-repo", versionNumber(), "incorrect token")
      .releasePromise
      .catch(e => {
        console.error(e.stack)
        throw e
      })
      .should.rejectedWith(/^Unauthorized/)
  })
})