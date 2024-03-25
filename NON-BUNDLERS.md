# Deploying QR-Data-Sync WITHOUT A Bundler

To use this library directly -- i.e., in a classic/vanilla web project without a modern bundler tool -- make a directory for it (e.g., `qr-data-sync/`) in your browser app's JS assets directory.

Then copy over all `dist/auto/*` contents, as-is:

* `dist/auto/qrds.js`

    **Note:** this is *not* the same as `dist/bundlers/qrds.js`, which is only intended [for web application projects WITH a bundler](BUNDLERS.md)

* `dist/auto/external.js`

    This is an *auto-loader* that dynamically loads some of the `external/*` dependencies via `<script>`-element injection into the DOM (and others with `import`). `dist/auto/qrds.js` imports and activates this loader automatically.

* `dist/auto/external/*` (preserve the whole `external/` sub-directory):
    - `qrcode.js`
    - `qr-scanner.min.js`
    - `qr-scanner-worker.min.js`

## Import/Usage

To import and use **qr-data-sync** in a *non-bundled* browser app:

```js
import { todo } from "/path/to/js-assets/qr-data-sync/qrds.js";
```

The library's dependencies will be auto-loaded (via `external.js`).

## Using Import Map

If your **non-bundled** browser app has an [Import Map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap), you can improve the `import` by adding an entry for this library:

```html
<script type="importmap">
{
    "imports": {
        "qr-data-sync": "/path/to/js-assets/qr-data-sync/qrds.js"
    }
}
</script>
```

Then you'll be able to `import` the library in a more friendly/readable way:

```js
import { todo } from "qr-data-sync";
```
