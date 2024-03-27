// dynamically load external dependencies (non-bundlers only)
// NOTE: this `import` is replaced in "bundlers/qrds.js",
//       which is used with bundlers
import { QRScanner, QRCode, } from "./external.js";


// ********************************

const frameEncodingVersion = 1;
var cancelReceive;
var cancelSend;


// ********************************

export { receive, send, };


// ********************************

function receive(
	// required:
	videoIDorElement,

	// optional config options:
	{
		maxScansPerSecond = 10,				// range: 2 - 13
		preferredCamera = "environment",
		highlightScanRegion = true,
		onFrameReceived = () => {},
		signal: cancelReceiveSignal = null,
		...otherScannerOptions
	} = {}
) {
	// scanner still active from previous call?
	if (cancelReceive != null) {
		cancelReceive("Canceled.");
		cancelReceive = null;
	}

	var videoEl = (
		typeof videoIDorElement == "string" ?
			document.getElementById(videoIDorElement) :
			videoIDorElement
	);
	if (!(
		videoEl &&
		typeof videoEl == "object" &&
		videoEl instanceof HTMLVideoElement
	)) {
		throw new Error("Must specify <video>, by element or by ID");
	}

	maxScansPerSecond = Math.min(Math.max(maxScansPerSecond,2),13);

	var currentDataSetID = null;
	var framesRead = 0;
	var frameCount = 0;
	var scannedFrames = [];
	var scanner;
	var onComplete;
	var pr = new Promise((res,rej) => {
		onComplete = res;
		cancelReceive = rej;
		if (cancelReceiveSignal != null) {
			cancelReceiveSignal.throwIfAborted();
			cancelReceiveSignal.addEventListener("abort",onAbort,false);
		}

		scanner = new QRScanner(videoEl,onDecoded,{
			onDecodeError,
			maxScansPerSecond,
			preferredCamera,
			highlightScanRegion,
			...otherScannerOptions
		});
		scanner.start();
	});
	pr.catch(cleanup).finally(cleanup);
	return pr;


	// ********************************

	function onDecoded(result) {
		var decodedData = result.data;
		if (/^:\d+:[a-fA-F0-9]+:\d+:\d+:.+/.test(decodedData)) {
			let { dataSetID, frameIndex, frameCount, frameTextChunk, } = decodeFrameText(decodedData);

			// decoding frame text as expected?
			if (dataSetID != null) {
				if (currentDataSetID) {
					// frame-set has changed?
					if (currentDataSetID != dataSetID) {
						// reset scanned frames
						scannedFrames.length = 0;
					}
				}
				else {
					currentDataSetID = dataSetID;
				}
				scannedFrames[frameIndex] = frameTextChunk;
				framesRead = scannedFrames.filter(Boolean).length;

				onFrameReceived(framesRead,frameCount,frameIndex,frameTextChunk,currentDataSetID);

				// all expected frames read?
				if (framesRead == frameCount) {
					try {
						let data = scannedFrames.join("");
						try { data = JSON.parse(data); } catch (err) {}

						onComplete({
							dataSetID: currentDataSetID,
							frameCount,
							data,
						});
					}
					catch (err) {
						let cb = cancelReceive;
						cleanup();
						if (cb) cb(err);
					}
				}
			}
		}
	}

	function onAbort(reason) {
		var cb = cancelReceive;
		cleanup();
		if (cb) cb(reason);
	}

	function cleanup() {
		if (scanner != null) {
			scanner.stop();
		}
		if (cancelReceiveSignal != null) {
			cancelReceiveSignal.removeEventListener("abort",onAbort,false);
		}
		scanner = onComplete = cancelReceive = cancelReceiveSignal = null;
	}

	async function onDecodeError(err) {
		if (!/no qr code found/i.test(err)) {
			let cb = cancelReceive;
			cleanup();
			if (cb) cb(err);
		}
	}
}

