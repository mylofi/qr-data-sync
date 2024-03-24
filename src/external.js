import QRScanner from "./external/qr-scanner.min.js";


// load external dependencies via <script> tag injection
await Promise.all([
	loadScript(import.meta.resolve("./external/qrcode.js")),
]);
var QRCode = window.QRCode;


export { QRScanner, QRCode };


// ********************************

function loadScript(filepath) {
	if (typeof document == "undefined") return;
	var loadComplete = null;
	var pr = new Promise(res => loadComplete = res);
	var script = document.createElement("script");
	script.addEventListener("load",function onload(){
		if (loadComplete) loadComplete();
		if (script) script.removeEventListener("load",onload,false);
		loadComplete = pr = script = null;
	},false);
	script.async = true;
	script.src = filepath;
	document.body.appendChild(script);
	return pr;
}
