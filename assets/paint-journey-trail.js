(function paintJourneyTrail(window, document) {
  'use strict';

  var PaintJourney = window.PaintJourney = window.PaintJourney || {};
  var DEFAULT_CONTENT_SELECTORS = [
    'nav', '.photo', '.voice-bubble', '.finale-footer'
  ];
  var EXCLUSION_PADDING = 14;
  var PIGMENT_STOPS = [
    [0, 207, 48, 49],
    [32, 226, 91, 39],
    [62, 222, 174, 40],
    [105, 76, 143, 72],
    [150, 28, 133, 105],
    [194, 27, 132, 164],
    [226, 47, 72, 166],
    [270, 99, 57, 139],
    [318, 180, 47, 101],
    [360, 207, 48, 49]
  ];

  function pigmentRgb(value) {
    var hue = ((Number(value) || 0) % 360 + 360) % 360;
    var stopIndex = 0;
    while (stopIndex < PIGMENT_STOPS.length - 2 && hue > PIGMENT_STOPS[stopIndex + 1][0]) stopIndex += 1;
    var from = PIGMENT_STOPS[stopIndex];
    var to = PIGMENT_STOPS[stopIndex + 1];
    var progress = (hue - from[0]) / Math.max(1, to[0] - from[0]);
    return {
      r: Math.round(from[1] + (to[1] - from[1]) * progress),
      g: Math.round(from[2] + (to[2] - from[2]) * progress),
      b: Math.round(from[3] + (to[3] - from[3]) * progress)
    };
  }

  function rgba(value, alpha, lift) {
    var color = pigmentRgb(value);
    var amount = Math.max(-1, Math.min(1, Number(lift) || 0));
    var target = amount >= 0 ? 255 : 24;
    var mix = Math.abs(amount);
    var red = Math.round(color.r + (target - color.r) * mix);
    var green = Math.round(color.g + (target - color.g) * mix);
    var blue = Math.round(color.b + (target - color.b) * mix);
    return 'rgba(' + red + ', ' + green + ', ' + blue + ', ' + Math.max(0, Math.min(1, Number(alpha) || 0)) + ')';
  }

  PaintJourney.pigmentRgb = PaintJourney.pigmentRgb || pigmentRgb;

  function documentSize() {
    var root = document.documentElement;
    var body = document.body;
    return {
      width: Math.max(root.scrollWidth, root.clientWidth, body ? body.scrollWidth : 0),
      height: Math.max(root.scrollHeight, root.clientHeight, body ? body.scrollHeight : 0)
    };
  }

  function seeded(seed) {
    var value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  function pointSeed(point, extra) {
    return point.x * 0.113 + point.y * 0.271 + extra * 0.619;
  }

  PaintJourney.createTrail = function createTrail(options) {
    options = options || {};
    var canvas = options.canvas;
    if (!canvas || !canvas.getContext) {
      throw new Error('PaintJourney.createTrail requires a canvas');
    }

    var contentSelectors = options.contentSelectors || DEFAULT_CONTENT_SELECTORS;
    var context = canvas.getContext('2d');
    var width = 0;
    var height = 0;
    var dpr = 1;
    var originX = 0;
    var originY = 0;
    var exclusionZones = [];
    var exclusionFrame = 0;
    var resizeFrame = 0;
    var contentResizeObserver = null;
    var destroyed = false;

    function getExclusionZones() {
      var selectors = contentSelectors.join(',');
      var matches = selectors ? document.querySelectorAll(selectors) : [];
      var scrollX = window.scrollX || window.pageXOffset || 0;
      var scrollY = window.scrollY || window.pageYOffset || 0;
      var zones = [];

      for (var index = 0; index < matches.length; index += 1) {
        var rect = matches[index].getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        zones.push({
          x: Math.max(0, rect.left + scrollX - originX - EXCLUSION_PADDING),
          y: Math.max(0, rect.top + scrollY - originY - EXCLUSION_PADDING),
          width: rect.width + EXCLUSION_PADDING * 2,
          height: rect.height + EXCLUSION_PADDING * 2
        });
      }
      return zones;
    }

    function rebuildExclusions() {
      exclusionZones = getExclusionZones();
      return exclusionZones;
    }

    function clearExclusionZones() {
      context.save();
      for (var index = 0; index < exclusionZones.length; index += 1) {
        var zone = exclusionZones[index];
        context.clearRect(zone.x, zone.y, zone.width, zone.height);
      }
      context.restore();
    }

    function withContentProtection(draw) {
      context.save();
      context.beginPath();
      context.rect(0, 0, width, height);
      for (var index = 0; index < exclusionZones.length; index += 1) {
        var zone = exclusionZones[index];
        context.rect(zone.x, zone.y, zone.width, zone.height);
      }
      context.clip('evenodd');
      draw();
      context.restore();
      clearExclusionZones();
    }

    function paintStamp(point) {
      var requestedHue = Number(point.hue);
      var hue = ((Number.isFinite(requestedHue) ? requestedHue : 0) % 360 + 360) % 360;
      var radius = Math.max(1, Number(point.radius) || 12);
      var alpha = point.alpha === undefined ? 0.6 : Math.max(0, Math.min(1, point.alpha));
      var localX = point.x - originX;
      var localY = point.y - originY;
      var gradient = context.createRadialGradient(localX, localY, radius * 0.08, localX, localY, radius);
      gradient.addColorStop(0, rgba(hue, alpha, 0.2));
      gradient.addColorStop(0.58, rgba(hue + 4, alpha * 0.68, 0.02));
      gradient.addColorStop(1, rgba(hue - 7, 0, -0.1));
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(localX, localY, radius, 0, Math.PI * 2);
      context.fill();

      context.save();
      context.globalCompositeOperation = 'destination-out';
      for (var gap = 0; gap < 3; gap += 1) {
        var gapSeed = seeded(pointSeed(point, gap));
        var gapX = localX + (gapSeed - 0.5) * radius * 1.25;
        var gapY = localY + (seeded(pointSeed(point, gap + 13)) - 0.5) * radius * 1.1;
        context.fillStyle = 'rgba(0, 0, 0, ' + (0.18 + gapSeed * 0.2) + ')';
        context.fillRect(gapX, gapY, radius * (0.16 + gapSeed * 0.12), Math.max(1, radius * 0.055));
      }
      context.restore();
    }

    function stamp(options) {
      if (destroyed) return;
      var point = options || {};
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      withContentProtection(function () { paintStamp(point); });
    }

    function ribbon(options) {
      if (destroyed) return;
      options = options || {};
      var from = options.from;
      var to = options.to;
      if (!from || !to || !Number.isFinite(from.x) || !Number.isFinite(from.y) || !Number.isFinite(to.x) || !Number.isFinite(to.y)) return;

      var ribbonWidth = Math.max(2, Number(options.width) || 20);
      var dx = to.x - from.x;
      var dy = to.y - from.y;
      var distance = Math.max(1, Math.hypot(dx, dy));
      var samples = Math.max(3, Math.ceil(distance / Math.max(4, ribbonWidth * 0.42)));
      var bend = (seeded(pointSeed(from, to.x + to.y)) - 0.5) * Math.min(90, distance * 0.24);

      withContentProtection(function () {
        for (var index = 0; index <= samples; index += 1) {
          var t = index / samples;
          var curve = Math.sin(Math.PI * t) * bend;
          paintStamp({
            x: from.x + dx * t - (dy / distance) * curve,
            y: from.y + dy * t + (dx / distance) * curve,
            hue: options.hue,
            radius: ribbonWidth * (0.42 + seeded(index + pointSeed(from, 2)) * 0.16),
            alpha: (options.alpha === undefined ? 0.5 : options.alpha) * (0.82 + seeded(index + 17) * 0.18)
          });
        }
      });
    }

    function spray(options) {
      if (destroyed) return;
      options = options || {};
      if (!Number.isFinite(options.x) || !Number.isFinite(options.y)) return;
      var count = Math.max(1, Math.floor(Number(options.count) || 12));
      var radius = Math.max(1, Number(options.radius) || 40);

      withContentProtection(function () {
        for (var index = 0; index < count; index += 1) {
          var seed = pointSeed(options, index);
          var angle = seeded(seed) * Math.PI * 2;
          var distance = Math.sqrt(seeded(seed + 7)) * radius;
          paintStamp({
            x: options.x + Math.cos(angle) * distance,
            y: options.y + Math.sin(angle) * distance,
            hue: Number(options.hue) + (seeded(seed + 19) - 0.5) * 24,
            radius: 1.5 + seeded(seed + 31) * 5.5,
            alpha: 0.22 + seeded(seed + 43) * 0.35
          });
        }
      });
    }

    function whorl(options) {
      if (destroyed) return;
      options = options || {};
      if (!Number.isFinite(options.x) || !Number.isFinite(options.y)) return;
      var radius = Math.max(12, Number(options.radius) || 64);
      var turns = Math.max(0.55, Number(options.turns) || 1.35);
      var strokeWidth = Math.max(3, Number(options.width) || 18);
      var progress = Math.max(0.04, Math.min(1, options.progress === undefined ? 1 : Number(options.progress)));
      var direction = Number(options.direction) < 0 ? -1 : 1;
      var baseHue = Number.isFinite(Number(options.hue)) ? Number(options.hue) : 0;
      var segmentCount = Math.max(12, Math.floor(42 * progress));
      var localX = options.x - originX;
      var localY = options.y - originY;
      var angleOffset = Number(options.angle) || -Math.PI * 0.12;

      withContentProtection(function () {
        context.save();
        context.globalCompositeOperation = 'multiply';
        context.lineCap = 'round';
        context.lineJoin = 'round';
        for (var index = 0; index < segmentCount; index += 1) {
          var start = index / segmentCount * progress;
          var end = (index + 1) / segmentCount * progress;
          var startAngle = angleOffset + direction * start * Math.PI * 2 * turns;
          var endAngle = angleOffset + direction * end * Math.PI * 2 * turns;
          var startRadius = radius * (0.08 + Math.pow(start, 0.78) * 0.92);
          var endRadius = radius * (0.08 + Math.pow(end, 0.78) * 0.92);
          var startX = localX + Math.cos(startAngle) * startRadius;
          var startY = localY + Math.sin(startAngle) * startRadius * 0.58;
          var endX = localX + Math.cos(endAngle) * endRadius;
          var endY = localY + Math.sin(endAngle) * endRadius * 0.58;
          context.beginPath();
          context.moveTo(startX, startY);
          context.lineTo(endX, endY);
          context.strokeStyle = rgba(baseHue + start * 360, 0.72, 0.04 - start * 0.08);
          context.globalAlpha = 0.72 - start * 0.22;
          context.lineWidth = strokeWidth * (1 - start * 0.46) * (0.9 + seeded(index + baseHue) * 0.2);
          context.stroke();
        }
        context.restore();
      });
    }

    function impact(options) {
      if (destroyed) return;
      options = options || {};
      if (!Number.isFinite(options.x) || !Number.isFinite(options.y)) return;
      var localX = options.x - originX;
      var localY = options.y - originY;
      var radius = Math.max(10, Math.min(150, Number(options.radius) || 48));
      var direction = Number(options.direction) < 0 ? -1 : 1;
      var hue = Number.isFinite(Number(options.hue)) ? Number(options.hue) : 0;
      var seedBase = pointSeed(options, hue + radius);

      withContentProtection(function () {
        context.save();
        context.globalCompositeOperation = 'source-over';

        var pool = context.createRadialGradient(
          localX - direction * radius * 0.16,
          localY - radius * 0.12,
          radius * 0.04,
          localX,
          localY,
          radius
        );
        pool.addColorStop(0, rgba(hue, 0.92, 0.24));
        pool.addColorStop(0.34, rgba(hue + 7, 0.88, 0.04));
        pool.addColorStop(0.76, rgba(hue - 9, 0.72, -0.1));
        pool.addColorStop(1, rgba(hue - 16, 0, -0.18));
        context.fillStyle = pool;
        context.beginPath();
        context.ellipse(localX, localY, radius, radius * 0.43, direction * -0.06, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = rgba(hue, 0.22, 0.5);
        context.beginPath();
        context.ellipse(
          localX - direction * radius * 0.2,
          localY - radius * 0.12,
          radius * 0.34,
          Math.max(1.5, radius * 0.055),
          -0.08 * direction,
          0,
          Math.PI * 2
        );
        context.fill();

        var satellites = Math.max(8, Math.min(18, Math.round(radius / 5)));
        for (var satellite = 0; satellite < satellites; satellite += 1) {
          var satelliteSeed = seedBase + satellite * 3.17;
          var angle = -Math.PI * 0.95 + seeded(satelliteSeed) * Math.PI * 1.9;
          var reach = radius * (0.58 + seeded(satelliteSeed + 9) * 0.72);
          var satelliteX = localX + Math.cos(angle) * reach * (direction < 0 ? -1 : 1);
          var satelliteY = localY + Math.sin(angle) * reach * 0.48;
          var satelliteRadius = Math.max(1.5, radius * (0.035 + seeded(satelliteSeed + 18) * 0.07));
          context.fillStyle = rgba(hue + (seeded(satelliteSeed + 24) - 0.5) * 18, 0.38 + seeded(satelliteSeed + 27) * 0.34, 0.03);
          context.beginPath();
          context.ellipse(
            satelliteX,
            satelliteY,
            satelliteRadius * (0.72 + seeded(satelliteSeed + 33) * 0.8),
            satelliteRadius,
            angle,
            0,
            Math.PI * 2
          );
          context.fill();
        }

        context.lineCap = 'round';
        for (var drip = 0; drip < 3; drip += 1) {
          var dripSeed = seedBase + drip * 11.3;
          var startX = localX + direction * radius * (-0.34 + drip * 0.33);
          var startY = localY + radius * (0.19 + seeded(dripSeed) * 0.12);
          var length = radius * (0.36 + seeded(dripSeed + 4) * 0.52);
          var bend = direction * radius * (seeded(dripSeed + 8) - 0.5) * 0.32;
          context.beginPath();
          context.moveTo(startX, startY);
          context.bezierCurveTo(
            startX - bend * 0.25,
            startY + length * 0.28,
            startX + bend,
            startY + length * 0.72,
            startX + bend * 0.7,
            startY + length
          );
          context.strokeStyle = rgba(hue + drip * 14, 0.74, drip === 1 ? 0.08 : -0.05);
          context.lineWidth = Math.max(2, radius * (0.045 + seeded(dripSeed + 13) * 0.025));
          context.stroke();
          context.fillStyle = rgba(hue + drip * 14, 0.76, 0.05);
          context.beginPath();
          context.ellipse(
            startX + bend * 0.7,
            startY + length,
            context.lineWidth * 0.72,
            context.lineWidth,
            0,
            0,
            Math.PI * 2
          );
          context.fill();
        }
        context.restore();
      });
    }

    function veil(options) {
      if (destroyed) return;
      options = options || {};
      var from = options.from;
      var to = options.to;
      if (!from || !to || !Number.isFinite(from.x) || !Number.isFinite(from.y) || !Number.isFinite(to.x) || !Number.isFinite(to.y)) return;
      var fromX = from.x - originX;
      var fromY = from.y - originY;
      var toX = to.x - originX;
      var toY = to.y - originY;
      var deltaX = toX - fromX;
      var deltaY = toY - fromY;
      var distance = Math.max(1, Math.hypot(deltaX, deltaY));
      var normalX = -deltaY / distance;
      var normalY = deltaX / distance;
      var fieldWidth = Math.max(24, Math.min(240, Number(options.width) || 110));
      var alpha = options.alpha === undefined ? 0.18 : Math.max(0.03, Math.min(0.42, Number(options.alpha)));
      var hue = Number.isFinite(Number(options.hue)) ? Number(options.hue) : 0;
      var seedBase = pointSeed(from, to.x + to.y + hue);
      var moteCount = Math.max(18, Math.min(42, Math.round(18 + fieldWidth * 0.1)));

      withContentProtection(function () {
        context.save();
        context.globalCompositeOperation = 'source-over';
        context.lineCap = 'round';

        // A broad veil is built from translucent, overlapping clouds. Keeping
        // their edges soft prevents the sweep from reading as a flat banner.
        var washCount = Math.max(6, Math.min(10, Math.round(fieldWidth / 20)));
        for (var wash = 0; wash < washCount; wash += 1) {
          var washSeed = seedBase + wash * 17.29;
          var washT = (wash + 0.5) / washCount;
          var washEnvelope = Math.sin(Math.PI * washT);
          var washSpread = (seeded(washSeed) - 0.5) * fieldWidth * (0.35 + washEnvelope * 0.38);
          var washX = fromX + deltaX * washT + normalX * washSpread;
          var washY = fromY + deltaY * washT + normalY * washSpread;
          var washRadius = fieldWidth * (0.14 + seeded(washSeed + 8) * 0.1);
          context.fillStyle = rgba(hue + washT * 58, alpha * (0.2 + seeded(washSeed + 21) * 0.16), 0.18);
          context.beginPath();
          context.ellipse(
            washX,
            washY,
            washRadius * (1.65 + seeded(washSeed + 33) * 0.75),
            washRadius * (0.48 + seeded(washSeed + 47) * 0.36),
            Math.atan2(deltaY, deltaX) + (seeded(washSeed + 59) - 0.5) * 0.3,
            0,
            Math.PI * 2
          );
          context.fill();
        }

        context.beginPath();
        context.moveTo(fromX, fromY);
        context.bezierCurveTo(
          fromX + deltaX * 0.3 + normalX * fieldWidth * 0.22,
          fromY + deltaY * 0.3 + normalY * fieldWidth * 0.22,
          fromX + deltaX * 0.7 - normalX * fieldWidth * 0.14,
          fromY + deltaY * 0.7 - normalY * fieldWidth * 0.14,
          toX,
          toY
        );
        context.strokeStyle = rgba(hue + 24, alpha * 0.56, 0.08);
        context.lineWidth = Math.max(5, Math.min(22, fieldWidth * 0.1));
        context.stroke();

        for (var mote = 0; mote < moteCount; mote += 1) {
          var moteSeed = seedBase + mote * 5.71;
          var t = Math.pow(seeded(moteSeed), 0.82);
          var envelope = Math.sin(Math.PI * t);
          var spread = (seeded(moteSeed + 12) - 0.5) * fieldWidth * (0.34 + envelope * 0.9);
          var along = (seeded(moteSeed + 23) - 0.5) * fieldWidth * 0.18;
          var moteX = fromX + deltaX * t + normalX * spread + deltaX / distance * along;
          var moteY = fromY + deltaY * t + normalY * spread + deltaY / distance * along;
          var moteRadius = 1.4 + seeded(moteSeed + 31) * (2.4 + fieldWidth * 0.035);
          context.fillStyle = rgba(hue + t * 72 + (seeded(moteSeed + 38) - 0.5) * 12, alpha * (0.38 + seeded(moteSeed + 44) * 0.62), 0.08);
          context.beginPath();
          context.ellipse(
            moteX,
            moteY,
            moteRadius * (0.7 + seeded(moteSeed + 51) * 1.15),
            moteRadius,
            seeded(moteSeed + 63) * Math.PI,
            0,
            Math.PI * 2
          );
          context.fill();
        }
        context.restore();
      });
    }

    function edgeLanePoint(point, index) {
      var size = documentSize();
      var x = index % 2 ? size.width - 28 : 28;
      var y = Math.max(28, Math.min(size.height - 28, point.y));
      var localX = x - originX;
      var localY = y - originY;
      for (var zoneIndex = 0; zoneIndex < exclusionZones.length; zoneIndex += 1) {
        var zone = exclusionZones[zoneIndex];
        if (localX >= zone.x && localX <= zone.x + zone.width && localY >= zone.y && localY <= zone.y + zone.height) {
          y = Math.min(size.height - 28, zone.y + zone.height + originY + 18);
          localY = y - originY;
        }
      }
      return { x: x, y: y };
    }

    function drawStaticSpectrum(waypoints) {
      if (destroyed || !Array.isArray(waypoints) || waypoints.length < 2) return;
      var lanePoints = [];
      for (var index = 0; index < waypoints.length; index += 1) {
        if (Number.isFinite(waypoints[index].y)) lanePoints.push(edgeLanePoint(waypoints[index], index));
      }
      var segmentCount = lanePoints.length - 1;
      var hueSteps = 12;
      for (var segment = 1; segment < lanePoints.length; segment += 1) {
        var from = lanePoints[segment - 1];
        var to = lanePoints[segment];
        for (var step = 0; step < hueSteps; step += 1) {
          var start = step / hueSteps;
          var end = (step + 1) / hueSteps;
          ribbon({
            from: { x: from.x + (to.x - from.x) * start, y: from.y + (to.y - from.y) * start },
            to: { x: from.x + (to.x - from.x) * end, y: from.y + (to.y - from.y) * end },
            hue: 360 * ((segment - 1 + start) / segmentCount),
            width: 18,
            alpha: 0.42
          });
        }
      }
    }

    function clear() {
      context.clearRect(0, 0, width, height);
    }

    function resize() {
      if (destroyed) return;
      var previousDisplay = canvas.style.display || '';
      canvas.style.display = 'none';
      var nextSize = documentSize();
      canvas.style.display = previousDisplay;
      var nextDpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
      var previous = null;
      if (canvas.width && canvas.height) {
        previous = document.createElement('canvas');
        previous.width = canvas.width;
        previous.height = canvas.height;
        previous.getContext('2d').drawImage(canvas, 0, 0);
      }
      var previousWidth = width || nextSize.width;
      var previousHeight = height || nextSize.height;
      width = nextSize.width;
      height = nextSize.height;
      var pixelBudget = width <= 520 ? 4500000 : 12000000;
      dpr = Math.min(nextDpr, Math.sqrt(pixelBudget / Math.max(1, width * height)));
      dpr = Math.max(0.75, dpr);
      canvas.width = Math.max(1, Math.ceil(width * dpr));
      canvas.height = Math.max(1, Math.ceil(height * dpr));
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      var canvasRect = canvas.getBoundingClientRect();
      originX = canvasRect.left + (window.scrollX || window.pageXOffset || 0);
      originY = canvasRect.top + (window.scrollY || window.pageYOffset || 0);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (previous) context.drawImage(previous, 0, 0, previousWidth, previousHeight);
      rebuildExclusions();
      clearExclusionZones();
    }

    function scheduleResize() {
      if (resizeFrame || destroyed) return;
      resizeFrame = window.requestAnimationFrame(function () {
        resizeFrame = 0;
        resize();
      });
    }

    function scheduleExclusionRefresh() {
      if (exclusionFrame || destroyed) return;
      exclusionFrame = window.requestAnimationFrame(function () {
        exclusionFrame = 0;
        rebuildExclusions();
        clearExclusionZones();
      });
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (exclusionFrame) window.cancelAnimationFrame(exclusionFrame);
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      if (contentResizeObserver) contentResizeObserver.disconnect();
      document.removeEventListener('toggle', scheduleResize, true);
      window.removeEventListener('scroll', scheduleExclusionRefresh);
      window.removeEventListener('resize', scheduleResize);
      window.removeEventListener('orientationchange', scheduleResize);
    }

    resize();
    var journeyContent = document.querySelector('.journey-content');
    if (typeof window.ResizeObserver === 'function' && journeyContent) {
      contentResizeObserver = new window.ResizeObserver(scheduleResize);
      contentResizeObserver.observe(journeyContent);
    }
    document.addEventListener('toggle', scheduleResize, true);
    window.addEventListener('scroll', scheduleExclusionRefresh, { passive: true });
    window.addEventListener('resize', scheduleResize);
    window.addEventListener('orientationchange', scheduleResize);

    return {
      resize: resize,
      clear: clear,
      stamp: stamp,
      ribbon: ribbon,
      spray: spray,
      whorl: whorl,
      impact: impact,
      veil: veil,
      drawStaticSpectrum: drawStaticSpectrum,
      destroy: destroy
    };
  };
}(window, document));