function send(
	// required:
	data,
	qrCodeIDorElement,

	// optional config options:
	{
		maxFramesPerSecond = 7,				// range: 2 - 13
		frameTextChunkSize = 50, 			// range: 25 - 150
		qrCodeSize = null,					// minimum: 150 (pixels)
		onFrameRendered = () => {},
		signal: cancelSendSignal = null,
	} = {}
) {
	// QR code renderer still active?
	if (cancelSend != null) {
		cancelSend("Canceled.");
		cancelSend = null;
	}

	if (data && typeof data == "object") {
		try { data = JSON.stringify(data); } catch (err) {}
	}

	// validate options
	if (!(
		typeof data == "string" &&
		data.length > 0
	)) {
		throw new Error("Must specify data as a string or a JSON-compatible object");
	}
	var qrCodeEl = (
		typeof qrCodeIDorElement == "string" ?
			document.getElementById(qrCodeIDorElement) :
			qrCodeIDorElement
	);
	if (!(
		qrCodeEl &&
		typeof qrCodeEl == "object" &&
		qrCodeEl instanceof HTMLElement
	)) {
		throw new Error("Must specify parent DOM element for QR code rendering, by element or by ID");
	}

	var qrCodeRender;
	var qrCodeDim = qrCodeEl.getBoundingClientRect();
	var qrCodeImgEl;
	var qrCodeCnvEl;
	var whichActiveElem = null;
	var frames = [];
	var framesLen = 0;
	var frameCache = [];
	var intvDelay = Math.min(Math.max(Math.ceil(1000 / Number(maxFramesPerSecond) || 1),75),500);
	var intv;
	var imgLoadPr;
	var imgLoadTrigger;

	frameTextChunkSize = Math.min(Math.max(Math.floor(Number(frameTextChunkSize) || 0),25),150);

	var cancelSend;
	return (new Promise((res,rej) => {
		cancelSend = rej;
		if (cancelSendSignal != null) {
			cancelSendSignal.throwIfAborted();
			cancelSendSignal.addEventListener("abort",onAbort,false);
		}
		generateFrames(data).then(() => res(true),cleanup);
	}));


	// ********************************

	async function generateFrames(data) {
		if (intv != null) {
			clearTimeout(intv);
			intv = null;
		}

		// break the JSON string into uniform chunks
		frames = data.split(new RegExp(`([^]{${frameTextChunkSize}})`)).filter(Boolean);
		framesLen = frames.length;
		var frameLengthDigits = String(framesLen).length;

		// prepare frame chunks list with hashID/index/frame-count headers
		var dataSetID = (
			buf2hex(
				await crypto.subtle.digest("SHA-1",(new TextEncoder()).encode(data))
			)
			.slice(0,5)
		);
		frames = (
			frames.map((text,idx) => (
				`:${[
					frameEncodingVersion,
					dataSetID,
					String(idx).padStart(frameLengthDigits,"0"),
					framesLen,
					text.padEnd(frameTextChunkSize," "),
				].join(":")}`
			))
		);
		frameCache.length = 0;

		return rotateFrame();
	}

	async function rotateFrame() {
		if (
			// only one frame?
			framesLen == 1 ||

			// still generating all the frames?
			//
			// NOTE: the reason for this "- 1" logic below is
			// this timer-based looping caches a frame entry
			// (previous title/src) on each NEXT iteration,
			// right before rendering that frame (title/src),
			// because we need to make sure the image actually
			// rendered to be able to read its `src` property
			// to cache it
			frameCache.length < (framesLen - 1)
		) {
			// first (overall) frame to render?
			if (!qrCodeRender) {
				let frameText = frames.shift();

				// initialize the QR code renderer
				qrCodeRender = new QRCode(qrCodeEl,{
					text: frameText,
					colorDark : "#000000",
					colorLight : "#ffffff",
					width: Math.max(qrCodeSize || qrCodeDim.width || 0, 150),
					height: Math.max(qrCodeSize || qrCodeDim.height || 0, 150),
					correctLevel : QRCode.CorrectLevel.H,
				});
				qrCodeImgEl = qrCodeEl.querySelector("img");
				qrCodeCnvEl = qrCodeEl.querySelector("canvas");

				qrCodeImgEl.addEventListener("load",onImgLoad,false);

				let { dataSetID, frameIndex, frameCount, frameTextChunk, } = decodeFrameText(frameText);
				if (dataSetID != null) {
					onFrameRendered(frameIndex,frameCount,frameTextChunk,dataSetID);
				}
			}
			// QR code renderer already present, so just
			// update the rendered image
			else {
				// NOT first frame of (re-)generated frames list?
				if (frames.length < framesLen) {
					// need to initially detect which element (img vs canvas)
					// the qr-code library is rendering with?
					if (whichActiveElem == null) {
						whichActiveElem = (
							(qrCodeImgEl.style.display != "none" && qrCodeCnvEl.style.display == "none") ? "img" :
							(qrCodeImgEl.style.display == "none" && qrCodeCnvEl.style.display != "none") ? "canvas" :
							null
						);

						// if detection failed, we have to bail
						if (whichActiveElem == null) {
							let cb = cancelSend;
							cleanup();
							if (cb) {
								return void cancelSend("QR code generation does not seem to work properly on this device.");
							}
						}
					}

					// cache previous frame's title/src
					frameCache.push([
						qrCodeEl.title,
						(
							whichActiveElem == "img" ?
								qrCodeImgEl.src :
								qrCodeCnvEl.toDataURL("image/png")
						)
					]);
				}

				let frameText = frames.shift();
				qrCodeRender.makeCode(frameText);
				let { dataSetID, frameIndex, frameCount, frameTextChunk, } = decodeFrameText(frameText);
				if (dataSetID != null) {
					onFrameRendered(frameIndex,frameCount,frameTextChunk,dataSetID);
				}
			}
		}
		// all frames generated, so now process rendering
		// via the frame (title/src) cache
		else {
			// still need to cache the final frame (title/src)?
			if (frameCache.length == (framesLen - 1)) {
				frameCache.push([
					qrCodeEl.title,
					(
						whichActiveElem == "img" ?
							qrCodeImgEl.src :
							qrCodeCnvEl.toDataURL("image/png")
					)
				]);
			}

			// rotate frame cache
			let frameEntry = frameCache.shift();
			frameCache.push(frameEntry);

			// render current frame (title/src)
			qrCodeEl.title = frameEntry[0];
			qrCodeImgEl.src = frameEntry[1];
			if (whichActiveElem == "canvas") {
				await waitImage();
				qrCodeCnvEl.getContext("2d").drawImage(qrCodeImgEl,0,0);
			}

			let { dataSetID, frameIndex, frameCount, frameTextChunk, } = decodeFrameText(frameEntry[0]);
			if (dataSetID != null) {
				onFrameRendered(frameIndex,frameCount,frameTextChunk,dataSetID);
			}
		}

		// need to rotate through multiple frames?
		if (framesLen > 1) {
			intv = setTimeout(rotateFrame,intvDelay);
		}
	}

	function onImgLoad() {
		if (imgLoadTrigger != null) {
			imgLoadTrigger();
		}
		else {
			imgLoadPr = Promise.resolve();
		}
	}

	function waitImage() {
		return (
			qrCodeImgEl.complete ||
			imgLoadPr ||
			(
				imgLoadPr = new Promise(r => { imgLoadTrigger = r; })
				.then(() => { imgLoadPr = imgLoadTrigger = null; })
				.catch(()=>{})
			)
		);
	}

	function onAbort(reason) {
		var cb = cancelSend;
		cleanup();
		if (cb) {
			cb(reason);
		}
	}

	function cleanup() {
		if (intv != null) {
			clearTimeout(intv);
			intv = null;
		}
		if (cancelSendSignal != null) {
			cancelSendSignal.removeEventListener("abort",onAbort,false);
		}
		cancelSend = cancelSendSignal = null;
	}
}

function decodeFrameText(frameText) {
	var [ , encodedVersion, ] = frameText.match(/^:(\d+):/) || [];
	encodedVersion = Number(encodedVersion) || null;

	// expected version of frame encoding?
	if (encodedVersion == frameEncodingVersion) {
		let [ , dataSetID, frameIndex, frameCount, frameTextChunk, ] = (
			frameText.match(/^:\d+:([a-fA-F0-9]{5}):(\d+):(\d+):([^]+)$/)
		);
		frameIndex = Number(frameIndex);
		frameCount = Number(frameCount);
		return { dataSetID, frameIndex, frameCount, frameTextChunk, };
	}

	// decoding failed (unexpected format, mismatched version, etc)
	return {};
}

// Adapted from: https://stackoverflow.com/a/40031979/228852
function buf2hex(buffer) {
	return [ ...new Uint8Array(buffer), ]
		.map(x => x.toString(16).padStart(2,"0"))
		.join("");
}
