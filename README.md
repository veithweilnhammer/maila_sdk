# Human–computer interactions predict mental health

**Authors:** Veith Weilnhammer, Jefferson Ortega, and David Whitney

This repository accompanies the preprint at `https://arxiv.org/abs/2511.20179`.

## What You Can Do With This Repo

This repo contains a small browser-side SDK ("Pixelblot recorder") plus a demo page. With it you can:

- Record pointer movement (mouse/touch/stylus via `pointermove`) in the browser.
- Upload those events to an existing MAILA backend.
- Request model predictions for the current recording session.
- Run inference from a saved recording file (upload a `.jsonl` file to the backend).

Repo contents:

- `pixelblot-recorder.js`: the standalone browser recorder (exposes `global.PixelblotRecorder`).
- `example.html`: an end-to-end sandbox UI (record, predict, new session, predict-upload).
- `example.jsonl`: a sample recording file you can upload for `/predict-upload`.

This repo is client-side only. For the preprint demo we expose a hosted MAILA backend, and `example.html`
is preconfigured to use it by default:

- Backend base URL: `https://pixelblot-maila-backend.onrender.com`

That backend exposes:

- `POST /exp_main` (ingest batches of events)
- `POST /predict` (run prediction for a `{user_id, session_id}`)
- `POST /predict-upload` (run prediction from an uploaded recording file)

What is recorded:

- `pointermove` coordinates (`x`, `y`) plus `viewport` size
- Session metadata (`user_agent`, `platform`, `language`, screen + viewport resolution)
- Segment markers (`segment_start` / `segment_end`)

What is not recorded by this SDK: keystrokes, DOM content, screenshots.

Data note: even pointer trajectories can be sensitive. Only use this demo backend with data you are comfortable
sharing for research & prototyping purposes. Outputs are model estimates and not a clinical diagnosis.

## Start Here: `example.html`

Open `example.html` and use the UI to exercise the full workflow end-to-end:

1) Leave the default backend base URL as-is (`https://pixelblot-maila-backend.onrender.com`).
2) Click `Start recording`, move the cursor for ~10-20 seconds.
3) Click `Predict (flush + /predict)` to request a prediction for the current `user_id/session_id`.
4) Optional: click `New session` to rotate `session_id` and run another trial.
5) Optional: upload `example.jsonl` (or your own `.jsonl`) and click `Predict from uploaded file`.

If you see browser errors when opening `example.html` directly (for example, due to `file://` restrictions),
serve this folder and open it over `http://localhost` instead:

```bash
python3 -m http.server 8000
```

The demo page is intentionally "literal": each button corresponds to a single recorder call or backend API.

## Embed On Your Own Site (Script Tag)

1) Host `pixelblot-recorder.js` somewhere reachable (or serve it from your own site).

2) Embed:

```html
<script src="https://YOUR_HOST/pixelblot-recorder.js"></script>
<script>
  const base = "https://pixelblot-maila-backend.onrender.com";
  const recorder = PixelblotRecorder.createRecorder({
    endpoint: `${base}/exp_main`,
    predictEndpoint: `${base}/predict`,
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

## Details

### Segmentation + Upload Behavior

- The recorder groups events into fixed time windows (default: `segmentMs = 10s`) and emits
  `segment_start` / `segment_end` markers.
- While running, it periodically uploads buffered events to `/exp_main` (default: `flushMs = 1s`).
- Predictions are only computed when you call `recorder.predict()`:
  `predict()` flushes pending events and then calls `/predict`.

### Model Groups

`modelGroup` supports three explicit options:

- `touch_draw`
- `touch_quest`
- `cursor_baseline`

Segment ID ranges emitted by default are:

- `touch_draw` -> `segment_id >= 500`
- `touch_quest` -> `segment_id >= 1`
- `cursor_baseline` -> `segment_id >= 900`

### Upload File Format (`/predict-upload`)

For `POST /predict-upload`, the uploaded file should be JSON Lines (one JSON object per line).

- Accepted extensions: `.jsonl` (recommended), `.json`, `.txt`
- Expected event structure: compatible with preprocessing
  (`session_start`, `segment_start`, `pointermove`, `segment_end`)
- Coordinates should include `x`, `y`, and ideally `viewport`
- Example file: `example.jsonl`
