(function paintJourneyLiquid(window) {
  'use strict';

  var PaintJourney = window.PaintJourney = window.PaintJourney || {};
  var MAX_GESTURES = 12;
  var DESKTOP_SCALE = 0.72;
  var MOBILE_SCALE = 0.55;
  var TARGET_PIXEL_CAP = 900000;
  var DESKTOP_AMBIENT_INTERVAL = 1 / 24;
  var MOBILE_AMBIENT_INTERVAL = 1 / 15;

  var FIELD_VERTEX_SHADER = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position.xy, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FIELD_FRAGMENT_SHADER = [
    'varying vec2 vUv;',
    'uniform float uTime;',
    'uniform int uGestureCount;',
    'uniform vec4 uViewport;',
    'uniform vec2 uDocumentSize;',
    'uniform vec2 uTargetSize;',
    'uniform vec4 uGestureStartControl[12];',
    'uniform vec4 uGestureEndShape[12];',
    'uniform vec4 uGestureStyle[12];',
    'uniform vec4 uEmitterPath;',
    'uniform vec4 uEmitterStyle;',
    'const int CONTOUR_BANDS = 6;',
    'const float PIGMENT_NEIGHBOR = 0.038;',
    '',
    'vec2 quadraticPoint(vec2 from, vec2 control, vec2 to, float t) {',
    '  float inverse = 1.0 - t;',
    '  return inverse * inverse * from + 2.0 * inverse * t * control + t * t * to;',
    '}',
    '',
    'float lineSegmentDistance(vec2 point, vec2 from, vec2 to) {',
    '  vec2 span = to - from;',
    '  float amount = clamp(dot(point - from, span) / max(dot(span, span), 0.0001), 0.0, 1.0);',
    '  return length(point - (from + span * amount));',
    '}',
    '',
    'float quadraticDistance(vec2 point, vec2 from, vec2 control, vec2 to, float reveal) {',
    '  float distanceToCurve = 100000.0;',
    '  for (int sampleIndex = 0; sampleIndex < 9; sampleIndex += 1) {',
    '    float fromT = reveal * float(sampleIndex) / 9.0;',
    '    float toT = reveal * float(sampleIndex + 1) / 9.0;',
    '    vec2 segmentFrom = quadraticPoint(from, control, to, fromT);',
    '    vec2 segmentTo = quadraticPoint(from, control, to, toT);',
    '    distanceToCurve = min(distanceToCurve, lineSegmentDistance(point, segmentFrom, segmentTo));',
    '  }',
    '  return distanceToCurve;',
    '}',
    '',
    'float smoothMinPolynomial(float first, float second, float radius) {',
    '  float safeRadius = max(radius, 0.001);',
    '  float blend = max(safeRadius - abs(first - second), 0.0) / safeRadius;',
    '  return min(first, second) - blend * blend * safeRadius * 0.25;',
    '}',
    '',
    'vec2 domainWarp(vec2 point, float time) {',
    '  float slowTime = time * 0.085;',
    '  vec2 firstWarp = vec2(',
    '    sin(point.y * 0.0062 + slowTime),',
    '    cos(point.x * 0.0051 - slowTime * 0.83)',
    '  );',
    '  vec2 secondWarp = vec2(',
    '    sin((point.x + point.y) * 0.0027 - slowTime * 0.61),',
    '    cos((point.x - point.y) * 0.0031 + slowTime * 0.72)',
    '  );',
    '  return point + firstWarp * 8.5 + secondWarp * 5.0;',
    '}',
    '',
    'vec3 groundedPigment(float phase) {',
    '  float place = fract(phase) * 6.0;',
    '  vec3 cadmium = vec3(0.78, 0.105, 0.075);',
    '  vec3 ochre = vec3(0.86, 0.48, 0.075);',
    '  vec3 viridian = vec3(0.035, 0.42, 0.285);',
    '  vec3 cobalt = vec3(0.045, 0.265, 0.64);',
    '  vec3 violet = vec3(0.275, 0.12, 0.46);',
    '  vec3 magenta = vec3(0.60, 0.075, 0.31);',
    '  if (place < 1.0) return mix(cadmium, ochre, place);',
    '  if (place < 2.0) return mix(ochre, viridian, place - 1.0);',
    '  if (place < 3.0) return mix(viridian, cobalt, place - 2.0);',
    '  if (place < 4.0) return mix(cobalt, violet, place - 3.0);',
    '  if (place < 5.0) return mix(violet, magenta, place - 4.0);',
    '  return mix(magenta, cadmium, place - 5.0);',
    '}',
    '',
    'vec3 contourPigment(float phase, float band) {',
    '  vec3 lowerPigment = groundedPigment(phase - PIGMENT_NEIGHBOR);',
    '  vec3 pigment = groundedPigment(phase);',
    '  vec3 upperPigment = groundedPigment(phase + PIGMENT_NEIGHBOR);',
    '  vec3 earthShadow = mix(lowerPigment, pigment, 0.22) * vec3(0.36, 0.32, 0.38);',
    '  vec3 lowerBody = mix(lowerPigment, pigment, 0.58);',
    '  vec3 upperBody = mix(pigment, upperPigment, 0.54);',
    '  vec3 warmLight = mix(upperPigment, vec3(0.94, 0.79, 0.61), 0.26);',
    '  if (band < 0.5) return earthShadow;',
    '  if (band < 1.5) return lowerBody * vec3(0.68, 0.66, 0.72);',
    '  if (band < 2.5) return mix(lowerBody, pigment, 0.72) * vec3(0.90, 0.94, 0.88);',
    '  if (band < 3.5) return mix(pigment, upperBody, 0.38);',
    '  if (band < 4.5) return upperBody * vec3(0.82, 0.88, 0.94);',
    '  return warmLight;',
    '}',
    '',
    'void main() {',
    '  vec2 screenPoint = vec2(vUv.x, 1.0 - vUv.y) * uViewport.zw;',
    '  vec2 documentPoint = screenPoint + uViewport.xy;',
    '  vec2 warpedPoint = domainWarp(documentPoint, uTime);',
    '  float liquidDistance = 100000.0;',
    '  float nearestDistance = 100000.0;',
    '  float nearestWidth = 1.0;',
    '  float nearestPhase = 0.0;',
    '  float nearestSeed = 0.0;',
    '',
    '  for (int gestureIndex = 0; gestureIndex < 12; gestureIndex += 1) {',
    '    if (gestureIndex < uGestureCount) {',
    '      vec4 startControl = uGestureStartControl[gestureIndex];',
    '      vec4 endShape = uGestureEndShape[gestureIndex];',
    '      vec4 style = uGestureStyle[gestureIndex];',
    '      if (endShape.w > 0.0001) {',
    '        float width = max(1.0, endShape.z * style.z);',
    '        vec2 seededPoint = warpedPoint + vec2(',
    '          sin((warpedPoint.y + style.y * 31.0) * 0.009),',
    '          cos((warpedPoint.x - style.y * 27.0) * 0.008)',
    '        ) * min(10.0, width * 0.035);',
    '        float centerDistance = quadraticDistance(',
    '          seededPoint, startControl.xy, startControl.zw, endShape.xy, endShape.w',
    '        );',
    '        float strokeDistance = centerDistance - width * 0.5;',
    '        float softness = clamp(width * 0.16, 12.0, 44.0);',
    '        liquidDistance = smoothMinPolynomial(liquidDistance, strokeDistance, softness);',
    '        if (strokeDistance < nearestDistance) {',
    '          nearestDistance = strokeDistance;',
    '          nearestWidth = width;',
    '          nearestPhase = style.x;',
    '          nearestSeed = style.y;',
    '        }',
    '      }',
    '    }',
    '  }',
    '',
    '  if (uEmitterStyle.x > 0.5) {',
    '    vec2 emitterFront = mix(uEmitterPath.xy, uEmitterPath.zw, clamp(uEmitterStyle.y, 0.0, 1.0));',
    '    float emitterRadius = 10.0 + uEmitterStyle.y * 24.0;',
    '    float emitterDistance = lineSegmentDistance(documentPoint, uEmitterPath.xy, emitterFront) - emitterRadius;',
    '    liquidDistance = smoothMinPolynomial(liquidDistance, emitterDistance, 18.0);',
    '    if (emitterDistance < nearestDistance) {',
    '      nearestDistance = emitterDistance;',
    '      nearestWidth = emitterRadius * 2.0;',
    '      nearestPhase = uEmitterStyle.z;',
    '      nearestSeed = 0.0;',
    '    }',
    '  }',
    '',
    '  float edgeFeather = max(1.5, min(uViewport.z, uViewport.w) / max(min(uTargetSize.x, uTargetSize.y), 1.0));',
    '  float bodyAlpha = 1.0 - smoothstep(-edgeFeather, edgeFeather * 1.5, liquidDistance);',
    '  float interior = max(0.0, -liquidDistance);',
    '  float bandCoordinate = clamp(interior / max(nearestWidth * 0.075, 1.0), 0.0, float(CONTOUR_BANDS) - 0.001);',
    '  float contourBand = floor(bandCoordinate);',
    '  vec3 color = contourPigment(nearestPhase + nearestSeed * 0.0015, contourBand);',
    '',
    '  float capillaryEdge = exp(-abs(liquidDistance + 1.2) / max(2.2, edgeFeather * 1.8));',
    '  float selfShadow = smoothstep(0.0, 18.0, interior) * (1.0 - smoothstep(26.0, 94.0, interior));',
    '  float pearlGlint = exp(-pow((bandCoordinate - 3.65) * 1.65, 2.0)) *',
    '    (0.52 + 0.48 * sin(documentPoint.x * 0.018 + documentPoint.y * 0.006 - uTime * 0.12));',
    '  color *= 1.0 - capillaryEdge * 0.34;',
    '  color *= 1.0 - selfShadow * 0.12;',
    '  color = mix(color, vec3(0.96, 0.91, 0.84), pearlGlint * 0.16);',
    '  float groundedAlpha = bodyAlpha * 0.94;',
    '  gl_FragColor = vec4(color, groundedAlpha);',
    '}'
  ].join('\n');

  function finite(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function copyPoint(point) {
    return {
      x: finite(point && point.x, 0),
      y: finite(point && point.y, 0)
    };
  }

  PaintJourney.createLiquidField = function createLiquidField(options) {
    options = options || {};
    var THREE = options.THREE;
    var renderer = options.renderer;
    var scene = options.scene;
    var model = options.model;
    if (!THREE || !renderer || !scene || !model || typeof model.getVisiblePacket !== 'function') {
      throw new Error('PaintJourney.createLiquidField requires THREE, a renderer, a scene, and a liquid model');
    }

    var mobile = Boolean(options.mobile);
    var internalScale = mobile ? MOBILE_SCALE : DESKTOP_SCALE;
    var ambientInterval = mobile ? MOBILE_AMBIENT_INTERVAL : DESKTOP_AMBIENT_INTERVAL;
    var gestureStartControl = new Float32Array(MAX_GESTURES * 4);
    var gestureEndShape = new Float32Array(MAX_GESTURES * 4);
    var gestureStyle = new Float32Array(MAX_GESTURES * 4);
    var viewportUniform = new Float32Array([0, 0, 1, 1]);
    var documentSizeUniform = new Float32Array([1, 1]);
    var targetSizeUniform = new Float32Array([1, 1]);
    var emitterPath = new Float32Array(4);
    var emitterStyle = new Float32Array(4);
    var uniforms = {
      uTime: { value: 0 },
      uGestureCount: { value: 0 },
      uViewport: { value: viewportUniform },
      uDocumentSize: { value: documentSizeUniform },
      uTargetSize: { value: targetSizeUniform },
      uGestureStartControl: { value: gestureStartControl },
      uGestureEndShape: { value: gestureEndShape },
      uGestureStyle: { value: gestureStyle },
      uEmitterPath: { value: emitterPath },
      uEmitterStyle: { value: emitterStyle }
    };

    var target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false
    });
    if (target.texture) target.texture.name = 'paint-journey-liquid-field';

    var liquidScene = new THREE.Scene();
    var liquidCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    var fieldGeometry = new THREE.PlaneGeometry(2, 2);
    var fieldMaterial = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: FIELD_VERTEX_SHADER,
      fragmentShader: FIELD_FRAGMENT_SHADER,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending
    });
    var fieldMesh = new THREE.Mesh(fieldGeometry, fieldMaterial);
    fieldMesh.frustumCulled = false;
    liquidScene.add(fieldMesh);

    var compositeGeometry = new THREE.PlaneGeometry(1, 1);
    var compositeMaterial = new THREE.MeshBasicMaterial({
      map: target.texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: false
    });
    var composite = new THREE.Mesh(compositeGeometry, compositeMaterial);
    composite.name = 'paint-journey-liquid-composite';
    composite.position.set(0.5, 0.5, 4);
    composite.renderOrder = 1;
    composite.frustumCulled = false;
    scene.add(composite);

    var viewport = {
      width: 1,
      height: 1,
      scrollX: 0,
      scrollY: 0,
      documentWidth: 1,
      documentHeight: 1
    };
    var emitterState = {
      active: 0,
      originX: 0,
      originY: 0,
      frontX: 0,
      frontY: 0,
      pressure: 0,
      palettePhase: 0
    };
    var ambient = false;
    var frozen = false;
    var dirty = true;
    var disposed = false;
    var ambientAccumulator = 0;

    function targetDimensions(width, height) {
      var targetWidth = Math.max(1, Math.floor(width * internalScale));
      var targetHeight = Math.max(1, Math.floor(height * internalScale));
      var pixels = targetWidth * targetHeight;
      if (pixels > TARGET_PIXEL_CAP) {
        var reduction = Math.sqrt(TARGET_PIXEL_CAP / pixels);
        targetWidth = Math.max(1, Math.floor(targetWidth * reduction));
        targetHeight = Math.max(1, Math.floor(targetHeight * reduction));
      }
      return { width: targetWidth, height: targetHeight };
    }

    function resizeTarget() {
      var dimensions = targetDimensions(viewport.width, viewport.height);
      if (target.width !== dimensions.width || target.height !== dimensions.height) {
        target.setSize(dimensions.width, dimensions.height);
      }
      targetSizeUniform[0] = dimensions.width;
      targetSizeUniform[1] = dimensions.height;
    }

    function setViewport(nextViewport) {
      if (disposed) return false;
      nextViewport = nextViewport || {};
      var nextWidth = Math.max(1, finite(nextViewport.width, viewport.width));
      var nextHeight = Math.max(1, finite(nextViewport.height, viewport.height));
      var nextScrollX = finite(nextViewport.scrollX, viewport.scrollX);
      var nextScrollY = finite(nextViewport.scrollY, viewport.scrollY);
      var nextDocumentWidth = Math.max(1, finite(nextViewport.documentWidth, viewport.documentWidth));
      var nextDocumentHeight = Math.max(1, finite(nextViewport.documentHeight, viewport.documentHeight));
      if (viewport.width === nextWidth && viewport.height === nextHeight &&
          viewport.scrollX === nextScrollX && viewport.scrollY === nextScrollY &&
          viewport.documentWidth === nextDocumentWidth && viewport.documentHeight === nextDocumentHeight) {
        return false;
      }
      viewport.width = nextWidth;
      viewport.height = nextHeight;
      viewport.scrollX = nextScrollX;
      viewport.scrollY = nextScrollY;
      viewport.documentWidth = nextDocumentWidth;
      viewport.documentHeight = nextDocumentHeight;

      viewportUniform[0] = viewport.scrollX;
      viewportUniform[1] = viewport.scrollY;
      viewportUniform[2] = viewport.width;
      viewportUniform[3] = viewport.height;
      documentSizeUniform[0] = viewport.documentWidth;
      documentSizeUniform[1] = viewport.documentHeight;

      resizeTarget();
      composite.position.set(viewport.width * 0.5, viewport.height * 0.5, 4);
      composite.scale.set(viewport.width, viewport.height, 1);
      dirty = true;
      return true;
    }

    function setEmitter(emitter) {
      if (disposed) return false;
      emitter = emitter || {};
      var origin = copyPoint(emitter.origin);
      var front = copyPoint(emitter.front || emitter.origin);
      var active = emitter.active ? 1 : 0;
      var pressure = clamp(finite(emitter.pressure, 0), 0, 1);
      var palettePhase = finite(emitter.palettePhase, 0);
      if (emitterState.active === active && emitterState.originX === origin.x &&
          emitterState.originY === origin.y && emitterState.frontX === front.x &&
          emitterState.frontY === front.y && emitterState.pressure === pressure &&
          emitterState.palettePhase === palettePhase) {
        return false;
      }
      emitterState.active = active;
      emitterState.originX = origin.x;
      emitterState.originY = origin.y;
      emitterState.frontX = front.x;
      emitterState.frontY = front.y;
      emitterState.pressure = pressure;
      emitterState.palettePhase = palettePhase;
      emitterPath[0] = emitterState.originX;
      emitterPath[1] = emitterState.originY;
      emitterPath[2] = emitterState.frontX;
      emitterPath[3] = emitterState.frontY;
      emitterStyle[0] = emitterState.active;
      emitterStyle[1] = emitterState.pressure;
      emitterStyle[2] = emitterState.palettePhase;
      emitterStyle[3] = 0;
      dirty = true;
      return true;
    }

    function setMobile(value) {
      if (disposed) return false;
      var nextMobile = Boolean(value);
      if (mobile === nextMobile) return false;
      mobile = nextMobile;
      internalScale = mobile ? MOBILE_SCALE : DESKTOP_SCALE;
      ambientInterval = mobile ? MOBILE_AMBIENT_INTERVAL : DESKTOP_AMBIENT_INTERVAL;
      ambientAccumulator = 0;
      resizeTarget();
      dirty = true;
      return true;
    }

    function uploadVisibleGestures() {
      var packet = model.getVisiblePacket(viewport);
      gestureStartControl.fill(0);
      gestureEndShape.fill(0);
      gestureStyle.fill(0);
      var count = Math.min(MAX_GESTURES, packet && packet.gestures ? packet.gestures.length : 0);
      for (var index = 0; index < count; index += 1) {
        var gesture = packet.gestures[index];
        var offset = index * 4;
        gestureStartControl[offset] = gesture.from.x;
        gestureStartControl[offset + 1] = gesture.from.y;
        gestureStartControl[offset + 2] = gesture.control.x;
        gestureStartControl[offset + 3] = gesture.control.y;
        gestureEndShape[offset] = gesture.to.x;
        gestureEndShape[offset + 1] = gesture.to.y;
        gestureEndShape[offset + 2] = gesture.width;
        gestureEndShape[offset + 3] = gesture.reveal;
        gestureStyle[offset] = gesture.palettePhase;
        gestureStyle[offset + 1] = gesture.seed;
        gestureStyle[offset + 2] = gesture.spread;
        gestureStyle[offset + 3] = gesture.kind;
      }
      uniforms.uGestureCount.value = count;
    }

    function shouldRender(delta) {
      if (frozen) return dirty;
      if (!ambient) return true;
      if (dirty) {
        ambientAccumulator = 0;
        return true;
      }
      ambientAccumulator += Math.max(0, finite(delta, 0));
      if (ambientAccumulator + 0.000001 < ambientInterval) return false;
      ambientAccumulator %= ambientInterval;
      return true;
    }

    function update(delta, time) {
      if (disposed || !shouldRender(delta)) return false;
      uploadVisibleGestures();
      if (!frozen) uniforms.uTime.value = Math.max(0, finite(time, uniforms.uTime.value));
      var previousTarget = typeof renderer.getRenderTarget === 'function'
        ? renderer.getRenderTarget()
        : null;
      renderer.setRenderTarget(target);
      renderer.render(liquidScene, liquidCamera);
      renderer.setRenderTarget(previousTarget);
      dirty = false;
      return true;
    }

    function setAmbient(value) {
      if (disposed) return;
      ambient = Boolean(value);
      ambientAccumulator = 0;
      dirty = true;
    }

    function freeze() {
      if (disposed) return;
      frozen = true;
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      if (composite.parent) composite.parent.remove(composite);
      if (fieldMesh.parent) fieldMesh.parent.remove(fieldMesh);
      target.dispose();
      fieldGeometry.dispose();
      fieldMaterial.dispose();
      compositeGeometry.dispose();
      compositeMaterial.dispose();
    }

    return {
      setViewport: setViewport,
      setEmitter: setEmitter,
      setMobile: setMobile,
      update: update,
      setAmbient: setAmbient,
      freeze: freeze,
      dispose: dispose
    };
  };
})(window);
