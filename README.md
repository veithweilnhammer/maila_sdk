# MAILA SDK recorder (collaborator embed)

This recorder batches **10s segments** of pointer activity (mouse/touch/stylus via `pointermove`) and sends them to the existing backend endpoints:

- `POST /exp_main` for ingest
- `POST /predict` for predictions
- `POST /predict-upload` for predicting directly from an uploaded `.jsonl` file

## Quick start (script tag)

1) Host `sdk/pixelblot-recorder.js` somewhere reachable (or serve it from your own site).

2) Embed:

```html
<script src="https://YOUR_HOST/pixelblot-recorder.js"></script>
<script>
  const recorder = PixelblotRecorder.createRecorder({
    endpoint: "http://localhost:8000/exp_main",
    predictEndpoint: "http://localhost:8000/predict",
    userName: "alice",
    modelGroup: "touch_draw", // one of: touch_draw | touch_quest | cursor_baseline
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

`sdk/example.html` maps each button directly to one user flow:

- `Start recording`
  - Calls `recorder.start()`
  - Example use: open the page, click start, move cursor for 10-20s.
- `Stop`
  - Calls `recorder.stop()`
  - Example use: end current capture before starting a new run.
- `Predict (flush + /predict)`
  - Calls `recorder.predict()`
  - Example use: after recording, get prediction from current `{user_id, session_id}`.
- `New session`
  - Calls `recorder.newSession()`
  - Example use: keep same user, rotate to a fresh `session_id` for another trial.
- `Predict from uploaded file`
  - Calls backend `POST /predict-upload`
  - Example use: choose an existing `.jsonl` recording and run inference without live recording.

## Upload file format

For `POST /predict-upload`, the uploaded file should be JSON Lines (one JSON object per line).

- Accepted extensions: `.jsonl` (recommended), `.json`, `.txt`
- Expected event structure: compatible with preprocessing (`session_start`, `segment_start`, `pointermove`, `segment_end`)
- Coordinates should include `x`, `y`, and ideally `viewport`
- Example file: `sdk/example.jsonl`

## Notes

- Segment boundaries are emitted as `segment_start` / `segment_end` events; the backend preprocessing treats these as segment windows and normalizes coordinates to the viewport.
- Predictions are only computed when the collaborator calls `recorder.predict()`. The recorder continues to upload event batches to `/exp_main` while running (similar to the app), and `predict()` flushes the current segment + pending buffered events before calling `/predict`.
- `modelGroup` supports three explicit options: `touch_draw`, `touch_quest`, `cursor_baseline`.
- Segment ID ranges emitted by default are:
  - `touch_draw` -> `segment_id >= 500`
  - `touch_quest` -> `segment_id >= 1`
  - `cursor_baseline` -> `segment_id >= 900`
