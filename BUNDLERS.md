# Deploying QR-Data-Sync WITH A Bundler

This project has non-ESM dependencies, which unfortunately cannot be *bundled* in with your other app code. Modern bundlers unfortunately don't out-of-the-box support configurations that can handle such a situation.

As such, this project provides plugins for Astro, Vite, and Webpack, to take care of the various steps needed to get these non-ESM dependencies into an otherwise bundled web app built by those tools.

## Bundler Plugins

The plugins for Astro, Vite, and Webpack are included in the `bundler-plugins/` directory. They should handle all necessary steps to load the dependencies.

**Note:** You should not need to manually copy any files out of the `dist/bundlers/` directory, as the plugins access the `qr-data-sync` dependency (in `node_modules`) directly to pull the files needed. But for reference, the files these plugins access are:

* `dist/bundlers/qrds.js`

    ESM library module that's suitable for bundling and `import`ing into your web app.

    **Note:** this is *not* the same as `dist/auto/qrds.js`, which is only intended [for web application projects WITHOUT a bundler](NON-BUNDLERS.md)

* `dist/bundlers/qrds-external-bundle.js`

    Non-ESM (plain global .js) bundle of dependencies that must be loaded separately from (and prior to) your app's bundle. Includes the concatenated contents of these individual dependencies:

    - `dist/auto/external/qrcode.js`

### Astro Plugin (aka Integration)

If using Astro 4+, it's strongly suggested to import this library's Astro-plugin to manage the loading of its non-ESM dependencies. Add something like the following to your `astro.config.mjs` file:

```js
import { defineConfig } from "astro/config";

import QRDS from "@lo-fi/qr-data-sync/bundlers/astro";

export default defineConfig({
    // ..

    integrations: [ QRDS(), ],

    vite: {
        plugins: [
            // pulls in some necessary bits of QRDS's vite plugin
            QRDS.vite(),
        ],
    },

    // ..
});
```

In all cases, it copies the `dist/bundlers/qrds-external-bundle.js` file into the `public/` directory of your project root, as well as the `dist/` directory when running a build. It also injects an inline `<script>` element into the `<head>` of all generated pages, which dynamically loads the `/qrds-external-bundle.js` script file (which has all the external dependencies needed).

**Note:** At present, this plugin is not configurable in any way (i.e., calling `QRDS()` above with no arguments). If something about its behavior is not compatible with your Astro project setup -- which can vary widely and be quite complex to predict or support by a basic plugin -- it's recommended you simply copy over the `qr-data-sync/bundler-plugins/astro.mjs` plugin and make necessary changes.

### Vite Plugin

If directly using Vite 5+, it's strongly suggested to import this library's Vite-plugin to manage the loading of its non-ESM dependencies. Add something like the following to your `vite.config.js` file:

```js
import { defineConfig } from "vite";
import QRDS from "qr-data-sync/bundlers/vite";

export default defineConfig({
    // ..

    plugins: [ QRDS() ],

    // ..
});
```

This plugin works for the `vite dev` (dev-server), `vite preview` (also dev-server), and `vite build` modes. In all cases, it copies the `dist/bundlers/qrds-external-bundle.js` file into the `public/` directory of your project root. It also injects a `<script src="/qrds-external-bundle.js"></script>` tag into the markup of the `index.html` file that Vite produces for your app.

**Note:** At present, this plugin is not configurable in any way (i.e., calling `QRDS()` above with no arguments). If something about its behavior is not compatible with your Vite project setup -- which can vary widely and be quite complex to predict or support by a basic plugin -- it's recommended you simply copy over the `qr-data-sync/bundler-plugins/vite.mjs` plugin and make necessary changes.

#### SSR Breakage

An unfortunate gotcha of some tools that wrap Vite (e.g., Nuxt, etc) and do SSR (server-side rendering) is that they *break* a key assumption/behavior of this module's Vite plugin: the HTML injection of `<script src="/qrds-external-bundle.js"></script>`.

As such, you'll likely need to manually add that `<script>` tag to your HTML pages/templates. The Vite plugin still copies that file into the `public/` folder for you, so it should load once the tag is added to your HTML.

### Webpack Plugin

If using Webpack 5+, make sure you're already using the [HTML Webpack Plugin](https://github.com/jantimon/html-webpack-plugin/) to manage building your `index.html` (and/or other HTML pages).

Then import this library's Webpack-plugin to manage the loading of its non-ESM dependencies. Add something like the following to your `webpack.config.js`:

```js
// 'HtmlWebpackPlugin' is a required dependency of the
// qr-data-sync Webpack plugin
import HtmlWebpackPlugin from "html-webpack-plugin";
import QRDS from "qr-data-sync/bundlers/webpack";

export default {
    // ..

    plugins: [
        // required QRDS dependency
        new HtmlWebpackPlugin({
            // ..
        }),

        QRDS()
    ],

    // ..
};
```

This plugin copies the `dist/bundlers/qrds-external-bundle.js` file into the build root (default `dist/`), along with the other bundled files. It also injects a `<script src="qrds-external-bundle.js"></script>` tag into the markup of the `index.html` file (and any other HTML files) that Webpack produces for your app.

**Note:** At present, this plugin is not configurable in any way (i.e., calling `QRDS()` above with no arguments). If something about its behavior is not compatible with your Webpack project setup -- which can vary widely and be quite complex to predict or support by a basic plugin -- it's recommended you simply copy over the `qr-data-sync/bundler-plugins/webpack.mjs` plugin and make necessary changes.

## Import/Usage

To import and use **qr-data-sync** in a *bundled* browser app:

```js
import { send, receive } from "qr-data-sync";
```

When `import`ed like this, Astro, Vite, and Webpack should (via these plugins) properly find and bundle the `dist/bundlers/qrds.mjs` ESM library module with the rest of your app code, hopefully without any further steps necessary.
