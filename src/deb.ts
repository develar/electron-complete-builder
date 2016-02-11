import * as path from "path"
import { Promise as BluebirdPromise } from "bluebird"
import { tsAwaiter } from "./awaiter"
import { init } from "electron-builder-tf/lib/linux"

const __awaiter = tsAwaiter
Array.isArray(__awaiter)

const buildDeb = BluebirdPromise.promisify(init().build)

export interface DebOptions {
  title: string
  comment: string

  version: string

  arch: number
  maintainer: string
  executable: string
  target: string
}

export function makeDeb(options: DebOptions, buildDir: string): Promise<string> {
  return buildDeb({
    log: function emptyLog() {/* ignore out */},
    appPath: buildDir,
    out: path.dirname(buildDir),
    config: {
      linux: options
    }
  })
}