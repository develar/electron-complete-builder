Complete solution to build ready for distribution and "auto update" installers of your app for OS X and Windows (Linux can be supported too).

* [Native application dependencies](http://electron.atom.io/docs/latest/tutorial/using-native-node-modules/) compilation (only if two-package.json project layout used).
* [Auto Update](#auto-update) ready application packaging.
* [Code Signing](#code-signing) on a CI server or development machine.

[electron-packager](https://github.com/maxogden/electron-packager),
[electron-builder](https://github.com/loopline-systems/electron-builder) and
[electron-installer-squirrel-windows](https://github.com/mongodb-js/electron-installer-squirrel-windows) are used under the hood.

Real project example — [onshape-desktop-shell](https://github.com/develar/onshape-desktop-shell).

Part of your development `package.json`:
```json
{
  "scripts" : {
    "postinstall": "install-app-deps",
    "pack": "build",
    "build": "build --dist"
  }
}
```

In your application `package.json` custom `build` field must be specified:
```json
"build": {
  "app-bundle-id": "your.id",
  "app-category-type": "your.app.category.type"
}
```

This object will be used as source of [electron-packager](https://www.npmjs.com/package/electron-packager) options. You can specify any other options here.

Standard fields `name`, `description`, `version` and `author` are required in the application `package.json`.
`repository` is required to publish artifacts to GitHub Releases.

# Auto Update
electron-complete-builder produces all required artifacts:

* `.dmg`: OS X installer, required for OS X user to initial install.
* `-mac.zip`: required for Squirrel.Mac.
* `.exe` and `-x64.exe`: Windows installer, required for Windows user to initial install. Please note — [your app must handle Squirrel.Windows events](https://github.com/mongodb-js/electron-installer-squirrel-windows#integration). See [real example](https://github.com/develar/onshape-desktop-shell/blob/master/src/WinSquirrelStartupEventHandler.ts). 
* `.full-nupkg`: required for Squirrel.Windows.

You need to deploy somewhere [releases/downloads server](https://github.com/GitbookIO/nuts).

In general, there is a possibility to setup it as a service for all (it is boring and stupid to setup own if cloud service is possible). May be I will setup it soon (feel free to file an issue to track progress). It is safe since you should sign your app in any case (so, even if server will be compromised, users will not be affected because OS X will just block unsigned/unidentified app).

# Code signing
On a development machine set environment variable `CSC_NAME` to your identity (recommended). Or pass `--sign` parameter.
```
export CSC_NAME="Developer ID Application: Your Name (code)"
```

## Travis
To sign app on Travis server:

1. [Export](https://developer.apple.com/library/ios/documentation/IDEs/Conceptual/AppDistributionGuide/MaintainingCertificates/MaintainingCertificates.html#//apple_ref/doc/uid/TP40012582-CH31-SW7) certificate. [Strong password](http://security.stackexchange.com/a/54773) must be used. Consider to not use special characters (for bash) because “*values are not escaped when your builds are executed*”.
2. Upload `*.p12` file (e.g. on [Google Drive](http://www.syncwithtech.org/p/direct-download-link-generator.html)).
3. [Set](https://docs.travis-ci.com/user/environment-variables/#Encrypted-Variables) `CSC_LINK` and `CSC_KEY_PASSWORD` environment variables:
```
travis encrypt "CSC_LINK='https://drive.google.com/uc?export=download&id=***'" --add
travis encrypt 'CSC_KEY_PASSWORD=beAwareAboutBashEscaping!!!' --add
```

## AppVeyor
Windows code siging is not yet supported in a smart way, you need to pass corresponding [electron-installer-squirrel-windows](https://github.com/mongodb-js/electron-installer-squirrel-windows) options [directly](https://github.com/develar/electron-complete-builder/pull/1).

# Windows
Hint: You don't need a windows machine to build windows artifacts — use [AppVeyor](http://www.appveyor.com/). See  [sample appveyor.yml to build Electron app on windows](https://github.com/develar/onshape-desktop-shell/blob/master/appveyor.yml).
