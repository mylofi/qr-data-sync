import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";


// ********************************

export default QRDS;


// ********************************

function QRDS() {
	var config;
	var qrdsSrcPath;
	var externalBundleSrcPath;
	var externalBundleDestPath;
	var externalBundleCopied = false;

	return {
		name: "vite-plugin-walc",
		enforce: "pre",

		async configResolved(cfg) {
			config = cfg;
			var bundlersDir = path.join(config.root,"node_modules","@lo-fi","qr-data-sync","dist","bundlers");
			qrdsSrcPath = path.join(bundlersDir,"qrds.js");
			externalBundleSrcPath = path.join(bundlersDir,"qrds-external-bundle.js");
			externalBundleDestPath = (
				config.command == "build" ?
					path.join(config.root,config.build.outDir,path.basename(externalBundleSrcPath)) :

				config.command == "serve" ?
					path.join(config.publicDir,path.basename(externalBundleSrcPath)) :

					null
			);
			return copyExternalBundle();
		},
		resolveId(source) {
			// NOTE: this should never be `import`ed
			if (source == "qr-data-sync/bundlers/qrds-external-bundle.js") {
				// ...but if found, mark it as "external" because
				// the contents are non-ESM compatible
				return { id: source, external: true, };
			}
		},
		load(id,opts) {
			if (id == "qr-data-sync") {
				return fs.readFileSync(qrdsSrcPath,{ encoding: "utf8", });
			}
		},

		buildEnd() {
			externalBundleCopied = false;
		},
		transformIndexHtml(html) {
			return [
				{
					tag: "script",
					injectTo: "head-prepend",
					attrs: {
						src: `/${path.basename(externalBundleDestPath)}`,
					},
				},
			];
		},

		// NOTE: ensuring the external-bundle is copied (in case the
		// dest directory hasn't been created earlier in the lifecyle)
		writeBundle: copyExternalBundle,
		buildStart: copyExternalBundle,
	};


	// ****************************

	async function copyExternalBundle() {
		if (
			// need to copy the external bundle?
			!externalBundleCopied &&

			// bundle output path set properly?
			externalBundleDestPath &&

			// bundle file exists?
			fs.existsSync(externalBundleSrcPath) &&

			// destination directory exists?
			fs.existsSync(path.dirname(externalBundleDestPath))
		) {
			try {
				await fsp.copyFile(externalBundleSrcPath,externalBundleDestPath);
				externalBundleCopied = true;
			}
			catch (err) {
				console.log(err);
			}
		}
	}
}
