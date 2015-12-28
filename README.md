Complete solution to build ready for distribution and "auto update" installers of your app for OS X and Windows (Linux can be supported too).

[Native application dependencies are supported](http://electron.atom.io/docs/latest/tutorial/using-native-node-modules/).

[electron-builder](https://github.com/loopline-systems/electron-builder),
[https://github.com/maxogden/electron-packager](https://github.com/maxogden/electron-packager) and
[electron-installer-squirrel-windows](https://github.com/mongodb-js/electron-installer-squirrel-windows) are used.

Real project example - [onshape-desktop-shell](https://github.com/develar/onshape-desktop-shell)

Part of your development package.json:
```json
{
  "scripts" : {
    "postinstall": "install-production-deps"
  }
}
```