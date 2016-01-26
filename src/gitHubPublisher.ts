import { GetReleaseResult, Release } from "gh-release"
import { log } from "./util"
import { basename } from "path"
import { parse as parseUrl } from "url"
import * as mime from "mime"
import { stat } from "./promisifed-fs"
import { createReadStream } from "fs"
import { gitHubRequest, HttpError, doGitHubRequest } from "./gitHubRequest"
import progressStream = require("progress-stream")
import ProgressBar = require("progress")
import Promise = require("bluebird")

export interface Publisher {
  upload(path: string): Promise<any>
}

export class GitHubPublisher implements Publisher {
  private tag: string
  private _releasePromise: Promise<Release>

  public get releasePromise() {
    return this._releasePromise
  }

  constructor(private owner: string, private repo: string, version: string, private token: string) {
    if (token == null || token.length === 0) {
      throw new Error("GitHub Personal Access Token is not specified")
    }

    this.tag = "v" + version
    this._releasePromise = this.init()
  }

  private async init(): Promise<GetReleaseResult> {
    let data: GetReleaseResult
    try {
      data = await gitHubRequest<GetReleaseResult>(`/repos/${this.owner}/${this.repo}/releases/tags/${this.tag}`)
    }
    catch (e) {
      if (e instanceof HttpError) {
        const httpError = <HttpError>e
        if (httpError.response.statusCode === 404) {
          log("Release %s doesn't exists, creating one", this.tag)
          await this.createRelease()
        }
      }

      throw e
    }

    if (!data.draft) {
      throw new Error("Release must be a draft")
    }
    return data
  }

  public async upload(path: string): Promise<any> {
    const fileName = basename(path)
    let release = await this.releasePromise
    const parsedUrl = parseUrl(release.upload_url.substring(0, release.upload_url.indexOf("{")) + "?name=" + fileName)
    const fileStat = await stat(path)
    const progressBar = new ProgressBar(":bar", { total: fileStat.size })
    doGitHubRequest<any>({
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "electron-complete-builder",
          "Content-Type": mime.lookup(fileName),
          "Content-Length": fileStat.size
        }
      }, (request, reject) => {
      const fileInputStream = createReadStream(path)
      fileInputStream.on("error", reject)
      fileInputStream
        .pipe(progressStream({
          length: fileStat.size,
          time: 1000
        }, progress => progressBar.tick(progress.delta)))
        .pipe(request)
    })
  }

  private async createRelease() {
    try {
      return await gitHubRequest<Release>(`/repos/${this.owner}/${this.repo}/releases`, this.token, {
        tag_name: this.tag,
        draft: true,
      })
    }
    catch (e) {
      if (e instanceof HttpError) {
        const httpError = <HttpError>e
        const statusCode = httpError.response.statusCode
        if (statusCode === 401 || statusCode === 403) {
          throw new Error("Unauthorized, please ensure that GitHub Personal Access Token is correct.\n" + httpError)
        }
      }
      throw e
    }
  }
}