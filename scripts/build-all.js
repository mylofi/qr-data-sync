#!/usr/bin/env node

"use strict";

var path = require("path");
var fs = require("fs");
var fsp = require("fs/promises");

var micromatch = require("micromatch");
var recursiveReadDir = require("recursive-readdir-sync");
var terser = require("terser");

const PKG_ROOT_DIR = path.join(__dirname,"..");
const SRC_DIR = path.join(PKG_ROOT_DIR,"src");
const MAIN_COPYRIGHT_HEADER = path.join(SRC_DIR,"copyright-header.txt");
const QRDS_SRC = path.join(SRC_DIR,"qrds.js");
const NODE_MODULES_DIR = path.join(PKG_ROOT_DIR,"node_modules");
const QRCODE_SRC = path.join("external","qrcode.js");
const QRSCANNER_SRC = path.join(NODE_MODULES_DIR,"qr-scanner","qr-scanner.min.js");
const QRSCANNER_WORKER_SRC = path.join(NODE_MODULES_DIR,"qr-scanner","qr-scanner-worker.min.js");

const DIST_DIR = path.join(PKG_ROOT_DIR,"dist");
const DIST_AUTO_DIR = path.join(DIST_DIR,"auto");
const DIST_AUTO_EXTERNAL_DIR = path.join(DIST_AUTO_DIR,"external");
const DIST_AUTO_EXTERNAL_QRCODE = path.join(DIST_AUTO_EXTERNAL_DIR,path.basename(QRCODE_SRC));
const DIST_AUTO_EXTERNAL_QRSCANNER = path.join(DIST_AUTO_EXTERNAL_DIR,path.basename(QRSCANNER_SRC));
const DIST_AUTO_EXTERNAL_QRSCANNER_WORKER = path.join(DIST_AUTO_EXTERNAL_DIR,path.basename(QRSCANNER_WORKER_SRC));

const DIST_BUNDLERS_DIR = path.join(DIST_DIR,"bundlers");
const DIST_BUNDLERS_QRDS_FILE = path.join(DIST_BUNDLERS_DIR,path.basename(QRDS_SRC).replace(/\.js$/,".mjs"));
const DIST_BUNDLERS_QRDS_EXTERNAL_BUNDLE_FILE = path.join(DIST_BUNDLERS_DIR,"qrds-external-bundle.js");


main().catch(console.error);


// **********************

async function main() {
	console.log("*** Building JS ***");

	// try to make various dist/ directories, if needed
	for (let dir of [ DIST_DIR, DIST_AUTO_DIR, DIST_BUNDLERS_DIR, DIST_AUTO_EXTERNAL_DIR, ]) {
		if (!(await safeMkdir(dir))) {
			throw new Error(`Target directory (${dir}) does not exist and could not be created.`);
		}
	}

	// read package.json
	var packageJSON = require(path.join(PKG_ROOT_DIR,"package.json"));
	// read version number from package.json
	var version = packageJSON.version;

	// read main src copyright-header text
	var mainCopyrightHeader = await fsp.readFile(MAIN_COPYRIGHT_HEADER,{ encoding: "utf8", });
	// render main copyright header with version and year
	mainCopyrightHeader = (
		mainCopyrightHeader
			.replace(/#VERSION#/g,version)
			.replace(/#YEAR#/g,(new Date()).getFullYear())
	);

	// build src/* files in dist/auto/
	await buildFiles(
		recursiveReadDir(SRC_DIR),
		SRC_DIR,
		DIST_AUTO_DIR,
		prepareFileContents,
		/*skipPatterns=*/[ "**/*.txt", "**/*.json", "**/external" ]
	);

	// build src/qrds.js to bundlers/qrds.mjs
	await buildFiles(
		[ QRDS_SRC, ],
		SRC_DIR,
		DIST_BUNDLERS_DIR,
		(contents,outputPath,filename = path.basename(outputPath)) => prepareFileContents(
			// alter (remove) "external.js" dependencies-import
			// since bundlers handle dependencies differently
			contents.replace(
				/import[^\r\n]*".\/external.js";?/,
				"import QRScanner from \"qr-scanner\""
			),
			outputPath.replace(/\.js$/,".mjs"),
			`bundlers/${filename.replace(/\.js$/,".mjs")}`
		),
		/*skipPatterns=*/[ "**/*.txt", "**/*.json", "**/external" ]
	);

	// handle dependencies
	var [
		qrCodeContents,
	] = await Promise.all([
		fsp.readFile(QRCODE_SRC,{ encoding: "utf8", }),
	]);

	// build qrds-external-bundle.js
	var qrdsExternalBundleContents = [
		`/*! ${path.basename(QRCODE_SRC)} */`, await minifyJS(qrCodeContents,/*esModuleFormat=*/false),
	].join("\n");

	await Promise.all([
		// bundlers/qrds-external-bundle.js (for bundlers)
		fsp.writeFile(
			DIST_BUNDLERS_QRDS_EXTERNAL_BUNDLE_FILE,
			qrdsExternalBundleContents,
			{ encoding: "utf8", }
		),
		fsp.writeFile(
			DIST_AUTO_EXTERNAL_QRCODE,
			qrCodeContents,
			{ encoding: "utf8", }
		),
		fsp.copyFile(
			QRSCANNER_SRC,
			DIST_AUTO_EXTERNAL_QRSCANNER
		),
		fsp.copyFile(
			QRSCANNER_WORKER_SRC,
			DIST_AUTO_EXTERNAL_QRSCANNER_WORKER
		),
	]);

	console.log("Complete.");


	// ****************************

	async function prepareFileContents(contents,outputPath,filename = path.basename(outputPath)) {
		// JS file (to minify)?
		if (/\.[mc]?js$/i.test(filename)) {
			contents = await minifyJS(contents);
		}

		// add copyright header
		return {
			contents: `${
				mainCopyrightHeader.replace(/#FILENAME#/g,filename)
			}\n${
				contents
			}`,

			outputPath,
		};
	}
}

async function buildFiles(files,fromBasePath,toDir,processFileContents,skipPatterns) {
	for (let fromPath of files) {
		// should we skip copying this file?
		if (matchesSkipPattern(fromPath,skipPatterns)) {
			continue;
		}
		let relativePath = fromPath.slice(fromBasePath.length);
		let outputPath = path.join(toDir,relativePath);
		let outputDir = path.dirname(outputPath);

		if (!(fs.existsSync(outputDir))) {
			if (!(await safeMkdir(outputDir))) {
				throw new Error(`While copying src/* to dist/, directory (${outputDir}) could not be created.`);
			}
		}

		let contents = await fsp.readFile(fromPath,{ encoding: "utf8", });
		({ contents, outputPath, } = await processFileContents(contents,outputPath));

		await fsp.writeFile(outputPath,contents,{ encoding: "utf8", });
	}
}

async function minifyJS(contents,esModuleFormat = true) {
	let result = await terser.minify(contents,{
		mangle: {
			keep_fnames: true,
		},
		compress: {
			keep_fnames: true,
		},
		output: {
			comments: /^!/,
		},
		module: esModuleFormat,
	});
	if (!(result && result.code)) {
		if (result.error) throw result.error;
		else throw result;
	}
	return result.code;
}

function matchesSkipPattern(pathStr,skipPatterns) {
	if (skipPatterns && skipPatterns.length > 0) {
		return (micromatch(pathStr,skipPatterns).length > 0);
	}
}

async function safeMkdir(pathStr) {
	if (!fs.existsSync(pathStr)) {
		try {
			await fsp.mkdir(pathStr,0o755);
			return true;
		}
		catch (err) {}
		return false;
	}
	return true;
}
