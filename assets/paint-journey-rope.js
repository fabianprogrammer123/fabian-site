(function paintJourneyRope(window) {
  'use strict';

  var PaintJourney = window.PaintJourney = window.PaintJourney || {};

  PaintJourney.createRope = function createRope(options) {
    options = options || {};
    var THREE = options.THREE;
    var scene = options.scene;
    var segments = Math.max(4, Math.floor(Number(options.segments) || 20));
    if (!THREE || !scene || typeof scene.add !== 'function') {
      throw new Error('PaintJourney.createRope requires THREE and a scene');
    }

    var radius = Math.max(1.1, Number(options.radius) || 1.65);
    var ropeGroup = new THREE.Group();
    ropeGroup.name = 'paint-journey-rope';
    ropeGroup.visible = false;
    scene.add(ropeGroup);

    var bodyGeometry = new THREE.CylinderGeometry(radius, radius * 0.94, 1, 6, 1, false);
    var highlightGeometry = new THREE.CylinderGeometry(radius * 0.25, radius * 0.2, 1, 5, 1, false);
    var bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x202326,
      roughness: 0.9,
      metalness: 0.02,
      flatShading: true
    });
    var highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0x8c9194,
      transparent: true,
      opacity: 0.42,
      depthTest: true,
      depthWrite: false,
      toneMapped: false
    });
    var bodySegments = [];
    var highlights = [];

    function createSegment(index, geometry, material, renderOrder, name) {
      var segment = new THREE.Mesh(geometry, material);
      segment.name = name + '-' + index;
      segment.visible = false;
      segment.frustumCulled = false;
      segment.renderOrder = renderOrder;
      ropeGroup.add(segment);
      return segment;
    }

    for (var segmentIndex = 0; segmentIndex < segments; segmentIndex += 1) {
      bodySegments.push(createSegment(segmentIndex, bodyGeometry, bodyMaterial, 4, 'rope-body'));
      highlights.push(createSegment(segmentIndex, highlightGeometry, highlightMaterial, 5, 'rope-highlight'));
    }

    var from = new THREE.Vector3();
    var to = new THREE.Vector3();
    var head = new THREE.Vector3();
    var throwSample = new THREE.Vector3();
    var curveSample = new THREE.Vector3();
    var midpoint = new THREE.Vector3();
    var direction = new THREE.Vector3();
    var cylinderAxis = new THREE.Vector3(0, 1, 0);
    var controlPoints = [];
    var sampledPoints = [];
    for (var pointIndex = 0; pointIndex <= segments; pointIndex += 1) {
      controlPoints.push(new THREE.Vector3());
      sampledPoints.push(new THREE.Vector3());
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
      target.set(
        Number(source && source.x) || 0,
        Number(source && source.y) || 0,
        Number(source && source.z) || 0
      );
    }

    function distanceBetween(a, b) {
      var x = b.x - a.x;
      var y = b.y - a.y;
      var z = b.z - a.z;
      return Math.sqrt(x * x + y * y + z * z);
    }

    function setControlPoint(index, endPoint, caughtState) {
      var progress = index / segments;
      var point = controlPoints[index];
      point.x = from.x + (endPoint.x - from.x) * progress;
      point.y = from.y + (endPoint.y - from.y) * progress;
      point.z = from.z + (endPoint.z - from.z) * progress;
      var envelope = Math.sin(Math.PI * progress);

      if (caughtState) {
        point.y -= sag * envelope;
        point.z += Math.sin(waveTime * 5.2 - progress * 10.5) * envelope * 0.85;
        point.x += Math.sin(waveTime * 3.4 + progress * 7.0) * envelope * 0.32;
      } else {
        point.y -= Math.sin(Math.PI * progress) * 3.5 * (1 - progress);
      }
    }

    function placeSpan(index, start, end) {
      var body = bodySegments[index];
      var highlight = highlights[index];
      direction.subVectors(end, start);
      var length = direction.length();
      if (length < 0.001) {
        body.visible = false;
        highlight.visible = false;
        return;
      }

      direction.multiplyScalar(1 / length);
      midpoint.addVectors(start, end).multiplyScalar(0.5);
      body.position.copy(midpoint);
      body.scale.set(1, length * 1.1, 1);
      body.quaternion.setFromUnitVectors(cylinderAxis, direction);
      body.visible = true;

      highlight.position.copy(midpoint);
      highlight.position.z += radius * 0.76;
      highlight.scale.set(1, length * 1.08, 1);
      highlight.quaternion.copy(body.quaternion);
      highlight.visible = true;
    }

    function rebuildGeometry(endPoint, caughtState) {
      for (var index = 0; index <= segments; index += 1) {
        setControlPoint(index, endPoint, caughtState);
      }
      for (var sampleIndex = 0; sampleIndex <= segments; sampleIndex += 1) {
        curve.getPoint(sampleIndex / segments, curveSample);
        sampledPoints[sampleIndex].copy(curveSample);
      }
      for (var spanIndex = 0; spanIndex < segments; spanIndex += 1) {
        placeSpan(spanIndex, sampledPoints[spanIndex], sampledPoints[spanIndex + 1]);
      }
      needsGeometryUpdate = false;
    }

    function setEndpoints(nextFrom, nextTo) {
      if (disposed) return;
      copyPoint(from, nextFrom);
      copyPoint(to, nextTo);
      if (!throwing) head.copy(to);
      visible = true;
      ropeGroup.visible = true;
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
      ropeGroup.visible = true;
      needsGeometryUpdate = true;
    }

    function update(delta) {
      if (disposed || !visible || !ropeGroup.visible) return;
      delta = Math.max(0, Math.min(0.05, Number(delta) || 0));
      waveTime += delta;

      if (throwing) {
        throwElapsed += delta;
        var progress = Math.min(1, throwElapsed / throwDuration);
        var eased = 1 - Math.pow(1 - progress, 2);
        throwSample.copy(from).lerp(to, eased);
        var distance = distanceBetween(from, to);
        throwSample.y += Math.sin(Math.PI * progress) * Math.min(110, Math.max(24, distance * 0.24));
        head.copy(throwSample);
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
      ropeGroup.visible = false;
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      visible = false;
      ropeGroup.visible = false;
      if (ropeGroup.parent) ropeGroup.parent.remove(ropeGroup);
      bodyGeometry.dispose();
      highlightGeometry.dispose();
      bodyMaterial.dispose();
      highlightMaterial.dispose();
    }

    var api = {
      throwBetween: throwBetween,
      update: update,
      setEndpoints: setEndpoints,
      hide: hide,
      dispose: dispose
    };
    Object.defineProperty(api, 'caught', {
      enumerable: true,
      get: function () { return caught; }
    });
    return api;
  };
}(window));
