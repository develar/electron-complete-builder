#! /usr/bin/env node

import { Options, Packager, setDefaultOptionValues } from "./Packager"
import { commonArgs } from "./util"

interface CliOptions extends Options {
  build: boolean
  help: boolean
}

const defaultOptionValues: Options = {}
setDefaultOptionValues(defaultOptionValues)

const cli = require("command-line-args")(commonArgs.concat(
  {name: "arch", type: String, defaultValue: defaultOptionValues.arch, description: "ia32, x64 or all (by default)."},
  {name: "dist", type: Boolean, alias: "d", defaultValue: false, description: "Whether to package in a distributable format (e.g. DMG, windows installer, NuGet package)."},
  {name: "build", type: Boolean, defaultValue: false, description: "Deprecated, use dist instead."},
  {name: "sign", type: String},
  {name: "platform", type: String, defaultValue: defaultOptionValues.platform, description: "darwin or win32. Curent platform (" + process.platform + ") by default."},
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

  new Packager(args)
}