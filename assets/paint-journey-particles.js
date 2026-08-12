(function paintJourneyParticles(window) {
  'use strict';

  var PaintJourney = window.PaintJourney = window.PaintJourney || {};
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
      r: from[1] + (to[1] - from[1]) * progress,
      g: from[2] + (to[2] - from[2]) * progress,
      b: from[3] + (to[3] - from[3]) * progress
    };
  }

  var resolvePigment = PaintJourney.pigmentRgb || pigmentRgb;
  PaintJourney.pigmentRgb = resolvePigment;

  PaintJourney.createParticles = function createParticles(options) {
    options = options || {};
    var THREE = options.THREE;
    var scene = options.scene;
    var trail = options.trail;
    if (!THREE || !scene || !trail || typeof trail.stamp !== 'function') {
      throw new Error('PaintJourney.createParticles requires THREE, a scene, and a trail');
    }

    var mobile = Boolean(options.mobile);
    var maximum = mobile ? 260 : 600;
    var requestedCapacity = Math.floor(Number(options.capacity) || maximum);
    var capacity = Math.max(1, Math.min(maximum, requestedCapacity));
    var positions = new Float32Array(capacity * 3);
    var colors = new Float32Array(capacity * 3);
    var velocityX = new Float32Array(capacity);
    var velocityY = new Float32Array(capacity);
    var velocityZ = new Float32Array(capacity);
    var life = new Float32Array(capacity);
    var particleHue = new Float32Array(capacity);
    var documentX = new Float32Array(capacity);
    var documentY = new Float32Array(capacity);

    var geometry = new THREE.BufferGeometry();
    var positionAttribute = new THREE.BufferAttribute(positions, 3);
    var colorAttribute = new THREE.BufferAttribute(colors, 3);
    geometry.setAttribute('position', positionAttribute);
    geometry.setAttribute('color', colorAttribute);
    geometry.setDrawRange(0, 0);
    var dropletTexture = null;
    if (window.document && THREE.CanvasTexture) {
      var dropletCanvas = window.document.createElement('canvas');
      dropletCanvas.width = 64;
      dropletCanvas.height = 64;
      var dropletContext = dropletCanvas.getContext && dropletCanvas.getContext('2d');
      if (dropletContext) {
        var dropletGradient = dropletContext.createRadialGradient(25, 21, 2, 32, 32, 30);
        dropletGradient.addColorStop(0, 'rgba(255,255,255,1)');
        dropletGradient.addColorStop(0.52, 'rgba(255,255,255,0.96)');
        dropletGradient.addColorStop(0.82, 'rgba(255,255,255,0.58)');
        dropletGradient.addColorStop(1, 'rgba(255,255,255,0)');
        dropletContext.fillStyle = dropletGradient;
        dropletContext.beginPath();
        dropletContext.ellipse(32, 32, 24, 29, -0.18, 0, Math.PI * 2);
        dropletContext.fill();
        dropletTexture = new THREE.CanvasTexture(dropletCanvas);
        dropletTexture.needsUpdate = true;
      }
    }
    var material = new THREE.PointsMaterial({
      size: mobile ? 5.8 : 7.8,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.96,
      alphaTest: dropletTexture ? 0.025 : 0,
      map: dropletTexture,
      depthWrite: false
    });
    var points = new THREE.Points(geometry, material);
    points.name = 'paint-journey-particles';
    points.frustumCulled = false;
    points.renderOrder = 5;
    scene.add(points);

    var activeCount = 0;
    var hue = 0;
    var frameAverage = 16;
    var seed = 0x9e3779b9;
    var disposed = false;
    var gravity = Number.isFinite(Number(options.gravity)) ? Number(options.gravity) : -420;
    var drag = Number.isFinite(Number(options.drag)) ? Math.max(0, Number(options.drag)) : 1.65;
    var pagePlaneZ = Number.isFinite(Number(options.pagePlaneZ)) ? Number(options.pagePlaneZ) : 0;
    var toDocument = typeof options.toDocument === 'function' ? options.toDocument : null;
    var color = new THREE.Color();
    var scenePoint = new THREE.Vector3();
    var documentPoint = { x: 0, y: 0 };
    var stampPayload = { x: 0, y: 0, hue: 0, radius: 0, alpha: 0 };

    function random() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    function component(vector, key) {
      var value = Number(vector && vector[key]);
      return Number.isFinite(value) ? value : 0;
    }

    function setParticleColor(index, nextHue) {
      var pigment = resolvePigment(nextHue);
      var variation = 0.88 + random() * 0.12;
      var chalk = random() * 0.055;
      color.setRGB(
        Math.min(1, pigment.r / 255 * variation + chalk),
        Math.min(1, pigment.g / 255 * variation + chalk),
        Math.min(1, pigment.b / 255 * variation + chalk)
      );
      var offset = index * 3;
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
    }

    function addParticles(config, widerCone) {
      if (disposed || !config || !config.origin) return 0;
      var emissionScale = frameAverage > 22 ? 0.48 : 1;
      var requested = Math.max(0, Math.floor(Number(config.count) || (widerCone ? 42 : 8)));
      var count = Math.max(requested > 0 ? 1 : 0, Math.floor(requested * emissionScale));
      count = Math.min(count, capacity - activeCount);
      var origin = config.origin;
      var velocity = config.velocity || {};
      var bucketVelocity = config.bucketVelocity || {};
      var baseHue = Number.isFinite(Number(config.hue)) ? Number(config.hue) : hue;
      var spread = widerCone ? 190 : 52;
      var depthSpread = widerCone ? 125 : 34;

      for (var emitted = 0; emitted < count; emitted += 1) {
        var index = activeCount;
        activeCount += 1;
        var offset = index * 3;
        positions[offset] = component(origin, 'x');
        positions[offset + 1] = component(origin, 'y');
        positions[offset + 2] = Math.max(pagePlaneZ + 0.5, component(origin, 'z'));
        velocityX[index] = component(velocity, 'x') + component(bucketVelocity, 'x') + (random() - 0.5) * spread;
        velocityY[index] = component(velocity, 'y') + component(bucketVelocity, 'y') + (random() - 0.5) * spread;
        velocityZ[index] = component(velocity, 'z') + component(bucketVelocity, 'z') - (0.3 + random()) * depthSpread;
        life[index] = (widerCone ? 0.65 : 0.9) + random() * (widerCone ? 0.55 : 0.85);
        particleHue[index] = (baseHue + emitted * (widerCone ? 360 / Math.max(1, count) : 5.5)) % 360;
        documentX[index] = 0;
        documentY[index] = 0;
        setParticleColor(index, particleHue[index]);
      }
      geometry.setDrawRange(0, activeCount);
      positionAttribute.needsUpdate = true;
      colorAttribute.needsUpdate = true;
      return count;
    }

    function emit(config) {
      return addParticles(config, false);
    }

    function burst(config) {
      config = config || {};
      return addParticles(config, true);
    }

    function copySlot(target, source) {
      var targetOffset = target * 3;
      var sourceOffset = source * 3;
      positions[targetOffset] = positions[sourceOffset];
      positions[targetOffset + 1] = positions[sourceOffset + 1];
      positions[targetOffset + 2] = positions[sourceOffset + 2];
      colors[targetOffset] = colors[sourceOffset];
      colors[targetOffset + 1] = colors[sourceOffset + 1];
      colors[targetOffset + 2] = colors[sourceOffset + 2];
      velocityX[target] = velocityX[source];
      velocityY[target] = velocityY[source];
      velocityZ[target] = velocityZ[source];
      life[target] = life[source];
      particleHue[target] = particleHue[source];
      documentX[target] = documentX[source];
      documentY[target] = documentY[source];
    }

    function retire(index) {
      activeCount -= 1;
      if (index !== activeCount) copySlot(index, activeCount);
      life[activeCount] = 0;
    }

    function mapToDocument(index) {
      var offset = index * 3;
      scenePoint.set(positions[offset], positions[offset + 1], pagePlaneZ);
      if (toDocument) {
        var mapped = toDocument(scenePoint, documentPoint);
        if (mapped && mapped !== documentPoint) {
          documentPoint.x = mapped.x;
          documentPoint.y = mapped.y;
        }
      } else {
        documentPoint.x = scenePoint.x + (window.scrollX || window.pageXOffset || 0);
        documentPoint.y = scenePoint.y + (window.scrollY || window.pageYOffset || 0);
      }
      documentX[index] = Number(documentPoint.x) || 0;
      documentY[index] = Number(documentPoint.y) || 0;
    }

    function stampParticle(index, speed) {
      mapToDocument(index);
      stampPayload.x = documentX[index];
      stampPayload.y = documentY[index];
      stampPayload.hue = particleHue[index];
      stampPayload.radius = Math.min(mobile ? 9 : 13, 3 + speed * 0.018);
      stampPayload.alpha = 0.48;
      trail.stamp(stampPayload);
    }

    function update(delta) {
      if (disposed) return;
      delta = Math.max(0, Math.min(0.05, Number(delta) || 0));
      frameAverage += (delta * 1000 - frameAverage) * 0.08;
      hue = (hue + delta * 52) % 360;
      var damping = Math.exp(-drag * delta);
      var index = 0;

      while (index < activeCount) {
        var offset = index * 3;
        var previousZ = positions[offset + 2];
        velocityY[index] += gravity * delta;
        velocityX[index] *= damping;
        velocityY[index] *= damping;
        velocityZ[index] *= damping;
        positions[offset] += velocityX[index] * delta;
        positions[offset + 1] += velocityY[index] * delta;
        positions[offset + 2] += velocityZ[index] * delta;
        life[index] -= delta;

        if (previousZ > pagePlaneZ && positions[offset + 2] <= pagePlaneZ) {
          var speed = Math.sqrt(velocityX[index] * velocityX[index] + velocityY[index] * velocityY[index]);
          stampParticle(index, speed);
          retire(index);
          continue;
        }
        if (life[index] <= 0) {
          retire(index);
          continue;
        }
        index += 1;
      }

      geometry.setDrawRange(0, activeCount);
      positionAttribute.needsUpdate = true;
      colorAttribute.needsUpdate = true;
    }

    function setHue(nextHue) {
      nextHue = Number(nextHue);
      if (Number.isFinite(nextHue)) hue = ((nextHue % 360) + 360) % 360;
    }

    function clear() {
      if (disposed) return;
      activeCount = 0;
      life.fill(0);
      geometry.setDrawRange(0, 0);
    }

    function dispose() {
      if (disposed) return;
      clear();
      disposed = true;
      if (points.parent) points.parent.remove(points);
      geometry.dispose();
      material.dispose();
      if (dropletTexture && typeof dropletTexture.dispose === 'function') dropletTexture.dispose();
    }

    var api = { emit: emit, burst: burst, update: update, setHue: setHue, clear: clear, dispose: dispose };
    Object.defineProperty(api, 'activeCount', { enumerable: true, get: function () { return activeCount; } });
    return api;
  };
}(window));
