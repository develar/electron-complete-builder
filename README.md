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
    "postinstall": "install-app-deps"
  }
}
```

In your application package.json custom "build" field should be specified:
```json
"build": {
  "app-bundle-id": "org.develar.onshape",
  "app-category-type": "public.app-category.graphics-design",
}
```

This object will be used as source of (electron-packager)[https://www.npmjs.com/package/electron-packager] options. You can specify any other options here.