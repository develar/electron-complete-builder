import * as https from "https"
import { RequestOptions } from "https"
import { IncomingMessage, ClientRequest } from "http"
import { addTimeOutHandler } from "./httpRequest"
import Promise = require("bluebird")

export function gitHubRequest<T>(path: string, token: string = null, data: { [name: string]: any; } = null): Promise<T> {
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
  return doGitHubRequest<T>(options, it => it.end(encodedData))
}

export function doGitHubRequest<T>(options: RequestOptions, requestProcessor: (request: ClientRequest, reject: (error: Error) => void) => void): Promise<T> {
  return new Promise<T>((resolve, reject, onCancel) => {
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
    requestProcessor(request, reject)
    onCancel(() => request.abort())
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