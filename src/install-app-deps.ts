#! /usr/bin/env node

import {installDependencies, commonArgs} from "./util";
const args = require("command-line-args")(commonArgs.concat({
  name: "arch",
  type: String,
})).parse()
installDependencies(args.arch, args.appDir)