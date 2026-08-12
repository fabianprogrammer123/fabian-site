(function paintJourneyTrail(window, document) {
  'use strict';

  var PaintJourney = window.PaintJourney = window.PaintJourney || {};
  var DEFAULT_CONTENT_SELECTORS = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'a', 'nav',
    '.photo', '.voice-bubble', 'footer'
  ];
  var EXCLUSION_PADDING = 14;

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
      gradient.addColorStop(0, 'hsl(' + hue + ' 94% 57% / ' + alpha + ')');
      gradient.addColorStop(0.58, 'hsl(' + hue + ' 90% 52% / ' + (alpha * 0.68) + ')');
      gradient.addColorStop(1, 'hsl(' + hue + ' 88% 48% / 0)');
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
      var nextSize = documentSize();
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
      dpr = nextDpr;
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

    return { resize: resize, clear: clear, stamp: stamp, ribbon: ribbon, spray: spray, drawStaticSpectrum: drawStaticSpectrum, destroy: destroy };
  };
}(window, document));
