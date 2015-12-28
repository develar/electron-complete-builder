#! /usr/bin/env node

"use strict"

const builder = require("../main")
const args = require("command-line-args")(builder.commonArgs.concat({
  name: "arch",
  type: String,
})).parse()
builder.installDependencies(args.arch, args.appDir)