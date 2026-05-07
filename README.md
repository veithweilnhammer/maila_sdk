# Human-computer interactions predict mental health

**Authors:** Veith Weilnhammer, Jefferson Ortega, and David Whitney

This repository accompanies the MAILA preprint: `https://arxiv.org/abs/2511.20179`.

## What This Repo Contains

This repo contains a small browser-side MAILA SDK plus a demo page. With it you can:

- record pointer movement in the browser
- upload those events to a MAILA backend
- request model predictions for the current recording session
- run inference from a saved recording file by uploading a `.jsonl` file

Files:

- `maila-recorder.js`: standalone browser recorder
- `example.html`: end-to-end sandbox UI
- `example.jsonl`: sample recording file for `/predict-upload`

This repo is client-side only. The demo page is preconfigured to use the hosted MAILA backend:

- `https://maila-backend.onrender.com`

That backend exposes:

- `POST /exp_main`
- `POST /predict`
- `POST /predict-upload`

## What This Shows

- how a browser client integrates with the MAILA backend API
- the event format used for ingestion
- the request/response flow for recording and prediction

## What This Does Not Show

- a polished end-user product flow
- stable behavioral estimates from very short recordings

Short runs are useful for validating connectivity and API behavior. Predictions become more stable
with roughly **10 minutes of interaction data**.

## What Is Recorded

- `pointermove` coordinates (`x`, `y`) plus `viewport`
- session metadata such as `user_agent`, `platform`, `language`, screen size, and viewport size
- segment markers: `segment_start` and `segment_end`

What is not recorded by this SDK:

- keystrokes
- DOM content
- screenshots

Data note: pointer trajectories can still be sensitive. Only use the hosted demo backend with data
you are comfortable sharing for research and prototyping purposes. Outputs are model estimates, not
a clinical diagnosis.

## Start Here: `example.html`

Open `example.html` and use the UI to exercise the full workflow end to end:

1. Leave the default backend base URL as `https://maila-backend.onrender.com`.
2. Click `Start recording`, then move the cursor for a short test run.
3. Click `Predict (flush + /predict)` to request a prediction for the current session.
4. Optional: click `New session` to rotate `session_id` and run another trial.
5. Optional: upload `example.jsonl` or your own `.jsonl` file and click `Predict from uploaded file`.

The demo page is intentionally literal: each button corresponds to a recorder action or backend API
call.

If you see browser issues when opening `example.html` directly over `file://`, serve the folder and
open it over `http://localhost` instead:

```bash
python3 -m http.server 8000
```

## Embed On Your Own Site

Host `maila-recorder.js` somewhere reachable, then embed it:

```html
<script src="https://YOUR_HOST/maila-recorder.js"></script>
<script>
  const base = "https://maila-backend.onrender.com";
  const recorder = MailaRecorder.createRecorder({
    endpoint: `${base}/exp_main`,
    predictEndpoint: `${base}/predict`,
    userName: "alice",
    modelGroup: "cursor_baseline", // one of: cursor_baseline | touch_draw | touch_quest
    segmentMs: 10_000,
    flushMs: 1_000,
  });

  recorder.start();

  // Later:
  // recorder.predict().then(console.log);

  // Optional:
  // recorder.newSession();
</script>
```

## Details

### Segmentation and Upload Behavior

- The recorder groups events into fixed time windows, default `segmentMs = 10s`.
- It emits `segment_start` and `segment_end` markers.
- While running, it periodically uploads buffered events to `/exp_main`, default `flushMs = 1s`.
- Predictions are only computed when `recorder.predict()` is called.
- `predict()` flushes pending events and then calls `/predict`.

### Model Groups

Supported `modelGroup` values:

- `cursor_baseline`
- `touch_draw`
- `touch_quest`

Each recorded segment also carries an internal numeric `segment_id` for compatibility with the
backend preprocessing pipeline. For normal use, the important control is `modelGroup`, not the
numeric ID range.

### Upload File Format

For `POST /predict-upload`, the uploaded file should be JSON Lines, one JSON object per line.

- Accepted extensions: `.jsonl` recommended, also `.json` and `.txt`
- Expected event structure: `session_start`, `segment_start`, `pointermove`, `segment_end`
- Coordinates should include `x`, `y`, and ideally `viewport`
- Example file: `example.jsonl`
