import { PackagerOptions, Packager } from "./packager"
import { PublishOptions, Publisher, GitHubPublisher } from "./gitHubPublisher"
import { executeFinally } from "./promise"
import { Promise as BluebirdPromise } from "bluebird"
import { tsAwaiter } from "./awaiter"
import { InfoRetriever } from "./repositoryInfo"
import { log } from "./util"

const __awaiter = tsAwaiter
Array.isArray(__awaiter)

export async function createPublisher(packager: Packager, options: BuildOptions, repositoryInfo: InfoRetriever): Promise<Publisher> {
  const info = await repositoryInfo.getInfo(packager)
  if (info == null) {
    log("Cannot detect repository by .git/config")
    throw new Error("Please specify 'repository' in the dev package.json ('" + packager.devPackageFile + "')")
  }
  else {
    return new GitHubPublisher(info.user, info.project, packager.metadata.version, options.githubToken)
  }
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

  const publishTasks: Array<BluebirdPromise<any>> = []
  const repositoryInfo = new InfoRetriever()
  const packager = new Packager(options, repositoryInfo)
  if (options.publish) {
    let publisher: BluebirdPromise<Publisher> = null
    packager.artifactCreated(path => {
      if (publisher == null) {
        publisher = <BluebirdPromise<Publisher>>createPublisher(packager, options, repositoryInfo)
      }

      if (publisher != null) {
        publisher.then(it => publishTasks.push(<BluebirdPromise<any>>it.upload(path)))
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
      return null
    }
  })
}