import { PackagerOptions, Packager } from "./packager"
import { PublishOptions, Publisher, GitHubPublisher } from "./gitHubPublisher"
import { fromUrl as parseRepositoryUrl } from "hosted-git-info"
import { executeFinally } from "./promise"
import Promise = require("bluebird")

export function createPublisher(packager: Packager, options: BuildOptions): Publisher {
  const repo = packager.devMetadata.repository || packager.metadata.repository
  if (repo == null) {
    throw new Error("Please specify 'repository' in the dev package.json ('" + packager.devPackageFile + "')")
  }
  const info = parseRepositoryUrl(typeof repo === "string" ? repo : repo.url)
  return new GitHubPublisher(info.user, info.project, packager.metadata.version, options.githubToken)
}

export interface BuildOptions extends PackagerOptions, PublishOptions {
}

export function build(options: BuildOptions = {}): Promise<any> {
  if (options.cscLink == null) {
    options.cscLink = process.env.CSC_LINK
  }
  if (options.cscKeyPassword == null) {
    options.cscKeyPassword = process.env.CSC_KEY_PASSWORD
  }

  if (options.githubToken == null) {
    options.githubToken = process.env.GH_TOKEN || process.env.GH_TEST_TOKEN
  }

  if (options.publish) {
    options.dist = true
  }

  const publishTasks: Array<Promise<any>> = []
  const packager = new Packager(options)
  if (options.publish) {
    let publisher: Publisher = null
    packager.artifactCreated(path => {
      if (publisher == null) {
        publisher = createPublisher(packager, options)
      }

      if (publisher != null) {
        publishTasks.push(publisher.upload(path))
      }
    })
  }
  return executeFinally(packager.build(), error => {
    if (error == null) {
      return Promise.all(publishTasks)
    }
    else {
      for (let task of publishTasks) {
        task.cancel()
      }
    }
  })
}