import {
	receive,
	send,
}
// note: this module specifier comes from the import-map
//    in index.html; swap "src" for "dist" here to test
//    against the dist/* files
from "qr-data-sync/src";


// ********************************

var sendBtn;
var receiveBtn;
var receivedDataEl;

if (document.readyState == "loading") {
	document.addEventListener("DOMContentLoaded",ready,false);
}
else {
	ready();
}


// ********************************

function ready() {
	sendBtn = document.getElementById("send-btn");
	receiveBtn = document.getElementById("receive-btn");
	receivedDataEl = document.getElementById("received-data");

	sendBtn.addEventListener("click",promptSendData,false);
	receiveBtn.addEventListener("click",promptReceiveData,false);
}

async function promptSendData() {
	var result = await Swal.fire({
		title: "Send Data",
		html: `
			<p>
				<label>
					Name:
					<input type="text" id="send-name" class="swal2-input">
				</label>
			</p>
			<p>
				<label>
					Note:
					<input type="text" id="send-note" class="swal2-input">
				</label>
			</p>
			<p>
				<label>
					<input type="checkbox" id="send-include-random-string" class="swal2-checkbox">
					Include random string
				</label>
			</p>
		`,
		showConfirmButton: true,
		confirmButtonText: "Start Sending...",
		confirmButtonColor: "darkslateblue",
		showCancelButton: true,
		cancelButtonColor: "darkslategray",

		allowOutsideClick: true,
		allowEscapeKey: true,

		didOpen(popupEl) {
			var sendNameEl = document.getElementById("send-name");
			var sendNoteEl = document.getElementById("send-note");
			var sendIncludeRandomStringEl = document.getElementById("send-include-random-string");
			sendNameEl.focus();
		},

		async preConfirm() {
			var sendNameEl = document.getElementById("send-name");
			var sendNoteEl = document.getElementById("send-note");
			var sendIncludeRandomStringEl = document.getElementById("send-include-random-string");

			var sendName = sendNameEl.value.trim();
			var sendNote = sendNoteEl.value.trim();
			var sendIncludeRandomString = sendIncludeRandomStringEl.checked;

			if (!sendName) {
				Swal.showValidationMessage("Please enter your name.");
				return false;
			}
			if (!sendNote) {
				Swal.showValidationMessage("Please enter a note.");
				return false;
			}

			return { sendName, sendNote, sendIncludeRandomString, };
		},
	});

	if (result.isConfirmed) {
		return showQRCodes(
			result.value.sendName,
			result.value.sendNote,
			result.value.sendIncludeRandomString ? randomString(100) : null
		);
	}
}

async function showQRCodes(name,note,randomString) {
	var data = {
		senderName: name,
		senderNote: note,
		...(randomString != null ? { senderRandomString: randomString, } : null),
	};

	var closing = false;
	var cancelToken = new AbortController();
	var qrDataSetIDEl;
	var qrFrameIndexEl;
	var qrFrameCountEl;

	await Swal.fire({
		title: "Sending Data...",
		html: `
			<p>
				Data Set ID: <span id="qr-data-set-id">..</span>
			</p>
			<p>
				Frame:
				<span id="qr-frame-index">0</span> /
				<span id="qr-frame-count">0</span>
			</p>

			<div id="qr-codes"></div>
		`,
		showConfirmButton: true,
		confirmButtonText: "Done",
		confirmButtonColor: "darkslateblue",
		showCancelButton: false,

		allowOutsideClick: true,
		allowEscapeKey: true,

		async didOpen(popupEl) {
			qrDataSetIDEl = document.getElementById("qr-data-set-id");
			qrFrameIndexEl = document.getElementById("qr-frame-index");
			qrFrameCountEl = document.getElementById("qr-frame-count");

			try {
				await send({
					data,
					qrCodeIDorElement: "qr-codes",
					onFrameRendered,
					signal: cancelToken.signal,
				});
			}
			catch (err) {
				if (!closing) {
					Swal.showValidationMessage(err.toString());
					console.log(err);
				}
			}
		},

		willClose() {
			closing = true;
			cancelToken.abort("Closing.");
			qrDataSetIDEl = qrFrameIndexEl = qrFrameCountEl = cancelToken = null;
		},
	});


	// ********************************

	function onFrameRendered(dataSetID,frameIndex,frameCount) {
		qrDataSetIDEl.innerText = dataSetID;
		qrFrameIndexEl.innerText = String(frameIndex + 1);
		qrFrameCountEl.innerText = frameCount;
	}
}

async function promptReceiveData() {
	var closing = false;
	var cancelToken = new AbortController();
	var qrDataSetIDEl;
	var qrFrameIndexEl;
	var qrFrameCountEl;

	await Swal.fire({
		title: "Receiving Data...",
		html: `
			<p>
				Data Set ID: <span id="qr-data-set-id">..</span>
			</p>
			<p>
				Frame:
				<span id="qr-frame-index">0</span> /
				<span id="qr-frame-count">0</span>
			</p>

			<div id="qr-scanner-display">
				<video></video>
			</div>
		`,
		showConfirmButton: true,
		confirmButtonText: "Done",
		confirmButtonColor: "darkslateblue",
		showCancelButton: false,

		allowOutsideClick: true,
		allowEscapeKey: true,

		async didOpen(popupEl) {
			qrDataSetIDEl = document.getElementById("qr-data-set-id");
			qrFrameIndexEl = document.getElementById("qr-frame-index");
			qrFrameCountEl = document.getElementById("qr-frame-count");
			var qrScannerDisplayEl = document.getElementById("qr-scanner-display");
			var videoEl = qrScannerDisplayEl.querySelector("video");

			try {
				let {
					frameSetID,
					frameCount,
					data,
				} = await receive({
					videoIDorElement: videoEl,
					onFrameReceived,
					signal: cancelToken.signal,
				});
				closing = true;
				Swal.close();

				// render received data
				renderReceivedData(data);
			}
			catch (err) {
				if (!closing) {
					Swal.showValidationMessage(err.toString());
					console.log(err);
				}
			}
		},

		willClose() {
			closing = true;
			cancelToken.abort("Closing.");
			qrDataSetIDEl = qrFrameIndexEl = qrFrameCountEl = cancelToken = null;
		},
	});


	// ********************************

	function onFrameReceived(dataSetID,frameIndex,frameCount) {
		qrDataSetIDEl.innerText = dataSetID;
		qrFrameIndexEl.innerText = String(frameIndex + 1);
		qrFrameCountEl.innerText = frameCount;
	}
}

function renderReceivedData(data) {
	var rawData = (
		typeof data == "string" ? data : JSON.stringify(data)
	);
	var { senderName = "n/a", senderNote = "n/a", senderRandomString, } = (
		typeof data != "string" ? data : {}
	);

	var li = document.createElement("li");
	li.innerHTML = `
		<strong>${senderName}</strong>: ${senderNote}
		(<small>${rawData}</small>)
	`;
	if (receivedDataEl.children.length > 0) {
		receivedDataEl.insertBefore(li,receivedDataEl.children[0]);
	}
	else {
		receivedDataEl.appendChild(li);
	}

	receivedDataEl.scrollIntoView({ behavior: "smooth", block: "center", });
}

// NOTE: this is intentionally a quick-n-dirty random string
// generator just for demo purposes in these tests; it's not
// cryptographically secure
function randomString(length) {
	var rv = crypto.getRandomValues(new Uint8Array(length));
	return btoa(String.fromCharCode.apply(null,rv));
}
