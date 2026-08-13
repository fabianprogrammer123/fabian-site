(function paintJourneyLiquidModel(window) {
  'use strict';

  var PaintJourney = window.PaintJourney = window.PaintJourney || {};
  var SHADER_GESTURE_LIMIT = 12;

  function finite(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function copyPoint(point, fallback) {
    fallback = fallback || { x: 0, y: 0 };
    return {
      x: finite(point && point.x, fallback.x),
      y: finite(point && point.y, fallback.y)
    };
  }

  function copyGesture(gesture) {
    if (!gesture) return null;
    return {
      id: gesture.id,
      from: copyPoint(gesture.from),
      control: copyPoint(gesture.control),
      to: copyPoint(gesture.to),
      width: gesture.width,
      palettePhase: gesture.palettePhase,
      seed: gesture.seed,
      reveal: gesture.reveal,
      spread: gesture.spread,
      kind: gesture.kind
    };
  }

  function samePoint(first, second) {
    return first.x === second.x && first.y === second.y;
  }

  function sameGesture(first, second) {
    return first.id === second.id &&
      samePoint(first.from, second.from) &&
      samePoint(first.control, second.control) &&
      samePoint(first.to, second.to) &&
      first.width === second.width &&
      first.palettePhase === second.palettePhase &&
      first.seed === second.seed &&
      first.reveal === second.reveal &&
      first.spread === second.spread &&
      first.kind === second.kind;
  }

  function intersectsViewport(gesture, viewport) {
    var halfWidth = gesture.width * gesture.spread * 0.5 + 32;
    var minimumX = Math.min(gesture.from.x, gesture.control.x, gesture.to.x) - halfWidth;
    var maximumX = Math.max(gesture.from.x, gesture.control.x, gesture.to.x) + halfWidth;
    var minimumY = Math.min(gesture.from.y, gesture.control.y, gesture.to.y) - halfWidth;
    var maximumY = Math.max(gesture.from.y, gesture.control.y, gesture.to.y) + halfWidth;
    var viewportRight = viewport.scrollX + viewport.width;
    var viewportBottom = viewport.scrollY + viewport.height;
    return maximumX >= viewport.scrollX && minimumX <= viewportRight &&
      maximumY >= viewport.scrollY && minimumY <= viewportBottom;
  }

  PaintJourney.createLiquidModel = function createLiquidModel(options) {
    options = options || {};
    var requestedMaximum = Math.floor(finite(options.maxGestures, SHADER_GESTURE_LIMIT));
    var maxGestures = clamp(requestedMaximum, 1, SHADER_GESTURE_LIMIT);
    var gestures = [];
    var gestureById = Object.create(null);
    var revision = 0;
    var layoutRevision = 0;

    function normalizeGesture(payload, previous) {
      var fallbackPoint = previous ? previous.from : { x: 0, y: 0 };
      var reveal = clamp(finite(payload.reveal, previous ? previous.reveal : 0), 0, 1);
      if (previous) reveal = Math.max(previous.reveal, reveal);
      return {
        id: String(payload.id),
        from: copyPoint(payload.from, fallbackPoint),
        control: copyPoint(payload.control, previous ? previous.control : fallbackPoint),
        to: copyPoint(payload.to, previous ? previous.to : fallbackPoint),
        width: Math.max(1, finite(payload.width, previous ? previous.width : 1)),
        palettePhase: finite(payload.palettePhase, previous ? previous.palettePhase : 0),
        seed: finite(payload.seed, previous ? previous.seed : 0),
        reveal: reveal,
        spread: clamp(finite(payload.spread, previous ? previous.spread : 1), 0.1, 2.5),
        kind: clamp(Math.round(finite(payload.kind, previous ? previous.kind : 0)), 0, 3)
      };
    }

    function upsertGesture(payload) {
      if (!payload || payload.id === undefined || payload.id === null || String(payload.id) === '') {
        throw new Error('Liquid gestures require a stable id');
      }
      var id = String(payload.id);
      var previous = gestureById[id];
      if (!previous && gestures.length >= maxGestures) return null;
      var next = normalizeGesture(payload, previous);
      if (previous) {
        if (sameGesture(previous, next)) return copyGesture(previous);
        var index = gestures.indexOf(previous);
        gestures[index] = next;
      } else {
        gestures.push(next);
      }
      gestureById[id] = next;
      revision += 1;
      return copyGesture(next);
    }

    function setReveal(id, progress) {
      var gesture = gestureById[String(id)];
      if (!gesture) return null;
      var requested = clamp(finite(progress, gesture.reveal), 0, 1);
      if (requested > gesture.reveal) {
        gesture.reveal = requested;
        revision += 1;
      }
      return gesture.reveal;
    }

    function reflow(id, geometry) {
      var gesture = gestureById[String(id)];
      if (!gesture || !geometry) return null;
      var next = copyGesture(gesture);
      if (geometry.from) next.from = copyPoint(geometry.from, gesture.from);
      if (geometry.control) next.control = copyPoint(geometry.control, gesture.control);
      if (geometry.to) next.to = copyPoint(geometry.to, gesture.to);
      if (geometry.width !== undefined) next.width = Math.max(1, finite(geometry.width, gesture.width));
      if (geometry.spread !== undefined) {
        next.spread = clamp(finite(geometry.spread, gesture.spread), 0.1, 2.5);
      }
      if (geometry.kind !== undefined) {
        next.kind = clamp(Math.round(finite(geometry.kind, gesture.kind)), 0, 3);
      }
      if (sameGesture(gesture, next)) return copyGesture(gesture);
      var index = gestures.indexOf(gesture);
      gestures[index] = next;
      gestureById[String(id)] = next;
      revision += 1;
      layoutRevision += 1;
      return copyGesture(next);
    }

    function getGesture(id) {
      return copyGesture(gestureById[String(id)]);
    }

    function getSimulationPacket() {
      return { revision: revision, layoutRevision: layoutRevision, gestures: gestures.map(copyGesture) };
    }

    function getVisiblePacket(viewport) {
      viewport = viewport || {};
      var normalizedViewport = {
        width: Math.max(1, finite(viewport.width, 1)),
        height: Math.max(1, finite(viewport.height, 1)),
        scrollX: finite(viewport.scrollX, 0),
        scrollY: finite(viewport.scrollY, 0),
        documentWidth: Math.max(1, finite(viewport.documentWidth, viewport.width || 1)),
        documentHeight: Math.max(1, finite(viewport.documentHeight, viewport.height || 1))
      };
      var visible = [];
      var ids = [];
      for (var index = 0; index < gestures.length; index += 1) {
        var gesture = gestures[index];
        if (!intersectsViewport(gesture, normalizedViewport)) continue;
        ids.push(gesture.id);
        visible.push(copyGesture(gesture));
      }
      return {
        count: visible.length,
        ids: ids,
        gestures: visible,
        viewport: normalizedViewport
      };
    }

    var api = {
      maxGestures: maxGestures,
      upsertGesture: upsertGesture,
      setReveal: setReveal,
      reflow: reflow,
      getGesture: getGesture,
      getSimulationPacket: getSimulationPacket,
      getVisiblePacket: getVisiblePacket
    };
    Object.defineProperty(api, 'count', {
      enumerable: true,
      get: function getCount() { return gestures.length; }
    });
    return api;
  };
})(window);
