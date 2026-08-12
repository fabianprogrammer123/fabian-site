(function paintJourneyRope(window) {
  'use strict';

  var PaintJourney = window.PaintJourney = window.PaintJourney || {};

  PaintJourney.createRope = function createRope(options) {
    options = options || {};
    var THREE = options.THREE;
    var scene = options.scene;
    var segments = Math.max(4, Math.floor(Number(options.segments) || 20));
    if (!THREE || !scene) throw new Error('PaintJourney.createRope requires THREE and a scene');

    var positions = new Float32Array((segments + 1) * 3);
    var geometry = new THREE.BufferGeometry();
    var positionAttribute = new THREE.BufferAttribute(positions, 3);
    geometry.setAttribute('position', positionAttribute);
    geometry.setDrawRange(0, segments + 1);

    var material = new THREE.LineBasicMaterial({
      color: 0x252525,
      linewidth: 3,
      transparent: true,
      opacity: 0.92,
      depthTest: true,
      depthWrite: true
    });
    var line = new THREE.Line(geometry, material);
    line.name = 'paint-journey-rope';
    line.frustumCulled = false;
    line.renderOrder = 4;
    line.visible = false;
    scene.add(line);

    var from = new THREE.Vector3();
    var to = new THREE.Vector3();
    var head = new THREE.Vector3();
    var sample = new THREE.Vector3();
    var curveSample = new THREE.Vector3();
    var controlPoints = [];
    for (var pointIndex = 0; pointIndex <= segments; pointIndex += 1) {
      controlPoints.push(new THREE.Vector3());
    }
    var curve = new THREE.CatmullRomCurve3(controlPoints, false, 'catmullrom', 0.5);

    var visible = false;
    var caught = false;
    var disposed = false;
    var throwing = false;
    var throwElapsed = 0;
    var throwDuration = 0.7;
    var waveTime = 0;
    var sag = 0;
    var sagVelocity = 0;
    var needsGeometryUpdate = false;

    function copyPoint(target, source) {
      target.set(Number(source && source.x) || 0, Number(source && source.y) || 0, Number(source && source.z) || 0);
    }

    function distanceBetween(a, b) {
      var x = b.x - a.x;
      var y = b.y - a.y;
      var z = b.z - a.z;
      return Math.sqrt(x * x + y * y + z * z);
    }

    function setControlPoint(index, endPoint, caughtState) {
      var t = index / segments;
      var point = controlPoints[index];
      point.x = from.x + (endPoint.x - from.x) * t;
      point.y = from.y + (endPoint.y - from.y) * t;
      point.z = from.z + (endPoint.z - from.z) * t;
      var envelope = Math.sin(Math.PI * t);

      if (caughtState) {
        point.y -= sag * envelope;
        point.z += Math.sin(waveTime * 5.2 - t * 10.5) * envelope * 0.85;
        point.x += Math.sin(waveTime * 3.4 + t * 7.0) * envelope * 0.32;
      } else {
        point.y -= Math.sin(Math.PI * t) * 3.5 * (1 - t);
      }
    }

    function rebuildGeometry(endPoint, caughtState) {
      for (var index = 0; index <= segments; index += 1) setControlPoint(index, endPoint, caughtState);
      for (var sampleIndex = 0; sampleIndex <= segments; sampleIndex += 1) {
        curve.getPoint(sampleIndex / segments, curveSample);
        var offset = sampleIndex * 3;
        positions[offset] = curveSample.x;
        positions[offset + 1] = curveSample.y;
        positions[offset + 2] = curveSample.z;
      }
      positionAttribute.needsUpdate = true;
      if (typeof geometry.computeBoundingSphere === 'function') geometry.computeBoundingSphere();
      needsGeometryUpdate = false;
    }

    function setEndpoints(nextFrom, nextTo) {
      if (disposed) return;
      copyPoint(from, nextFrom);
      copyPoint(to, nextTo);
      if (!throwing) head.copy(to);
      visible = true;
      line.visible = true;
      needsGeometryUpdate = true;
    }

    function throwBetween(nextFrom, nextTo, duration) {
      if (disposed) return;
      copyPoint(from, nextFrom);
      copyPoint(to, nextTo);
      head.copy(from);
      throwDuration = Math.max(0.08, Number(duration) || 0.7);
      throwElapsed = 0;
      waveTime = 0;
      sag = 0;
      sagVelocity = 0;
      throwing = true;
      caught = false;
      visible = true;
      line.visible = true;
      needsGeometryUpdate = true;
    }

    function update(delta) {
      if (disposed || !visible || !line.visible) return;
      delta = Math.max(0, Math.min(0.05, Number(delta) || 0));
      waveTime += delta;

      if (throwing) {
        throwElapsed += delta;
        var progress = Math.min(1, throwElapsed / throwDuration);
        var eased = 1 - Math.pow(1 - progress, 2);
        sample.copy(from).lerp(to, eased);
        var distance = distanceBetween(from, to);
        sample.y += Math.sin(Math.PI * progress) * Math.min(110, Math.max(24, distance * 0.24));
        head.copy(sample);
        needsGeometryUpdate = true;
        if (progress >= 1) {
          head.copy(to);
          throwing = false;
          caught = true;
        }
      }

      if (caught) {
        var ropeLength = distanceBetween(from, to);
        var targetSag = Math.min(30, Math.max(3, ropeLength * 0.055));
        var omega = 13;
        sagVelocity += (omega * omega * (targetSag - sag) - 2 * omega * sagVelocity) * delta;
        sag += sagVelocity * delta;
        needsGeometryUpdate = true;
      }

      if (needsGeometryUpdate) rebuildGeometry(caught ? to : head, caught);
    }

    function hide() {
      if (disposed) return;
      visible = false;
      line.visible = false;
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      visible = false;
      line.visible = false;
      if (line.parent) line.parent.remove(line);
      geometry.dispose();
      material.dispose();
    }

    var api = {
      throwBetween: throwBetween,
      update: update,
      setEndpoints: setEndpoints,
      hide: hide,
      dispose: dispose
    };
    Object.defineProperty(api, 'caught', { enumerable: true, get: function () { return caught; } });
    return api;
  };
}(window));
