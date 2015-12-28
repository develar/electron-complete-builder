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
    "build:osx": "build --build --platform=darwin --sign='Your indentity'",
    "build:win": "build --build --platform=win32",
    "build": "npm run build:osx && npm run build:win"
  }
}
```

In your application `package.json` custom "build" field should be specified:
```json
"build": {
  "app-bundle-id": "your.id",
  "app-category-type": "your.app.category.type",
}
```

This object will be used as source of [electron-packager](https://www.npmjs.com/package/electron-packager) options. You can specify any other options here.