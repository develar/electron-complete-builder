#! /usr/bin/env node

"use strict"

const util = require("../util")
const args = require("command-line-args")([
  {
    name: "arch",
    type: String
  },
  {
    name: "appDir",
    type: String,
    defaultValue: util.DEFAULT_APP_DIR_NAME,
    description: "Relative (to the working directory) path to the folder containing the application package.json"
  },
]).parse()

util.installDependencies(args.arch, args.appDir)