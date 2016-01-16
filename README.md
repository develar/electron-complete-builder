Complete solution to build ready for distribution and "auto update" installers of your app for OS X and Windows (Linux can be supported too).



[Native application dependencies](http://electron.atom.io/docs/latest/tutorial/using-native-node-modules/) are supported.

[electron-builder](https://github.com/loopline-systems/electron-builder),
[electron-packager](https://github.com/maxogden/electron-packager) and
[electron-installer-squirrel-windows](https://github.com/mongodb-js/electron-installer-squirrel-windows) are used under the hood.

Real project example — [onshape-desktop-shell](https://github.com/develar/onshape-desktop-shell).

Part of your development `package.json`:
```json
{
  "scripts" : {
    "postinstall": "install-app-deps",
    "pack:osx": "build --platform=darwin",
    "pack:win": "build --platform=win32",
    "pack": "npm run pack:osx && npm run pack:win",
    "build:osx": "build --build --platform=darwin --sign='Your identity'",
    "build:win": "build --build --platform=win32",
    "build": "npm run build:osx && npm run build:win"
  }
}
```

In your application `package.json` custom "build" field should be specified:
```json
"build": {
  "app-bundle-id": "your.id",
  "app-category-type": "your.app.category.type"
}
```

This object will be used as source of [electron-packager](https://www.npmjs.com/package/electron-packager) options. You can specify any other options here.

# Auto Update
electron-complete-builder produces all required artifacts:

* .dmg: OS X installer, required for OS X user to initial install.
* -mac.zip: required for Squirrel.Mac.
* .exe and -x64.exe: Windows installer, required for Windows user to initial install. Please note — [your app must handle Squirrel.Windows events](https://github.com/mongodb-js/electron-installer-squirrel-windows#integration). See [real example](https://github.com/develar/onshape-desktop-shell/blob/master/src/WinSquirrelStartupEventHandler.ts). 
* .full-nupkg: required for Squirrel.Windows.

You need to deploy somewhere [releases/downloads server](https://github.com/GitbookIO/nuts).

In general, there is a possibility to setup it as a service for all (it is boring and stupid to setup own if cloud service is possible). May be I will setup it soon (feel free to file an issue to track progress). It is safe since you should sign your app in any case (so, even if server will be compromised, users will not be affected because OS X will just block unsigned/unidentified app).

# Code signing
On a development machine set environment variable `CSC_NAME` to your identity (recommended). Or pass `--sign` parameter.
```
export CSC_NAME="Developer ID Application: Your Name (code)"
```

## Travis
... not yet works, in progress ...

To sign app on Travis server:

1. [Export](https://developer.apple.com/library/ios/documentation/IDEs/Conceptual/AppDistributionGuide/MaintainingCertificates/MaintainingCertificates.html#//apple_ref/doc/uid/TP40012582-CH31-SW7) certificate,
2. Upload *.p12` file (e.g. on [Google Drive](http://www.syncwithtech.org/p/direct-download-link-generator.html)),
3. [Set](https://docs.travis-ci.com/user/environment-variables/#Encrypted-Variables) `CSC_LINK` and `CSC_KEY_PASSWORD` environment variables:
```
travis encrypt "CSC_LINK='https://drive.google.com/uc?export=download&id=***'" --add
travis encrypt 'CSC_KEY_PASSWORD=beAwareAboutBashEscaping!!!' --add
```

# Windows
Hint: You don't need a windows machine to build windows artifacts — use [AppVeyor](http://www.appveyor.com/). See  [sample appveyor.yml to build Electron app on windows](https://github.com/develar/onshape-desktop-shell/blob/master/appveyor.yml).