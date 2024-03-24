# QR Data Sync

[![npm Module](https://badge.fury.io/mylofi/qr-data-sync.svg)](https://www.npmjs.org/package/qr-data-sync)
[![License](https://img.shields.io/badge/license-MIT-a1356a)](LICENSE.txt)

**QR Data Sync** is a browser library with utils for sharing/synchronizing data via "animated" QR codes.

----

[Demo/Tests](https://mylofi.github.io/qr-data-sync/)

----

## Deployment / Import

The [**qr-data-sync** npm package](https://npmjs.com/package/webauthn-local-client) includes a `dist/` directory with all files you need to deploy **qr-data-sync** (and its dependencies) into your application/project.

If you obtain this library via git instead of npm, you'll need to [build `dist/` manually](#re-building-dist) before deployment.

* **USING A WEB BUNDLER?** (vite, webpack, etc) Use the `dist/bundlers/*` files and see [Bundler Deployment](BUNDLERS.md) for instructions.

* Otherwise, use the `dist/auto/*` files and see [Non-Bundler Deployment](NON-BUNDLERS.md) for instructions.

## Re-building `dist/*`

If you need to rebuild the `dist/*` files for any reason, run:

```cmd
# only needed one time
npm install

npm run build:all
```

## Tests

Since the library involves non-automatable behaviors (requiring user intervention on two devices at once), an automated unit-test suite is not included. Instead, a simple interactive browser test page is provided, to run on both devices.

Visit [`https://mylofi.github.io/qr-data-sync/`](https://mylofi.github.io/qr-data-sync/) on each device, and follow instructions in-page from there to perform the interactive tests.

**Note:** You will need two devices to test, and at least one needs a camera.

### Run Locally

To locally run the tests, start the simple static server (no server-side logic):

```cmd
# only needed one time
npm install

npm run test:start
```

Then visit `http://localhost:8080/` in a browser.

## License

[![License](https://img.shields.io/badge/license-MIT-a1356a)](LICENSE.txt)

All code and documentation are (c) 2024 Kyle Simpson and released under the [MIT License](http://getify.mit-license.org/). A copy of the MIT License [is also included](LICENSE.txt).
