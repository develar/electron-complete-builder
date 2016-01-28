#! /usr/bin/env node

import { PackagerOptions, setDefaultOptionValues } from "./packager"
import { build } from "./builder"
import { PublishOptions } from "./gitHubPublisher"
import { commonArgs } from "./util"
import { printErrorAndExit } from "./promise"
import cla = require("command-line-args")

interface CliOptions extends PackagerOptions, PublishOptions {
  build: boolean
  help: boolean
}

const defaultOptionValues: PackagerOptions = {}
setDefaultOptionValues(defaultOptionValues)

const cli = cla(commonArgs.concat(
  {name: "arch", type: String, defaultValue: defaultOptionValues.arch, description: "ia32, x64 or all (by default)."},
  {name: "dist", type: Boolean, alias: "d", defaultValue: false, description: "Whether to package in a distributable format (e.g. DMG, windows installer, NuGet package)."},
  {name: "publish", type: Boolean, alias: "p", defaultValue: false, description: "Whether to publish artifacts (to GitHub Releases)."},
  {name: "build", type: Boolean, defaultValue: false, description: "Deprecated, use dist instead."},
  {name: "sign", type: String},
  {name: "platform", type: String, defaultValue: defaultOptionValues.platform, description: "darwin or win32. Current platform (" + process.platform + ") by default."},
  {name: "help", alias: "h", type: Boolean}
))

const args: CliOptions = cli.parse()
if (args.help) {
  console.log(cli.getUsage({hide: ["build"]}))
}
else {
  if (args.build) {
    args.dist = true
  }

  build(args)
    .catch(printErrorAndExit)
}