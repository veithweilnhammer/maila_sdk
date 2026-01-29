(function (global) {
  function randomDigits(length) {
    let out = "";
    for (let i = 0; i < length; i++) out += Math.floor(Math.random() * 10);
    return out;
  }

  function defaultUserId() {
    return randomDigits(10);
  }

  function defaultSessionId() {
    return "session_" + Date.now();
  }

  function nowMs() {
    return Date.now();
  }

  function getViewport() {
    return { w: global.innerWidth || 0, h: global.innerHeight || 0 };
  }

  function createRecorder(options) {
    const opts = options || {};
    const endpoint = opts.endpoint || "http://localhost:8000/exp_main";
    const predictEndpoint = opts.predictEndpoint || "http://localhost:8000/predict";

    const config = {
      endpoint,
      predictEndpoint,
      apiKey: opts.apiKey || null,
      userId: opts.userId || defaultUserId(),
      sessionId: opts.sessionId || defaultSessionId(),
      userName: opts.userName || "anonymous",
      userAlias: typeof opts.userAlias === "string" ? opts.userAlias : "N/A",
      userInfo: typeof opts.userInfo === "string" ? opts.userInfo : "N/A",
      segmentType: opts.segmentType || "web",
      modelGroup: opts.modelGroup || "auto", // "auto" | "draw" | "quest"
      segmentMs: typeof opts.segmentMs === "number" ? opts.segmentMs : 10_000,
      flushMs: typeof opts.flushMs === "number" ? opts.flushMs : 1_000,
      sampleMs: typeof opts.sampleMs === "number" ? opts.sampleMs : 16,
      maxBatchEvents: typeof opts.maxBatchEvents === "number" ? opts.maxBatchEvents : 2_000,
    };

    const segmentIdOffset =
      typeof opts.segmentIdOffset === "number"
        ? opts.segmentIdOffset
        : config.modelGroup === "draw"
          ? 500
          : 0;

    let running = false;
    let segmentTimer = null;
    let flushTimer = null;
    let buffer = [];
    let segmentId = 0;
    let lastMoveTs = 0;
    let onVisibilityChange = null;
    let onPageHide = null;
    let suspended = false;

    function enqueue(event) {
      buffer.push(event);
      if (buffer.length >= config.maxBatchEvents) void flush();
    }

    function makeHeaders() {
      const headers = { "Content-Type": "application/json" };
      if (config.apiKey) headers["X-API-Key"] = config.apiKey;
      return headers;
    }

    async function flush() {
      if (!buffer.length) return;
      const events = buffer;
      buffer = [];

      const payload = {
        user_id: config.userId,
        session_id: config.sessionId,
        user_name: config.userName,
        events,
      };

      try {
        await fetch(config.endpoint, {
          method: "POST",
          headers: makeHeaders(),
          body: JSON.stringify(payload),
          keepalive: true,
        });
      } catch (err) {
        buffer = events.concat(buffer);
      }
    }

    function flushBeacon() {
      if (!buffer.length) return;
      const events = buffer;
      buffer = [];

      const payload = {
        user_id: config.userId,
        session_id: config.sessionId,
        user_name: config.userName,
        events,
      };

      try {
        if (navigator && typeof navigator.sendBeacon === "function") {
          const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
          const ok = navigator.sendBeacon(config.endpoint, blob);
          if (ok) return;
        }
      } catch (_) {}

      buffer = events.concat(buffer);
    }

    function startSegment() {
      segmentId += 1;
      enqueue({
        type: "segment_start",
        timestamp: nowMs(),
        segment_index: segmentId,
        segment_id: segmentId + segmentIdOffset,
        segment_type: config.segmentType,
        url: global.location && global.location.href ? global.location.href : null,
        viewport: getViewport(),
      });
    }

    function endSegment() {
      if (!segmentId) return;
      enqueue({
        type: "segment_end",
        timestamp: nowMs(),
        segment_index: segmentId,
        segment_id: segmentId + segmentIdOffset,
        segment_type: config.segmentType,
        url: global.location && global.location.href ? global.location.href : null,
        viewport: getViewport(),
      });
    }

    function scheduleSegments() {
      if (segmentTimer) clearTimeout(segmentTimer);
      segmentTimer = setTimeout(() => {
        endSegment();
        startSegment();
        scheduleSegments();
      }, config.segmentMs);
    }

    function onPointerMove(e) {
      if (suspended) return;
      const ts = nowMs();
      if (ts - lastMoveTs < config.sampleMs) return;
      lastMoveTs = ts;

      enqueue({
        type: "pointermove",
        timestamp: ts,
        x: e.clientX,
        y: e.clientY,
        user_alias: config.userAlias,
        user_info: config.userInfo,
        viewport: getViewport(),
      });
    }

    function start() {
      if (running) return;
      running = true;

      enqueue({
        type: "session_start",
        timestamp: nowMs(),
        session_id: config.sessionId,
        user_id: config.userId,
        user_name: config.userName,
        user_alias: config.userAlias,
        user_info: config.userInfo,
        user_agent: navigator && navigator.userAgent ? navigator.userAgent : "unknown",
        platform: navigator && navigator.platform ? navigator.platform : "unknown",
        language: navigator && navigator.language ? navigator.language : "unknown",
        screen_resolution:
          global.screen && global.screen.width && global.screen.height
            ? global.screen.width + "x" + global.screen.height
            : "unknown",
        viewport_resolution: (global.innerWidth || 0) + "x" + (global.innerHeight || 0),
      });

      startSegment();
      scheduleSegments();

      global.addEventListener("pointermove", onPointerMove, { passive: true });
      flushTimer = setInterval(() => void flush(), config.flushMs);

      onVisibilityChange = () => {
        if (document && document.visibilityState === "hidden") flushBeacon();
      };
      onPageHide = () => flushBeacon();
      global.addEventListener("visibilitychange", onVisibilityChange);
      global.addEventListener("pagehide", onPageHide);
    }

    function stop() {
      if (!running) return;
      running = false;

      endSegment();

      if (segmentTimer) clearTimeout(segmentTimer);
      if (flushTimer) clearInterval(flushTimer);

      global.removeEventListener("pointermove", onPointerMove);
      if (onVisibilityChange) global.removeEventListener("visibilitychange", onVisibilityChange);
      if (onPageHide) global.removeEventListener("pagehide", onPageHide);
      flushBeacon();
    }

    async function predict(userNameOverride) {
      if (running) {
        endSegment();
        if (segmentTimer) clearTimeout(segmentTimer);
        await flush();
      } else {
        await flush();
      }

      const payload = {
        user_id: config.userId,
        session_id: config.sessionId,
        user_name: userNameOverride || config.userName || "anonymous",
      };

      const res = await fetch(config.predictEndpoint, {
        method: "POST",
        headers: makeHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Predict failed: " + res.status);
      const out = await res.json();

      if (running) {
        startSegment();
        scheduleSegments();
      }

      return out;
    }

    async function newSession(opts) {
      const p = opts || {};
      const rotateUserId = !!p.rotateUserId;

      suspended = true;
      try {
        if (running) {
          endSegment();
          if (segmentTimer) clearTimeout(segmentTimer);
        }

        await flush();

        segmentId = 0;
        lastMoveTs = 0;

        if (typeof p.userName === "string") config.userName = p.userName;
        if (typeof p.userId === "string") config.userId = p.userId;
        else if (rotateUserId) config.userId = defaultUserId();
        if (typeof p.userAlias === "string") config.userAlias = p.userAlias;
        if (typeof p.userInfo === "string") config.userInfo = p.userInfo;

        if (typeof p.sessionId === "string") config.sessionId = p.sessionId;
        else config.sessionId = defaultSessionId();

        if (running) {
          enqueue({
            type: "session_start",
            timestamp: nowMs(),
            session_id: config.sessionId,
            user_id: config.userId,
            user_name: config.userName,
            user_alias: config.userAlias,
            user_info: config.userInfo,
            user_agent: navigator && navigator.userAgent ? navigator.userAgent : "unknown",
            platform: navigator && navigator.platform ? navigator.platform : "unknown",
            language: navigator && navigator.language ? navigator.language : "unknown",
            screen_resolution:
              global.screen && global.screen.width && global.screen.height
                ? global.screen.width + "x" + global.screen.height
                : "unknown",
            viewport_resolution: (global.innerWidth || 0) + "x" + (global.innerHeight || 0),
          });

          startSegment();
          scheduleSegments();
        }

        return { userId: config.userId, sessionId: config.sessionId };
      } finally {
        suspended = false;
      }
    }

    return {
      config,
      start,
      stop,
      flush,
      predict,
      newSession,
    };
  }

  global.PixelblotRecorder = { createRecorder };
})(typeof window !== "undefined" ? window : globalThis);
