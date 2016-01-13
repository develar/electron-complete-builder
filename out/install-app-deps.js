#! /usr/bin/env node
"use strict";
var util_1 = require("./util");
const args = require("command-line-args")(util_1.commonArgs.concat({
    name: "arch",
    type: String,
})).parse();
util_1.installDependencies(args.arch, args.appDir);
//# sourceMappingURL=install-app-deps.js.map