# QR Data Sync

[![npm Module](https://badge.fury.io/js/@lo-fi%2fqr-data-sync.svg)](https://www.npmjs.org/package/@lo-fi/qr-data-sync)
[![License](https://img.shields.io/badge/license-MIT-a1356a)](LICENSE.txt)

**QR-Data-Sync** is a browser library with utils for sharing/synchronizing data via "animated" QR codes.

----

[Library Tests (Demo)](https://mylofi.github.io/qr-data-sync/)

----

Any set of data that can be serialized into a string -- such as an object that's JSON-serializable -- can be broken up into a series of QR codes (of equal length, with padding for visual consistency), which can then be displayed in rapid succession, as if the code is "animated".

A camera on another device, with a scanning library designed to read multiple QR codes in succession, can then read these animated QR code "frames", and re-assemble the original data set on the other device.

This is what **QR Data Sync** library supports.

## Deployment / Import

```cmd
npm install @lo-fi/qr-data-sync
```

The [**@lo-fi/qr-data-sync** npm package](https://npmjs.com/package/@lo-fi/qr-data-sync) includes a `dist/` directory with all files you need to deploy **qr-data-sync** (and its dependencies) into your application/project.

If you obtain this library via git instead of npm, you'll need to [build `dist/` manually](#re-building-dist) before deployment.

* **USING A WEB BUNDLER?** (Vite, Webpack, etc) Use the `dist/bundlers/*` files and see [Bundler Deployment](BUNDLERS.md) for instructions.

* Otherwise, use the `dist/auto/*` files and see [Non-Bundler Deployment](NON-BUNDLERS.md) for instructions.

## Sending Data (generating "animated" QR codes)

To generate an "animated" QR code (cycle of frames) that *sends* data, use `send()`:

```js
import { send } from "...";

var sendData = { /* ... */ };
var qrCodeIDOrElement = /* ... */;
var sendOptions = { /* ... */ };

var sendStarted = await send(
    sendData,
    qrCodeIDOrElement,
    sendOptions
);
```

The `send()` call returns a promise that will resolve to `true` if the QR code generation starts successfully (rendering the first frame). Otherwise, it will be rejected (`await` will throw) if sending fails to start, or if the `signal` option cancels the sending before it starts.

### Send Configuration

To configure the sending operation, the first two arguments are *required*:

* `sendData` (any): Any JSON-compatible primitive value (string, number, boolean), or an object/array that can be properly serialized to JSON

* `qrCodeIDOrElement` (string or DOM element): Either a string representing the ID of a DOM element, or the DOM element itself, where the QR codes can be rendered (into the element, as child elements).

    This DOM element should be styled (via CSS, etc) to ensure that it's properly sized for visibility (as big as is practical for the screen), and should be square (same width and height).

    For example, depending on the layout of the page, it may be useful to set the `aspect-ratio` on the element like this:

    ```css
    #qr-codes {
        width: 100%;
        aspect-ratio: 1 / 1;
    }
    ```

Optional configuration can be passed in as properties of an object, as the third argument (`sendOptions` above):

* `onFrameRendered` (function): a callback to receive information for each render of a QR code frame. This is strongly suggested UX-wise for displaying a frame counter (e.g., "Frame 3 / 11").

    Arguments to the callback are:

    - `frameIndex` (integer): The zero-based QR code frame index in the current frame-set

    - `frameCount` (integer): The length of the current frame-set

    - `frameTextChunk` (string): The chunk of string text (from the data being sent) in the current QR frame.

        **Note:** This value does *not* include the header data included in the QR code itself (i.e., `:{frameEncodingVersion}:{dataSetID}:{frameIndex}:{frameCount}:{frameTextChunk}` -- the raw frame encoding format is subject to change in future versions of the library).

    - `dataSetID` (string): A 5-character (hexadecimal) ID that uniquely identifies the frame-set currently being displayed. If the another `send()` is invoked (canceling a previous frameset rendering), this value will change, and any stored data associated with a previous ID should be discarded.

* `signal` (AbortSignal): an [`AbortController.signal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/signal) instance to stop/cancel the sending "animation".

    ```js
    import { send } from "...";

    var cancelToken = new AbortController();
    var sendStarted = await send( /* .. */, { signal: cancelToken.signal });

    // later, to stop the QR code animation rendering:
    cancelToken.abort("Done sending!");
    ```

    **Note:** While `signal` is technically *optional*, it really should be passed in, as it's the only way to cleanly (without JS exceptions) stop the internal QR code generation/animation processing.

* `maxFramesPerSecond` (integer): Controls the attempted time interval for animating QR code frames. The default is `7`, and the allowed range is `2` - `13`.

    **Note:** This setting is only a target maximum, but actual animation rates may be lower depending on CPU processing of QR code generation, etc; it really should not be changed unless there are issues with receiving QR code frames.

* `frameTextChunkSize` (integer): Length of each frame text chunk (with space padding to ensure visual consistency between each QR code). The default is `50`, and the allowed range is `25` - `150`.

    **Note:** This setting should really not be changed unless there are issues with receiving QR code frames (i.e., too small, cameras resolution missing frames, etc).

* `qrCodeSize` (integer): the size (in logical pixels) to render the QR code width/height. The minimum value, if specified, is `150`.

    **Note:** This setting is not responsive (CSS wise), so it really shouldn't be used *unless* the CSS styling of the QR code element is not possible/sufficient.

## Receiving Data (scanning "animated" QR codes)

To scan an "animated" QR code (cycle of frames) that *receives* data, use `receive()`:

```js
import { receive } from "...";

var videoIDorElement = /* ... */;
var receiveOptions = { /* ... */ };

var receiveResult = await receive(
    videoIDorElement,
    receiveOptions
);
```

The `receive()` call returns a promise that will resolve to an object ([`receiveResult` above](#receive-result)) if QR code scanning completes successfully. Otherwise, it will be rejected (`await` will throw) if scanning experiences an issue, or if the `signal` option cancels the receiving before it completes.

### Receive Configuration

To configure the receiving operation, the first arguments is *required*:

* `videoIDorElement` (string or DOM element): Either a string representing the ID of a `<video>` DOM element, or the DOM element itself, where the camera scanner can be rendered for the user to see (for QR code alignment).

    This DOM element should be styled (via CSS, etc) to ensure that it's properly sized for visibility (as big as is practical for the screen).

Optional configuration can be passed in as properties of an object, as the second argument (`receiveOptions` above):

* `onFrameReceived` (function): a callback to receive information for each scanned QR code frame. This is strongly suggested UX-wise for displaying a frame-read counter (e.g., "Frames Read 3 / 11").

    Arguments to the callback are:

    - `framesRead` (integer): How many frames have been read from the current frame-set

    - `frameCount` (integer): The length of the current frame-set

    - `frameIndex` (integer): The zero-based frame index in the current frame-set

    - `frameTextChunk` (string): The chunk of string text (from the data being received) in the current QR frame.

        **Note:** This value does *not* include the header data included in the QR code itself (i.e., `:{frameEncodingVersion}:{dataSetID}:{frameIndex}:{frameCount}:{frameTextChunk}` -- the raw frame encoding format is subject to change in future versions of the library).

    - `dataSetID` (string): A 5-character (hexadecimal) ID that uniquely identifies the frame-set currently being received. If this value changes changes while receiving, it means the sent data changed, and any stored data associated with a previous ID should be discarded.

* `signal` (AbortSignal): an [`AbortController.signal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/signal) instance to stop/cancel the receive scanning.

    ```js
    import { receive } from "...";

    var cancelToken = new AbortController();
    var receiveResult = await receive( /* .. */, { signal: cancelToken.signal });

    // later, to stop the QR code scanning:
    cancelToken.abort("Cancel scanning!");
    ```

    **Note:** While `signal` is technically *optional*, it really should be passed in, as it's the only way to cleanly (without JS exceptions) stop the QR code scanning and release the device's camera.

* `maxScansPerSecond` (integer): Controls how many QR code frames will be attempted to scan per second. The default is `10`, and the allowed range is `2` - `13`.

    **Note:** This setting is only a target maximum, but actual scanning rates may be lower depending on CPU processing of QR code decoding, etc; it really should not be changed unless there are issues with receiving QR code frames.

* `preferredCamera` (string): Controls which camera (if multiple on a device) is preferred/requested. Defaults to `"environment"` (e.g., the outward facing camera on the back of a phone), but [can have other values](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings/facingMode#videofacingmodeenum) such as `"user"` (e.g., the forward facing camera on a phone or laptop).

* `highlightScanRegion` (boolean): Controls whether the yellow/orange brackets are rendered over the camera feed, to hint the user on where to align the QR codes for scanning. Defaults to `true`.

### Receive Result

`receive()` returns a promise that's resolved once a full frame-set is successfully read. Otherwise, it will be rejected (`await` will throw) if a scan error occurs, or the receiving operation is canceled (with `signal`).

If `receive()` completes completes successfully, the return value (`receiveResult` above) will be an object that includes these properties:

* `data` (any): The received data, assumed to be a JSON-compatible value that's automatically `JSON.parse()`d. If parsing fails, the full raw string received will be returned.

* `frameCount` (integer): How many frames were read in the frame-set

* `dataSetID` (string): A 5-character (hexadecimal) ID that uniquely identifies the frame-set that was read.

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
