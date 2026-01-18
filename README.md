# Pixelblot recorder (collaborator embed)

This recorder batches **10s segments** of pointer activity (mouse/touch/stylus via `pointermove`) and sends them to the existing backend endpoints:

- `POST /exp_main` for ingest
- `POST /predict` for predictions

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

## Notes

- Segment boundaries are emitted as `segment_start` / `segment_end` events; the backend preprocessing treats these as segment windows and normalizes coordinates to the viewport.
- Predictions are only computed when the collaborator calls `recorder.predict()`. The recorder continues to upload event batches to `/exp_main` while running (similar to the app), and `predict()` flushes the current segment + pending buffered events before calling `/predict`.
- `modelGroup: "draw"` forces the backend to use the draw models by making all segment `question_id`s fall in the draw range (`> 400`).
