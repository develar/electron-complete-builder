import { Socket } from "net"
import { IncomingMessage } from "http"
import * as https from "https"
import { createWriteStream } from "fs"
import { parse as parseUrl } from "url"
const maxRedirects = 10

export function download(url: string, destination: string, callback: (error: any) => void) {
  let done = false
  doDownload(url, destination, (error) => {
    if (!done) {
      done = true
      callback(error)
    }
  }, 0)
}

function doDownload(url: string, destination: string, callback: (error: any) => void, redirectCount: number) {
  const parsedUrl = parseUrl(url)
  const request = https.request({
    protocol: parsedUrl.protocol,
    host: parsedUrl.host,
    port: 443,
    path: parsedUrl.path,
    headers: {
      // user-agent must be specified, otherwise some host can return 401 unauthorised
      "User-Agent": "NodeHttpRequest"
    }
  }, (response: IncomingMessage) => {
    if (response.statusCode >= 400) {
      callback("Request error, status " + response.statusCode + ": " + response.statusMessage)
      return
    }

    const redirectUrl = response.headers.location
    if (redirectUrl != null) {
      if (redirectCount < maxRedirects) {
        doDownload(redirectUrl, destination, callback, redirectCount++)
      }
      else {
        callback("Too many redirects (> " + maxRedirects + ")")
      }
      return
    }

    const downloadStream = createWriteStream(destination)
    response.pipe(downloadStream)
    downloadStream.on("finish", () => { downloadStream.close(callback) })

    let ended = false
    response.on("end", () => {
      ended = true
    })

    response.on("close", () => {
      if (!ended) {
        callback("Request aborted")
      }
    })
  })
  request.on("socket", function (socket: Socket) {
    socket.setTimeout(60 * 1000, () => {
      callback("Request timed out")
      request.abort()
    })
  })

  request.on("error", callback)
  request.end()
}