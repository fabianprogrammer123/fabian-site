(() => {
  const PaintFinale = window.PaintFinale = window.PaintFinale || {};
  const pendingStart = PaintFinale.pendingStart;
  const stage = document.getElementById('paint-finale');
  const canvas = document.getElementById('paint-finale-canvas');
  const walker = stage && stage.querySelector('.finale-walker');
  if (!stage || !canvas || !walker || !canvas.getContext) return;

  const context = canvas.getContext('2d');
  if (!context) return;

  const walkerGroup = walker.querySelector('.walker');
  const head = walker.querySelector('.walker-head');
  const rearArm = walker.querySelector('.walker-arm--rear');
  const bucketArm = walker.querySelector('.walker-arm--bucket');
  const rearLeg = walker.querySelector('.walker-leg--rear');
  const frontLeg = walker.querySelector('.walker-leg--front');
  const bucket = walker.querySelector('.paint-bucket');
  if (!walkerGroup || !head || !rearArm || !bucketArm || !rearLeg || !frontLeg || !bucket) return;

  const palette = ['#315ee8', '#e43d78', '#12a88a', '#f0c52e', '#7548cf'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timeline = {
    establish: 250,
    walkEnd: 1650,
    tipEnd: 2350,
    paintEnd: 4550,
    settleEnd: 4800
  };
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let animationComplete = false;
  let started = false;
  let startTime = 0;
  let lastPaintProgress = 0;
  let resizeFrame = 0;
  let fallbackRequested = false;
  let staticMode = false;
  let paintOwnedByTrail = false;

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function easeInOut(value) {
    const progress = clamp(value);
    return progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  }

  function easeOut(value) {
    return 1 - Math.pow(1 - clamp(value), 3);
  }

  function seeded(seed) {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  function sizeCanvas() {
    const rect = stage.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function cubicPoint(points, value) {
    const progress = clamp(value);
    const inverse = 1 - progress;
    return {
      x: inverse ** 3 * points[0].x
        + 3 * inverse ** 2 * progress * points[1].x
        + 3 * inverse * progress ** 2 * points[2].x
        + progress ** 3 * points[3].x,
      y: inverse ** 3 * points[0].y
        + 3 * inverse ** 2 * progress * points[1].y
        + 3 * inverse * progress ** 2 * points[2].y
        + progress ** 3 * points[3].y
    };
  }

  function spillPoint() {
    const stageRect = stage.getBoundingClientRect();
    const walkerRect = walker.getBoundingClientRect();
    return {
      x: walkerRect.left - stageRect.left + walkerRect.width * 0.82,
      y: walkerRect.top - stageRect.top + walkerRect.height * 0.67
    };
  }

  function ribbonDefinitions() {
    const spill = spillPoint();
    return [
      {
        color: palette[0], width: 58, delay: 0,
        points: [spill, { x: spill.x - width * 0.12, y: height * 0.96 }, { x: width * 0.56, y: height * 1.03 }, { x: width * 0.06, y: height * 0.83 }]
      },
      {
        color: palette[1], width: 42, delay: 0.05,
        points: [spill, { x: spill.x - width * 0.05, y: height * 0.36 }, { x: width * 0.70, y: height * 0.10 }, { x: width * 0.48, y: height * 0.46 }]
      },
      {
        color: palette[2], width: 55, delay: 0.11,
        points: [spill, { x: spill.x - width * 0.16, y: height * 1.12 }, { x: width * 0.48, y: height * 0.72 }, { x: width * 0.22, y: height * 0.92 }]
      },
      {
        color: palette[3], width: 27, delay: 0.17,
        points: [spill, { x: spill.x - width * 0.08, y: height * 0.21 }, { x: width * 0.73, y: height * 0.04 }, { x: width * 0.61, y: height * 0.31 }]
      },
      {
        color: palette[4], width: 38, delay: 0.23,
        points: [spill, { x: spill.x - width * 0.22, y: height * 0.22 }, { x: width * 0.43, y: height * 0.02 }, { x: width * 0.13, y: height * 0.49 }]
      }
    ];
  }

  function drawRibbons(progress) {
    context.save();
    context.globalCompositeOperation = 'multiply';
    const definitions = ribbonDefinitions();

    definitions.forEach((ribbon, ribbonIndex) => {
      const localProgress = easeOut(clamp((progress - ribbon.delay) / (1 - ribbon.delay)));
      if (localProgress <= 0) return;
      const samples = Math.max(4, Math.floor(localProgress * 112));
      const leftEdge = [];
      const rightEdge = [];
      const centerLine = [];

      for (let index = 0; index <= samples; index += 1) {
        const curvePosition = index / 112;
        const point = cubicPoint(ribbon.points, curvePosition);
        const before = cubicPoint(ribbon.points, Math.max(0, curvePosition - 0.006));
        const after = cubicPoint(ribbon.points, Math.min(1, curvePosition + 0.006));
        const deltaX = after.x - before.x;
        const deltaY = after.y - before.y;
        const length = Math.hypot(deltaX, deltaY) || 1;
        const normalX = -deltaY / length;
        const normalY = deltaX / length;
        const taper = 0.2 + Math.pow(Math.sin(Math.PI * clamp(curvePosition * 0.96)), 0.65) * 0.8;
        const pulse = 1 + Math.sin(index * 0.72 + ribbonIndex * 1.9) * 0.045;
        const halfWidth = ribbon.width * taper * pulse * 0.5;
        leftEdge.push({ x: point.x + normalX * halfWidth, y: point.y + normalY * halfWidth });
        rightEdge.push({ x: point.x - normalX * halfWidth, y: point.y - normalY * halfWidth });
        centerLine.push({ x: point.x - normalX * ribbon.width * 0.09, y: point.y - normalY * ribbon.width * 0.09 });
      }

      context.beginPath();
      context.moveTo(leftEdge[0].x, leftEdge[0].y);
      leftEdge.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      rightEdge.reverse().forEach((point) => context.lineTo(point.x, point.y));
      context.closePath();
      context.fillStyle = ribbon.color;
      context.globalAlpha = 0.76;
      context.fill();

      const tip = centerLine[centerLine.length - 1];
      context.beginPath();
      context.arc(tip.x, tip.y, ribbon.width * 0.1, 0, Math.PI * 2);
      context.fill();

      context.beginPath();
      context.moveTo(centerLine[0].x, centerLine[0].y);
      centerLine.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.strokeStyle = '#ffffff';
      context.globalAlpha = 0.14;
      context.lineWidth = Math.max(1.2, ribbon.width * 0.065);
      context.lineJoin = 'round';
      context.lineCap = 'round';
      context.stroke();
    });
    context.restore();
  }

  function drawWhorls(progress) {
    const whorls = [
      { color: palette[1], delay: 0.29, x: 0.73, y: 0.78, radiusX: 0.13, radiusY: 0.24, width: 26, turns: 1.42 },
      { color: palette[0], delay: 0.41, x: 0.50, y: 0.90, radiusX: 0.19, radiusY: 0.34, width: 34, turns: 1.30 },
      { color: palette[2], delay: 0.54, x: 0.27, y: 0.92, radiusX: 0.16, radiusY: 0.29, width: 28, turns: 1.18 }
    ];

    context.save();
    context.globalCompositeOperation = 'multiply';
    whorls.forEach((whorl, index) => {
      const localProgress = easeOut(clamp((progress - whorl.delay) / (1 - whorl.delay)));
      if (localProgress <= 0) return;
      const start = Math.PI * (0.1 + index * 0.08);
      context.beginPath();
      context.ellipse(
        width * whorl.x,
        height * whorl.y,
        width * whorl.radiusX,
        height * whorl.radiusY,
        0,
        start,
        start - Math.PI * whorl.turns * localProgress,
        true
      );
      context.strokeStyle = whorl.color;
      context.globalAlpha = 0.48;
      context.lineWidth = whorl.width;
      context.lineCap = 'round';
      context.stroke();
    });
    context.restore();
  }

  function drawSplatters(progress) {
    if (progress <= 0) return;
    const definitions = ribbonDefinitions();
    context.save();
    context.globalCompositeOperation = 'multiply';

    for (let index = 0; index < 86; index += 1) {
      const activation = 0.08 + seeded(index + 4) * 0.86;
      if (progress < activation) continue;
      const ribbonIndex = index % definitions.length;
      const ribbon = definitions[ribbonIndex];
      const curvePosition = 0.06 + seeded(index + 40) * Math.min(0.94, progress + 0.08);
      const point = cubicPoint(ribbon.points, curvePosition);
      const angle = seeded(index + 80) * Math.PI * 2;
      const distance = 8 + seeded(index + 120) * (24 + ribbon.width * 0.55);
      const radius = 0.7 + seeded(index + 160) * 3.1;

      context.beginPath();
      context.ellipse(
        point.x + Math.cos(angle) * distance,
        point.y + Math.sin(angle) * distance * 0.58,
        radius * (1.1 + seeded(index + 200)),
        radius * 0.62,
        angle,
        0,
        Math.PI * 2
      );
      context.fillStyle = ribbon.color;
      context.globalAlpha = 0.42 + seeded(index + 240) * 0.34;
      context.fill();
    }
    context.restore();
  }

  function drawGrain(progress) {
    if (progress < 0.12) return;
    const definitions = ribbonDefinitions();
    context.save();
    context.globalCompositeOperation = 'destination-out';

    for (let index = 0; index < 125; index += 1) {
      const activation = 0.12 + seeded(index + 300) * 0.8;
      if (progress < activation) continue;
      const ribbon = definitions[index % definitions.length];
      const point = cubicPoint(ribbon.points, seeded(index + 340) * Math.min(progress, 1));
      const offset = (seeded(index + 380) - 0.5) * ribbon.width * 0.8;
      context.globalAlpha = 0.18 + seeded(index + 420) * 0.24;
      context.fillRect(point.x - 1, point.y + offset, 2 + seeded(index + 460) * 5, 0.7 + seeded(index + 500) * 1.3);
    }
    context.restore();
  }

  function renderPaint(progress) {
    lastPaintProgress = clamp(progress);
    context.clearRect(0, 0, width, height);
    drawRibbons(lastPaintProgress);
    drawWhorls(lastPaintProgress);
    drawSplatters(lastPaintProgress);
    drawGrain(lastPaintProgress);
  }

  function setTransform(element, transform) {
    element.style.transform = transform;
  }

  function setWalkerState(elapsed) {
    const walkProgress = easeInOut((elapsed - timeline.establish) / (timeline.walkEnd - timeline.establish));
    const tipProgress = easeInOut((elapsed - timeline.walkEnd) / (timeline.tipEnd - timeline.walkEnd));
    const walking = elapsed >= timeline.establish && elapsed < timeline.walkEnd;
    const stride = walking ? Math.sin(walkProgress * Math.PI * 8) : 0;
    const bob = walking ? Math.abs(Math.sin(walkProgress * Math.PI * 8)) * -2.8 : 0;
    const travel = 165 * (1 - walkProgress);

    setTransform(walker, `translateX(${travel}px) translateY(${bob}px)`);
    setTransform(walkerGroup, `rotate(${-4.5 * tipProgress}deg)`);
    setTransform(head, `rotate(${stride * 2.2 + tipProgress * 3}deg)`);
    setTransform(rearArm, `rotate(${stride * 17 - tipProgress * 12}deg)`);
    setTransform(bucketArm, `rotate(${-stride * 14 - tipProgress * 29}deg)`);
    setTransform(rearLeg, `rotate(${-stride * 26 - tipProgress * 8}deg)`);
    setTransform(frontLeg, `rotate(${stride * 26 + tipProgress * 11}deg)`);
    setTransform(bucket, `rotate(${-tipProgress * 96}deg) translate(${-tipProgress * 3}px, ${tipProgress * 3}px)`);
  }

  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = Math.min(timestamp - startTime, timeline.settleEnd);
    setWalkerState(elapsed);
    const paintProgress = easeOut((elapsed - timeline.tipEnd) / (timeline.paintEnd - timeline.tipEnd));
    renderPaint(paintProgress);

    if (elapsed < timeline.settleEnd) {
      window.requestAnimationFrame(animate);
      return;
    }

    animationComplete = true;
    stage.classList.add('is-complete');
  }

  function showReducedMotionState() {
    started = true;
    animationComplete = true;
    setWalkerState(timeline.settleEnd);
    if (!paintOwnedByTrail) renderPaint(1);
    stage.classList.add('is-complete');
  }

  function begin() {
    if (started) return;
    started = true;
    window.requestAnimationFrame(animate);
  }

  function handleResize() {
    if (staticMode) {
      sizeCanvas();
      renderPaint(1);
      return;
    }
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      sizeCanvas();
      renderPaint(animationComplete ? 1 : lastPaintProgress);
    });
  }

  PaintFinale.startFallback = function startFallback({ staticOnly = false, paintOwnedByTrail: ownsPaint = false } = {}) {
    if (fallbackRequested) return;
    fallbackRequested = true;
    staticMode = staticOnly || reducedMotion;
    paintOwnedByTrail = Boolean(ownsPaint);
    stage.classList.add('is-enhanced');
    if (paintOwnedByTrail) {
      canvas.style.visibility = 'hidden';
    } else {
      sizeCanvas();
      window.addEventListener('resize', handleResize, { passive: true });
    }

    if (staticMode) {
      if (paintOwnedByTrail) setWalkerState(timeline.settleEnd);
      showReducedMotionState();
      return;
    }

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          begin();
        }
      }, { threshold: 0.45 });
      observer.observe(stage);
      return;
    }

    begin();
  };

  if (pendingStart) {
    delete PaintFinale.pendingStart;
    PaintFinale.startFallback(pendingStart);
  }

  window.setTimeout(() => {
    if (window.PaintJourneyControllerClaimed !== true) PaintFinale.startFallback();
  }, 1200);
})();
