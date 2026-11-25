(() => {
  // Frames 001..297 contain the clean cinematic sequence (298..300 carry a loop spinner overlay).
  const TOTAL_FRAMES = 297;
  const FRAME_PATH = (idx) =>
    `frames/ezgif-frame-${String(idx).padStart(3, "0")}.jpg`;

  const preloader = document.getElementById("preloader");
  const preloaderBar = document.getElementById("preloader-bar");
  const preloaderStatus = document.getElementById("preloader-status");

  const stage = document.getElementById("stage");
  const heroCanvas = document.getElementById("hero-canvas");
  const heroCtx = heroCanvas.getContext("2d", { alpha: false });
  const ambientCanvas = document.getElementById("ambient-canvas");
  const ambientCtx = ambientCanvas.getContext("2d", { alpha: false });

  const railFill = document.getElementById("rail-fill");
  const railDots = Array.from(document.querySelectorAll(".rail-dot"));
  const navPills = Array.from(document.querySelectorAll(".nav-pill"));
  const storyBeats = Array.from(document.querySelectorAll(".story-beat"));

  const scrollCue = document.getElementById("scroll-cue");
  const frameCounter = document.getElementById("frame-counter");
  const percentCounter = document.getElementById("percent-counter");

  const fitToggleBtn = document.getElementById("fit-toggle");
  const fitLabel = document.getElementById("fit-label");
  const autoplayBtn = document.getElementById("autoplay-toggle");
  const autoplayIcon = document.getElementById("autoplay-icon");
  const autoplayLabel = document.getElementById("autoplay-label");
  const replayBtn = document.getElementById("replay-btn");

  const sizeBtns = Array.from(document.querySelectorAll(".size-btn"));
  const sizeCaption = document.getElementById("size-caption");

  const frames = new Array(TOTAL_FRAMES);
  let loadedCount = 0;
  let fullBleed = false;
  let isAutoPlaying = false;

  let targetFrame = 0;
  let currentFrame = 0;
  let lastRenderedIndex = -1;
  let autoScrollY = 0;
  let rafId = null;

  function resizeCanvases() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    heroCanvas.width = Math.floor(width * dpr);
    heroCanvas.height = Math.floor(height * dpr);
    heroCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ambientCanvas.width = 160;
    ambientCanvas.height = 90;

    lastRenderedIndex = -1;
    renderFrame(Math.round(currentFrame));
  }

  function findNearestLoadedFrame(index) {
    if (frames[index] && frames[index].complete && frames[index].naturalWidth > 0) {
      return frames[index];
    }
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const backward = index - offset;
      if (backward >= 0 && frames[backward]?.complete && frames[backward].naturalWidth > 0) {
        return frames[backward];
      }
      const forward = index + offset;
      if (forward < TOTAL_FRAMES && frames[forward]?.complete && frames[forward].naturalWidth > 0) {
        return frames[forward];
      }
    }
    return null;
  }

  function renderFrame(index) {
    const clamped = Math.max(0, Math.min(TOTAL_FRAMES - 1, index));
    if (clamped === lastRenderedIndex) return;

    const img = findNearestLoadedFrame(clamped);
    if (!img) return;

    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const scale = fullBleed
      ? Math.max(cw / iw, ch / ih)
      : Math.min(cw / iw, ch / ih);

    const drawW = iw * scale;
    const drawH = ih * scale;
    const drawX = (cw - drawW) / 2;
    const drawY = (ch - drawH) / 2;

    heroCtx.fillStyle = "#050705";
    heroCtx.fillRect(0, 0, cw, ch);
    heroCtx.drawImage(img, drawX, drawY, drawW, drawH);

    // Subtle ambient fill behind letterboxed cinema view
    ambientCtx.drawImage(img, 0, 0, ambientCanvas.width, ambientCanvas.height);

    lastRenderedIndex = clamped;
  }

  function getScrollProgress() {
    const stageTop = stage.offsetTop;
    const scrollableDistance = Math.max(1, stage.offsetHeight - window.innerHeight);
    const raw = (window.scrollY - stageTop) / scrollableDistance;
    return Math.max(0, Math.min(1, raw));
  }

  function updateUI(progress, frameIdx) {
    const percent = Math.round(progress * 100);
    frameCounter.textContent = `FRAME ${String(frameIdx + 1).padStart(3, "0")} / ${TOTAL_FRAMES}`;
    percentCounter.textContent = `${percent}%`;
    railFill.style.height = `${percent}%`;

    scrollCue.classList.toggle("is-hidden", progress > 0.03);

    storyBeats.forEach((beat) => {
      const start = parseFloat(beat.dataset.start);
      const end = parseFloat(beat.dataset.end);
      beat.classList.toggle("is-visible", progress >= start && progress <= end);
    });

    // Highlight nearest chapter dot/pill
    let activeIdx = 0;
    navPills.forEach((pill, idx) => {
      const target = parseFloat(pill.dataset.target);
      if (progress >= target - 0.09) activeIdx = idx;
    });

    navPills.forEach((pill, idx) => pill.classList.toggle("is-active", idx === activeIdx));
    railDots.forEach((dot, idx) => dot.classList.toggle("is-active", idx === activeIdx));
  }

  function tick() {
    if (isAutoPlaying) {
      const stageEndScroll = stage.offsetTop + stage.offsetHeight - window.innerHeight;
      if (autoScrollY < stageEndScroll - 2) {
        autoScrollY = Math.min(stageEndScroll, autoScrollY + 4.2);
        window.scrollTo({ top: autoScrollY, behavior: "instant" });
      } else {
        setAutoPlay(false);
      }
    }

    const progress = getScrollProgress();
    targetFrame = progress * (TOTAL_FRAMES - 1);

    // Exponential smoothing for fluid scrubbing
    const delta = targetFrame - currentFrame;
    currentFrame = Math.abs(delta) < 0.04 ? targetFrame : currentFrame + delta * 0.16;

    const frameIdx = Math.round(currentFrame);
    renderFrame(frameIdx);
    updateUI(progress, frameIdx);

    rafId = requestAnimationFrame(tick);
  }

  function scrollToProgress(progress) {
    setAutoPlay(false);
    const stageTop = stage.offsetTop;
    const scrollableDistance = Math.max(1, stage.offsetHeight - window.innerHeight);
    window.scrollTo({
      top: stageTop + progress * scrollableDistance,
      behavior: "smooth",
    });
  }

  function setAutoPlay(active) {
    isAutoPlaying = active;
    if (active) {
      autoScrollY = window.scrollY;
    }
    autoplayBtn.classList.toggle("is-active", active);
    autoplayBtn.setAttribute("aria-pressed", String(active));
    autoplayIcon.textContent = active ? "❚❚" : "▶";
    autoplayLabel.textContent = active ? "Pause" : "Auto Scroll";
  }

  function loadAllFrames() {
    let dismissedPreloader = false;
    const MIN_READY_COUNT = 28; // Release preloader quickly once key frames are buffered

    // Load keyframe stride first so scrubbing feels responsive immediately, then fill in
    const order = [];
    const stride = 6;
    for (let s = 0; s < stride; s++) {
      for (let i = s; i < TOTAL_FRAMES; i += stride) {
        order.push(i);
      }
    }

    order.forEach((frameIndex) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = img.onerror = () => {
        loadedCount++;
        const pct = Math.round((loadedCount / TOTAL_FRAMES) * 100);
        preloaderBar.style.width = `${pct}%`;
        preloaderStatus.textContent = `Loading sequence · ${pct}%`;

        if (frameIndex === 0) {
          lastRenderedIndex = -1;
          renderFrame(0);
        }

        if (!dismissedPreloader && loadedCount >= MIN_READY_COUNT && frames[0]?.complete) {
          dismissedPreloader = true;
          preloader.classList.add("is-hidden");
        }
      };
      img.src = FRAME_PATH(frameIndex + 1);
      frames[frameIndex] = img;
    });

    // Fallback safety in case local disk loads slowly
    setTimeout(() => {
      if (!dismissedPreloader) {
        dismissedPreloader = true;
        preloader.classList.add("is-hidden");
      }
    }, 3500);
  }

  // Event bindings
  window.addEventListener("resize", resizeCanvases, { passive: true });
  window.addEventListener(
    "wheel",
    () => {
      if (isAutoPlaying) setAutoPlay(false);
    },
    { passive: true }
  );
  window.addEventListener(
    "touchstart",
    () => {
      if (isAutoPlaying) setAutoPlay(false);
    },
    { passive: true }
  );

  navPills.forEach((pill) => {
    pill.addEventListener("click", () => scrollToProgress(parseFloat(pill.dataset.target)));
  });

  railDots.forEach((dot) => {
    dot.addEventListener("click", () => scrollToProgress(parseFloat(dot.dataset.target)));
  });

  fitToggleBtn.addEventListener("click", () => {
    fullBleed = !fullBleed;
    fitToggleBtn.setAttribute("aria-pressed", String(fullBleed));
    fitLabel.textContent = fullBleed ? "Full Bleed" : "Cinema Fit";
    lastRenderedIndex = -1;
    renderFrame(Math.round(currentFrame));
  });

  autoplayBtn.addEventListener("click", () => {
    const progress = getScrollProgress();
    if (!isAutoPlaying && progress >= 0.99) {
      window.scrollTo({ top: 0, behavior: "instant" });
      currentFrame = 0;
    }
    setAutoPlay(!isAutoPlaying);
  });

  replayBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => setAutoPlay(true), 650);
  });

  sizeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      sizeBtns.forEach((b) => b.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      sizeCaption.textContent = `${btn.dataset.size} · ${btn.dataset.note}`;
    });
  });

  resizeCanvases();
  loadAllFrames();
  rafId = requestAnimationFrame(tick);
})();

