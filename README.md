# MAILA SDK (Pixelblot Recorder)

Use this SDK to embed MAILA on any website. It captures **pointer activity** (mouse/touch/stylus via `pointermove`) in **10s segments** and sends them to the backend for ingest + prediction.

## Components you can use

- **Recorder** (`pixelblot-recorder.js`) — the main client SDK for capturing pointer data, segmenting, and sending batches.
- **Example page** (`example.html`) — a ready-to-run integration demo with configurable backend URL and user fields.
- **Backend endpoints** — required server routes:
  - `POST /exp_main` for ingest
  - `POST /predict` for predictions

## Quick start (script tag)

1) Host `pixelblot-recorder.js` somewhere reachable (or serve it from your own site).

2) Embed:

```html
<script src="https://YOUR_HOST/pixelblot-recorder.js"></script>
<script>
  const recorder = PixelblotRecorder.createRecorder({
    endpoint: "http://localhost:8000/exp_main",
    predictEndpoint: "http://localhost:8000/predict",
    userAlias: "N/A",
    userInfo: "N/A",
    modelGroup: "draw", // forces draw models by emitting segment_id >= 500
    segmentMs: 10_000,
    flushMs: 1_000,
  });

  recorder.start();

  // Later (after some segments have been recorded):
  // recorder.predict().then(console.log);

  // Start a new session (new session_id, same user_id by default):
  // recorder.newSession();
</script>
```

## Example page controls

The `example.html` buttons map directly to SDK methods:

- **Start recording** → `recorder.start()`
- **Stop** → `recorder.stop()`
- **Predict** → `recorder.predict()` (flushes pending events, then calls `/predict`)
- **New session** → `recorder.newSession()` (rotates `session_id`, keeps `user_id` by default)

The example inputs update the recorder config before starting:

- **Backend base URL** → `endpoint` and `predictEndpoint`
- **User alias** → `userAlias` (emitted as `user_alias`)
- **Additional info** → `userInfo` (emitted as `user_info`)
- **Model group** → `modelGroup`

## SDK configuration

Common options for `PixelblotRecorder.createRecorder({...})`:

- `endpoint` (string) — ingest endpoint for events.
- `predictEndpoint` (string) — prediction endpoint.
- `userId`, `sessionId` (string) — identifiers for the session.
- `userAlias`, `userInfo` (string) — optional user‑provided fields (defaults to `N/A`).
- `segmentMs` (number) — segment duration (default `10000`).
- `flushMs` (number) — upload interval (default `1000`).
- `sampleMs` (number) — pointer sampling throttle (default `16`).
- `modelGroup` (`"auto" | "draw" | "quest"`) — controls model routing.
- `ipAddress` (string) — set if you already have it (optional).
- `enableIpLookup` (boolean) — default `true` (best‑effort IP lookup).
- `ipLookupUrl` (string) — IP lookup URL (default `https://api.ipify.org?format=json`).

## What gets recorded

The recorder emits events with these core types:

- `session_start` — session metadata and environment info.
- `segment_start` / `segment_end` — segment boundaries.
- `pointermove` — pointer coordinates with timestamps.

Each event includes viewport details, and the following environment data is captured when available:

- local time, timezone, and timezone offset
- user agent, platform/OS, language
- screen + viewport resolution, pixel ratio
- device memory, hardware concurrency, connection info
- user fields: `user_alias`, `user_info`
- IP address (best‑effort if enabled)

## SDK website

The MAILA SDK website provides a concise overview of the integration flow, a component gallery, and copy‑paste snippets for common setups. It also includes a short reference for recorder options, example payloads, and backend endpoints so teams can onboard quickly.

## Notes

- Segment boundaries are emitted as `segment_start` / `segment_end` events; the backend preprocessing treats these as segment windows and normalizes coordinates to the viewport.
- Predictions are only computed when the collaborator calls `recorder.predict()`. The recorder continues to upload event batches to `/exp_main` while running (similar to the app), and `predict()` flushes the current segment + pending buffered events before calling `/predict`.
- `modelGroup: "draw"` forces the backend to use the draw models by making all segment `question_id`s fall in the draw range (`> 400`).
