import { GetReleaseResult, Release } from "gh-release"
import * as https from "https"
import { IncomingMessage } from "http"
import { addTimeOutHandler } from "./httpRequest"
import { log } from "./util"
import { Promise } from "./promise"
import { basename } from "path"
import { parse as parseUrl } from "url"
import * as mime from "mime"
import { stat } from "./promisifed-fs"

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

  private async init() {
    let data: GetReleaseResult
    try {
      data = await githubRequest<GetReleaseResult>(`/repos/${this.owner}/${this.repo}/releases/tags/${this.tag}`)
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
    doGithubRequest<any>({
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "electron-complete-builder",
          "Content-Type": mime.lookup(fileName),
          "Content-Length": fileStat.size
        }
      }
    )
  }

  private async createRelease() {
    try {
      return await githubRequest<Release>(`/repos/${this.owner}/${this.repo}/releases`, this.token, {
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

function githubRequest<T>(path: string, token: string = null, data: { [name: string]: any; } = null): Promise<T> {
  const options: any = {
    hostname: "api.github.com",
    path: path,
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "electron-complete-builder",
    }
  }

  if (token != null) {
    options.headers.authorization = "token " + token
  }

  const encodedData = data == null ? null : new Buffer(JSON.stringify(data))
  if (encodedData != null) {
    options.method = "post"
    options.headers["Content-Type"] = "application/json"
    options.headers["Content-Length"] = encodedData.length
  }
  return doGithubRequest<T>(options, encodedData)
}

function doGithubRequest<T>(options: any, encodedData?: Buffer): Promise<T> {
  return new Promise<T>(function (resolve: (value: any) => void, reject: (error: Error) => void) {
    const request = https.request(options, (response: IncomingMessage) => {
      try {
        if (response.statusCode === 404) {
          // error is clear, we don't need to read detailed error description
          reject(new HttpError(response))
          return
        }

        let data = ""
        response.setEncoding("utf8")
        response.on("data", (chunk: string) => {
          data += chunk
        })

        response.on("end", () => {
          try {
            if (response.statusCode >= 400) {
              if (response.headers["content-type"].includes("json")) {
                reject(new HttpError(response, JSON.parse(data).message))
              }
              else {
                reject(new HttpError(response))
              }
            }
            else {
              resolve(JSON.parse(data))
            }
          }
          catch (e) {
            reject(e)
          }
        })
      }
      catch (e) {
        reject(e)
      }
    })
    addTimeOutHandler(request, reject)
    request.on("error", reject)
    request.end(encodedData)
  })
}

export class HttpError extends Error {
  constructor(public response: IncomingMessage, public description: any = null) {
    super(response.statusCode + " " + response.statusMessage)
  }

  toString() {
    let result = this.message
    if (this.description != null) {
      result += "\n" + this.description
    }
    return result
  }
}
