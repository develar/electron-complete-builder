import { PackagerOptions, Packager } from "./packager"
import { PublishOptions, Publisher, GitHubPublisher } from "./gitHubPublisher"
import { fromUrl as parseRepositoryUrl, Info } from "hosted-git-info"
import { executeFinally } from "./promise"
import { readFile } from "./promisifed-fs"
import { log } from "./util"
import * as path from "path"
import Promise = require("bluebird")

async function getGitUrlFromGitConfig(): Promise<string> {
  let data: string = null
  try {
    data = await readFile(path.join(".git", "config"))
  }
  catch (e) {
    if (e.code === "ENOENT") {
      return null
    }

    throw e
  }

  const conf = data.split(/\r?\n/)
  const i = conf.indexOf('[remote "origin"]')
  if (i !== -1) {
    let u = conf[i + 1]
    if (!u.match(/^\s*url =/)) {
      u = conf[i + 2]
    }

    if (u.match(/^\s*url =/)) {
      return u.replace(/^\s*url = /, "")
    }
  }
  return null
}

export async function createPublisher(packager: Packager, options: BuildOptions): Promise<Publisher> {
  const repo = packager.devMetadata.repository || packager.metadata.repository
  let info: Info = null
  if (repo == null) {
    let url = process.env.TRAVIS_REPO_SLUG || process.env.APPVEYOR_PROJECT_SLUG
    if (url == null) {
      url = await getGitUrlFromGitConfig()
    }

    if (url != null) {
      info = parseRepositoryUrl(url)
    }

    if (info == null) {
      log("Cannot detect repository by .git/config")
      throw new Error("Please specify 'repository' in the dev package.json ('" + packager.devPackageFile + "')")
    }
  }
  else {
    info = parseRepositoryUrl(typeof repo === "string" ? repo : repo.url)
  }
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
    let publisher: Promise<Publisher> = null
    packager.artifactCreated(path => {
      if (publisher == null) {
        publisher = createPublisher(packager, options)
      }

      if (publisher != null) {
        publisher.then(it => publishTasks.push(it.upload(path)))
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