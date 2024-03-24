import { QRScanner, QRCode, } from "./external.js";

export { todo };

function todo() {
	console.log("TODO",QRScanner.name,QRCode.name);
}
