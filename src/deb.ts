import { exec } from "./util"
import * as path from "path"
import { Promise as BluebirdPromise } from "bluebird"
import * as fse from "fs-extra"
import { tsAwaiter } from "./awaiter"

const __awaiter = tsAwaiter
Array.isArray(__awaiter)

const move = BluebirdPromise.promisify(fse.move)
const writeFile = BluebirdPromise.promisify(fse.outputFile)

export interface DebOptions {
  packageName: string
  packageDescription: string

  version: string

  installPath: string

  architecture: string
  essential?: string
  maintainer?: string
  priority?: string
  section?: string
}

const archToDebArch: { [key: string]: string; } = {
  "x64": "amd64",
  "ia32": "i386",
}

// https://gist.github.com/bdsatish/00ee8a21e298f2b20d9d
export async function makeDeb(options: DebOptions, buildDir: string): Promise<string> {
  if (!options.installPath.startsWith("/")) {
    throw new Error('installPath must be a valid absolute path: ' + options.installPath)
  }

  // http://askubuntu.com/questions/330018/what-is-the-standard-for-naming-deb-file-name
  const architecture = archToDebArch[options.architecture]
  const packageDir = path.join(path.dirname(buildDir), options.packageName + '-' + options.version + '-' + architecture)
  await move(buildDir, path.join(packageDir, options.installPath), {clobber: true})
  await writeDebianFiles(packageDir, Object.assign({
      architecture: "all",
      essential: "no",
      overwrite: true,
      priority: "optional",
      section: "main"
    }, options), architecture)
  await exec("dpkg-deb", ["-b", packageDir])
  return packageDir + '.deb'
}

function writeDebianFiles(packageDir: string, options: DebOptions, architecture: string): BluebirdPromise<any> {
  // new line is required in the end
  return writeFile(path.join(packageDir, 'DEBIAN', 'control'), `Package: ${options.packageName}
Version: ${options.version}
Section: ${options.section}
Priority: ${options.priority}
Architecture: ${architecture}
Essential: ${options.essential}
Maintainer: ${options.maintainer}
Description: ${options.packageDescription}
`)
}