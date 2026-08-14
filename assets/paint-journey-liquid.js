(function paintJourneyLiquid(window) {
  'use strict';

  var PaintJourney = window.PaintJourney = window.PaintJourney || {};
  var IMPACT_LIMIT = 16;
  var DESKTOP_VELOCITY_SCALE = 0.18;
  var DESKTOP_VELOCITY_CAP = 300000;
  var DESKTOP_PIGMENT_SCALE = 0.30;
  var DESKTOP_PIGMENT_CAP = 720000;
  var MOBILE_VELOCITY_SCALE = 0.14;
  var MOBILE_VELOCITY_CAP = 160000;
  var MOBILE_PIGMENT_SCALE = 0.38;
  var MOBILE_PIGMENT_CAP = 420000;
  var DESKTOP_FIXED_STEP = 1 / 30;
  var MOBILE_FIXED_STEP = 1 / 20;
  var DESKTOP_MAX_STEPS = 2;
  var MOBILE_MAX_STEPS = 1;
  var DESKTOP_AMBIENT_INTERVAL = 1 / 24;
  var MOBILE_AMBIENT_INTERVAL = 1 / 15;

  var PASS_VERTEX_SHADER = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position.xy, 0.0, 1.0);',
    '}'
  ].join('\n');

  var COMPOSITE_VERTEX_SHADER = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  var CLEAR_FRAGMENT_SHADER = [
    'void main() {',
    '  gl_FragColor = vec4(0.0);',
    '}'
  ].join('\n');

  var SOURCE_VELOCITY_FRAGMENT_SHADER = [
    'varying vec2 vUv;',
    'uniform sampler2D uSource;',
    'uniform vec2 uDocumentSize;',
    'uniform int uImpactCount;',
    'uniform vec4 uImpactPointRadius[16];',
    'uniform vec4 uImpactVelocityPhase[16];',
    'void main() {',
    '  vec4 field = texture2D(uSource, vUv);',
    '  vec2 documentPoint = vec2(vUv.x * uDocumentSize.x, (1.0 - vUv.y) * uDocumentSize.y);',
    '  for (int impactIndex = 0; impactIndex < 16; impactIndex += 1) {',
    '    if (impactIndex < uImpactCount) {',
    '      vec4 pointRadius = uImpactPointRadius[impactIndex];',
    '      vec4 velocityPhase = uImpactVelocityPhase[impactIndex];',
    '      vec2 offset = documentPoint - pointRadius.xy;',
    '      float radius = max(pointRadius.z, 2.0);',
    '      float gaussian = exp(-dot(offset, offset) / (radius * radius * 0.68));',
    '      vec2 bottomUpVelocity = vec2(velocityPhase.x, -velocityPhase.y);',
    '      field.xy += bottomUpVelocity * gaussian * pointRadius.w;',
    '      field.z = max(field.z, gaussian * pointRadius.w);',
    '    }',
    '  }',
    '  gl_FragColor = vec4(clamp(field.xy, vec2(-760.0), vec2(760.0)), clamp(field.z, 0.0, 2.0), 1.0);',
    '}'
  ].join('\n');

  var SOURCE_PIGMENT_FRAGMENT_SHADER = [
    'varying vec2 vUv;',
    'uniform sampler2D uSource;',
    'uniform vec2 uDocumentSize;',
    'uniform int uImpactCount;',
    'uniform vec4 uImpactPointRadius[16];',
    'uniform vec4 uImpactVelocityPhase[16];',
    'vec3 displayPigment(float phase) {',
    '  float place = fract(phase) * 6.0;',
    '  vec3 red = vec3(0.91, 0.025, 0.016);',
    '  vec3 amber = vec3(0.98, 0.39, 0.012);',
    '  vec3 yellow = vec3(0.98, 0.79, 0.018);',
    '  vec3 green = vec3(0.012, 0.49, 0.13);',
    '  vec3 blue = vec3(0.012, 0.12, 0.82);',
    '  vec3 violet = vec3(0.48, 0.012, 0.63);',
    '  if (place < 1.0) return mix(red, amber, place);',
    '  if (place < 2.0) return mix(amber, yellow, place - 1.0);',
    '  if (place < 3.0) return mix(yellow, green, place - 2.0);',
    '  if (place < 4.0) return mix(green, blue, place - 3.0);',
    '  if (place < 5.0) return mix(blue, violet, place - 4.0);',
    '  return mix(violet, red, place - 5.0);',
    '}',
    'vec3 pigmentAbsorption(float phase) {',
    '  vec3 reflectance = max(displayPigment(phase), vec3(0.018));',
    '  return clamp(-log(reflectance) * 0.72, vec3(0.04), vec3(3.4));',
    '}',
    'void main() {',
    '  vec4 pigment = texture2D(uSource, vUv);',
    '  vec2 documentPoint = vec2(vUv.x * uDocumentSize.x, (1.0 - vUv.y) * uDocumentSize.y);',
    '  for (int impactIndex = 0; impactIndex < 16; impactIndex += 1) {',
    '    if (impactIndex < uImpactCount) {',
    '      vec4 pointRadius = uImpactPointRadius[impactIndex];',
    '      vec4 velocityPhase = uImpactVelocityPhase[impactIndex];',
    '      vec2 offset = documentPoint - pointRadius.xy;',
    '      float radius = max(pointRadius.z, 2.0);',
    '      float core = exp(-dot(offset, offset) / (radius * radius * 0.54));',
    '      float brokenEdge = 0.86 + 0.14 * sin(offset.x * 0.071 + offset.y * 0.047 + velocityPhase.w * 19.0);',
    '      float deposit = core * max(pointRadius.w, 0.0) * brokenEdge;',
    '      pigment.rgb += pigmentAbsorption(velocityPhase.z) * deposit;',
    '      pigment.a += deposit;',
    '    }',
    '  }',
    '  gl_FragColor = vec4(min(pigment.rgb, vec3(12.0)), min(pigment.a, 6.0));',
    '}'
  ].join('\n');

  var ADVECT_VELOCITY_FRAGMENT_SHADER = [
    'varying vec2 vUv;',
    'uniform sampler2D uVelocity;',
    'uniform sampler2D uPigment;',
    'uniform vec2 uDocumentSize;',
    'uniform vec2 uPigmentTexel;',
    'uniform float uDelta;',
    'uniform float uGravity;',
    'void main() {',
    '  vec2 initialVelocity = texture2D(uVelocity, vUv).xy;',
    '  vec2 backtrace = clamp(vUv - initialVelocity * uDelta / uDocumentSize, vec2(0.0), vec2(1.0));',
    '  vec2 velocity = texture2D(uVelocity, backtrace).xy;',
    '  float thickness = texture2D(uPigment, vUv).a;',
    '  float leftThickness = texture2D(uPigment, vUv - vec2(uPigmentTexel.x, 0.0)).a;',
    '  float rightThickness = texture2D(uPigment, vUv + vec2(uPigmentTexel.x, 0.0)).a;',
    '  float lowThickness = texture2D(uPigment, vUv - vec2(0.0, uPigmentTexel.y)).a;',
    '  float highThickness = texture2D(uPigment, vUv + vec2(0.0, uPigmentTexel.y)).a;',
    '  vec2 thicknessGradient = vec2(rightThickness - leftThickness, highThickness - lowThickness);',
    '  float yieldStress = mix(42.0, 12.0, smoothstep(0.0, 1.3, thickness));',
    '  float yielded = smoothstep(yieldStress * 0.72, yieldStress * 1.35, length(velocity));',
    '  float viscoplasticDrag = mix(0.73, 0.985, yielded);',
    '  velocity *= pow(viscoplasticDrag, uDelta * 30.0);',
    '  velocity -= thicknessGradient * (19.0 + 24.0 * min(thickness, 1.5));',
    '  float dripWeight = smoothstep(0.025, 0.82, thickness) * (0.30 + 0.70 * yielded);',
    '  velocity.y -= uGravity * uDelta * dripWeight;',
    '  gl_FragColor = vec4(clamp(velocity, vec2(-760.0), vec2(760.0)), yielded, 1.0);',
    '}'
  ].join('\n');

  var DIVERGENCE_FRAGMENT_SHADER = [
    'varying vec2 vUv;',
    'uniform sampler2D uVelocity;',
    'uniform vec2 uVelocityTexel;',
    'void main() {',
    '  float left = texture2D(uVelocity, vUv - vec2(uVelocityTexel.x, 0.0)).x;',
    '  float right = texture2D(uVelocity, vUv + vec2(uVelocityTexel.x, 0.0)).x;',
    '  float low = texture2D(uVelocity, vUv - vec2(0.0, uVelocityTexel.y)).y;',
    '  float high = texture2D(uVelocity, vUv + vec2(0.0, uVelocityTexel.y)).y;',
    '  float divergence = 0.5 * ((right - left) + (high - low));',
    '  gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var PRESSURE_FRAGMENT_SHADER = [
    'varying vec2 vUv;',
    'uniform sampler2D uPressure;',
    'uniform sampler2D uDivergence;',
    'uniform vec2 uVelocityTexel;',
    'void main() {',
    '  float left = texture2D(uPressure, vUv - vec2(uVelocityTexel.x, 0.0)).r;',
    '  float right = texture2D(uPressure, vUv + vec2(uVelocityTexel.x, 0.0)).r;',
    '  float low = texture2D(uPressure, vUv - vec2(0.0, uVelocityTexel.y)).r;',
    '  float high = texture2D(uPressure, vUv + vec2(0.0, uVelocityTexel.y)).r;',
    '  float divergence = texture2D(uDivergence, vUv).r;',
    '  float pressure = (left + right + low + high - divergence) * 0.25;',
    '  gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var GRADIENT_FRAGMENT_SHADER = [
    'varying vec2 vUv;',
    'uniform sampler2D uVelocity;',
    'uniform sampler2D uPressure;',
    'uniform vec2 uVelocityTexel;',
    'void main() {',
    '  float left = texture2D(uPressure, vUv - vec2(uVelocityTexel.x, 0.0)).r;',
    '  float right = texture2D(uPressure, vUv + vec2(uVelocityTexel.x, 0.0)).r;',
    '  float low = texture2D(uPressure, vUv - vec2(0.0, uVelocityTexel.y)).r;',
    '  float high = texture2D(uPressure, vUv + vec2(0.0, uVelocityTexel.y)).r;',
    '  vec2 velocity = texture2D(uVelocity, vUv).xy - vec2(right - left, high - low) * 0.5;',
    '  gl_FragColor = vec4(velocity, 0.0, 1.0);',
    '}'
  ].join('\n');

  var ADVECT_PIGMENT_FRAGMENT_SHADER = [
    'varying vec2 vUv;',
    'uniform sampler2D uPigment;',
    'uniform sampler2D uVelocity;',
    'uniform vec2 uDocumentSize;',
    'uniform vec2 uPigmentTexel;',
    'uniform float uDelta;',
    'uniform float uGravity;',
    'void main() {',
    '  vec2 velocity = texture2D(uVelocity, vUv).xy;',
    '  float thickness = texture2D(uPigment, vUv).a;',
    '  float dripMobility = smoothstep(0.018, 0.95, thickness) * (1.0 - 0.28 * smoothstep(1.4, 3.4, thickness));',
    '  velocity.y -= uGravity * (0.16 + 0.72 * dripMobility);',
    '  velocity.x += sin(vUv.y * 91.0 + thickness * 5.7) * 5.2 * dripMobility;',
    '  vec2 backtrace = clamp(vUv - velocity * uDelta / uDocumentSize, vec2(0.0), vec2(1.0));',
    '  vec4 center = texture2D(uPigment, backtrace);',
    '  vec4 left = texture2D(uPigment, backtrace - vec2(uPigmentTexel.x, 0.0));',
    '  vec4 right = texture2D(uPigment, backtrace + vec2(uPigmentTexel.x, 0.0));',
    '  vec4 low = texture2D(uPigment, backtrace - vec2(0.0, uPigmentTexel.y));',
    '  vec4 high = texture2D(uPigment, backtrace + vec2(0.0, uPigmentTexel.y));',
    '  vec4 mixedPigment = (left + right + low + high) * 0.25;',
    '  float mixing = (0.018 + 0.045 * dripMobility) * uDelta * 30.0;',
    '  vec4 pigment = mix(center, mixedPigment, clamp(mixing, 0.0, 0.12));',
    '  float settling = mix(0.99982, 0.99996, smoothstep(0.2, 2.0, pigment.a));',
    '  pigment *= pow(settling, uDelta * 30.0);',
    '  gl_FragColor = max(pigment, vec4(0.0));',
    '}'
  ].join('\n');

  var COMPOSITE_FRAGMENT_SHADER = [
    'varying vec2 vUv;',
    'uniform sampler2D uPigment;',
    'uniform vec4 uViewport;',
    'uniform vec2 uDocumentSize;',
    'uniform vec2 uPigmentTexel;',
    'uniform vec4 uContentRect;',
    'vec3 kubelkaMunkReflectance(vec3 absorption, vec3 scattering, float opticalDepth) {',
    '  vec3 ratio = absorption / max(scattering, vec3(0.001));',
    '  vec3 infiniteLayer = 1.0 + ratio - sqrt(max(ratio * ratio + 2.0 * ratio, vec3(0.0)));',
    '  float coverage = 1.0 - exp(-opticalDepth * 2.35);',
    '  return mix(vec3(0.992, 0.987, 0.976), clamp(infiniteLayer, 0.0, 1.0), coverage);',
    '}',
    'void main() {',
    '  float screenTopY = uViewport.w - vUv.y * uViewport.w;',
    '  vec2 documentUv = vec2(',
    '    (uViewport.x + vUv.x * uViewport.z) / uDocumentSize.x,',
    '    1.0 - (uViewport.y + screenTopY) / uDocumentSize.y',
    '  );',
    '  vec4 pigment = texture2D(uPigment, clamp(documentUv, vec2(0.0), vec2(1.0)));',
    '  float thickness = max(pigment.a, 0.0);',
    '  float leftThickness = texture2D(uPigment, documentUv - vec2(uPigmentTexel.x, 0.0)).a;',
    '  float rightThickness = texture2D(uPigment, documentUv + vec2(uPigmentTexel.x, 0.0)).a;',
    '  float lowThickness = texture2D(uPigment, documentUv - vec2(0.0, uPigmentTexel.y)).a;',
    '  float highThickness = texture2D(uPigment, documentUv + vec2(0.0, uPigmentTexel.y)).a;',
    '  vec3 thicknessNormal = normalize(vec3(',
    '    (leftThickness - rightThickness) * 7.5,',
    '    (lowThickness - highThickness) * 7.5,',
    '    1.0',
    '  ));',
    '  vec3 absorption = pigment.rgb / max(thickness, 0.035);',
    '  vec3 scattering = vec3(0.74, 0.78, 0.84) + 0.18 * clamp(absorption, 0.0, 1.0);',
    '  vec3 color = kubelkaMunkReflectance(absorption, scattering, thickness);',
    '  vec3 lightDirection = normalize(vec3(-0.42, 0.56, 0.71));',
    '  vec3 halfDirection = normalize(lightDirection + vec3(0.0, 0.0, 1.0));',
    '  float diffuseLight = 0.74 + 0.26 * max(dot(thicknessNormal, lightDirection), 0.0);',
    '  float wetRoughness = mix(0.34, 0.11, smoothstep(0.04, 1.1, thickness));',
    '  float specularPower = mix(24.0, 118.0, 1.0 - wetRoughness);',
    '  float wetSpecular = pow(max(dot(thicknessNormal, halfDirection), 0.0), specularPower);',
    '  float thicknessGradient = length(vec2(rightThickness - leftThickness, highThickness - lowThickness));',
    '  float meniscus = smoothstep(0.012, 0.19, thicknessGradient) * smoothstep(0.012, 0.20, thickness);',
    '  float bodyAlpha = smoothstep(0.012, 0.18, thickness);',
    '  color *= diffuseLight * mix(0.88, 1.04, smoothstep(0.1, 1.8, thickness));',
    '  color = mix(color, vec3(0.018, 0.022, 0.035), meniscus * 0.16);',
    '  color += vec3(1.0, 0.965, 0.91) * (wetSpecular * 0.34 + meniscus * wetSpecular * 0.46);',
    '  float screenX = vUv.x * uViewport.z;',
    '  float readingLane = smoothstep(uContentRect.x - uContentRect.z, uContentRect.x + uContentRect.z, screenX) *',
    '    (1.0 - smoothstep(uContentRect.y - uContentRect.z, uContentRect.y + uContentRect.z, screenX));',
    '  color = mix(color, vec3(0.97, 0.962, 0.945), readingLane * 0.055);',
    '  float alpha = bodyAlpha * mix(0.93, uContentRect.w, readingLane);',
    '  gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha);',
    '  #include <tonemapping_fragment>',
    '  #include <colorspace_fragment>',
    '}'
  ].join('\n');

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

  function quadraticPoint(from, control, to, amount) {
    var inverse = 1 - amount;
    return {
      x: inverse * inverse * from.x + 2 * inverse * amount * control.x + amount * amount * to.x,
      y: inverse * inverse * from.y + 2 * inverse * amount * control.y + amount * amount * to.y
    };
  }

  function quadraticTangent(from, control, to, amount) {
    return {
      x: 2 * (1 - amount) * (control.x - from.x) + 2 * amount * (to.x - control.x),
      y: 2 * (1 - amount) * (control.y - from.y) + 2 * amount * (to.y - control.y)
    };
  }

  PaintJourney.createLiquidField = function createLiquidField(options) {
    options = options || {};
    var THREE = options.THREE;
    var renderer = options.renderer;
    var scene = options.scene;
    var model = options.model;
    if (!THREE || !renderer || !scene || !model || typeof model.getSimulationPacket !== 'function') {
      throw new Error('PaintJourney.createLiquidField requires THREE, a renderer, a scene, and a simulation model');
    }
    if (THREE.HalfFloatType === undefined || THREE.HalfFloatType === null) {
      throw new Error('PaintJourney liquid simulation requires THREE.HalfFloatType');
    }
    if (renderer.extensions) {
      var floatColorBufferAvailable = true;
      if (typeof renderer.extensions.has === 'function') {
        floatColorBufferAvailable = renderer.extensions.has('EXT_color_buffer_float');
      } else if (typeof renderer.extensions.get === 'function') {
        floatColorBufferAvailable = Boolean(renderer.extensions.get('EXT_color_buffer_float'));
      }
      if (!floatColorBufferAvailable) {
        throw new Error('PaintJourney liquid simulation requires EXT_color_buffer_float');
      }
    }

    var mobile = Boolean(options.mobile);
    var fixedStep = mobile ? MOBILE_FIXED_STEP : DESKTOP_FIXED_STEP;
    var maximumSteps = mobile ? MOBILE_MAX_STEPS : DESKTOP_MAX_STEPS;
    var ambientInterval = mobile ? MOBILE_AMBIENT_INTERVAL : DESKTOP_AMBIENT_INTERVAL;
    var maximumTextureSize = Math.max(1, Math.floor(finite(
      renderer.capabilities && renderer.capabilities.maxTextureSize, 4096
    )));

    function createTarget(name, format) {
      var target = new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        format: format,
        type: THREE.HalfFloatType,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
        samples: 0
      });
      if (target.texture) {
        target.texture.name = name;
        target.texture.generateMipmaps = false;
        if (THREE.NoColorSpace !== undefined) target.texture.colorSpace = THREE.NoColorSpace;
      }
      return target;
    }

    var velocityA = createTarget('paint-velocity-a', THREE.RGBAFormat);
    var velocityB = createTarget('paint-velocity-b', THREE.RGBAFormat);
    var pressureA = createTarget('paint-pressure-a', THREE.RedFormat);
    var pressureB = createTarget('paint-pressure-b', THREE.RedFormat);
    var divergenceTarget = createTarget('paint-divergence', THREE.RedFormat);
    var pigmentA = createTarget('paint-pigment-a', THREE.RGBAFormat);
    var pigmentB = createTarget('paint-pigment-b', THREE.RGBAFormat);
    var targets = [velocityA, velocityB, pressureA, pressureB, divergenceTarget, pigmentA, pigmentB];
    var velocityRead = velocityA;
    var velocityWrite = velocityB;
    var pressureRead = pressureA;
    var pressureWrite = pressureB;
    var pigmentRead = pigmentA;
    var pigmentWrite = pigmentB;

    var documentSizeUniform = new Float32Array([1, 1]);
    var velocityTexelUniform = new Float32Array([1, 1]);
    var pigmentTexelUniform = new Float32Array([1, 1]);
    var viewportUniform = new Float32Array([0, 0, 1, 1]);
    var contentRectUniform = new Float32Array([0, 1, 90, 0.58]);
    var impactPointRadius = new Float32Array(IMPACT_LIMIT * 4);
    var impactVelocityPhase = new Float32Array(IMPACT_LIMIT * 4);
    var impactCountUniform = { value: 0 };

    function simulationMaterial(name, fragmentShader, uniforms) {
      var material = new THREE.ShaderMaterial({
        uniforms: uniforms || {},
        vertexShader: PASS_VERTEX_SHADER,
        fragmentShader: fragmentShader,
        transparent: false,
        depthTest: false,
        depthWrite: false,
        blending: THREE.NoBlending,
        toneMapped: false
      });
      material.name = name;
      return material;
    }

    var clearMaterial = simulationMaterial('paint-clear', CLEAR_FRAGMENT_SHADER, {});
    var sourceVelocityMaterial = simulationMaterial('paint-source-velocity', SOURCE_VELOCITY_FRAGMENT_SHADER, {
      uSource: { value: velocityRead.texture },
      uDocumentSize: { value: documentSizeUniform },
      uImpactCount: impactCountUniform,
      uImpactPointRadius: { value: impactPointRadius },
      uImpactVelocityPhase: { value: impactVelocityPhase }
    });
    var sourcePigmentMaterial = simulationMaterial('paint-source-pigment', SOURCE_PIGMENT_FRAGMENT_SHADER, {
      uSource: { value: pigmentRead.texture },
      uDocumentSize: { value: documentSizeUniform },
      uImpactCount: impactCountUniform,
      uImpactPointRadius: { value: impactPointRadius },
      uImpactVelocityPhase: { value: impactVelocityPhase }
    });
    var advectVelocityMaterial = simulationMaterial(
      'paint-advect-viscoplastic-velocity', ADVECT_VELOCITY_FRAGMENT_SHADER, {
        uVelocity: { value: velocityRead.texture },
        uPigment: { value: pigmentRead.texture },
        uDocumentSize: { value: documentSizeUniform },
        uPigmentTexel: { value: pigmentTexelUniform },
        uDelta: { value: fixedStep },
        uGravity: { value: 126 }
      }
    );
    var divergenceMaterial = simulationMaterial('paint-divergence', DIVERGENCE_FRAGMENT_SHADER, {
      uVelocity: { value: velocityRead.texture },
      uVelocityTexel: { value: velocityTexelUniform }
    });
    var pressureMaterial = simulationMaterial('paint-pressure-jacobi', PRESSURE_FRAGMENT_SHADER, {
      uPressure: { value: pressureRead.texture },
      uDivergence: { value: divergenceTarget.texture },
      uVelocityTexel: { value: velocityTexelUniform }
    });
    var gradientMaterial = simulationMaterial('paint-gradient-subtract', GRADIENT_FRAGMENT_SHADER, {
      uVelocity: { value: velocityRead.texture },
      uPressure: { value: pressureRead.texture },
      uVelocityTexel: { value: velocityTexelUniform }
    });
    var advectPigmentMaterial = simulationMaterial('paint-advect-pigment', ADVECT_PIGMENT_FRAGMENT_SHADER, {
      uPigment: { value: pigmentRead.texture },
      uVelocity: { value: velocityRead.texture },
      uDocumentSize: { value: documentSizeUniform },
      uPigmentTexel: { value: pigmentTexelUniform },
      uDelta: { value: fixedStep },
      uGravity: { value: 72 }
    });
    var simulationMaterials = [
      clearMaterial,
      sourceVelocityMaterial,
      sourcePigmentMaterial,
      advectVelocityMaterial,
      divergenceMaterial,
      pressureMaterial,
      gradientMaterial,
      advectPigmentMaterial
    ];

    var passScene = new THREE.Scene();
    var passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    var passGeometry = new THREE.PlaneGeometry(2, 2);
    var passQuad = new THREE.Mesh(passGeometry, clearMaterial);
    passQuad.frustumCulled = false;
    passScene.add(passQuad);

    var compositeUniforms = {
      uPigment: { value: pigmentRead.texture },
      uViewport: { value: viewportUniform },
      uDocumentSize: { value: documentSizeUniform },
      uPigmentTexel: { value: pigmentTexelUniform },
      uContentRect: { value: contentRectUniform }
    };
    var compositeMaterial = new THREE.ShaderMaterial({
      uniforms: compositeUniforms,
      vertexShader: COMPOSITE_VERTEX_SHADER,
      fragmentShader: COMPOSITE_FRAGMENT_SHADER,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: true
    });
    compositeMaterial.name = 'paint-wet-composite';
    var compositeGeometry = new THREE.PlaneGeometry(1, 1);
    var composite = new THREE.Mesh(compositeGeometry, compositeMaterial);
    composite.name = 'paint-journey-liquid-composite';
    composite.position.set(0.5, 0.5, 4);
    composite.renderOrder = -10;
    composite.frustumCulled = false;
    scene.add(composite);

    var viewport = {
      width: 1,
      height: 1,
      scrollX: 0,
      scrollY: 0,
      documentWidth: 1,
      documentHeight: 1,
      contentLeft: 0,
      contentRight: 1,
      contentFeather: 90,
      contentOpacity: 0.58
    };
    var emitterState = {
      active: false,
      origin: { x: 0, y: 0 },
      front: { x: 0, y: 0 },
      pressure: 0,
      palettePhase: 0
    };
    var pendingImpacts = [];
    var knownReveal = Object.create(null);
    var lastPacketRevision = -1;
    var lastLayoutRevision = -1;
    var lastRevealIntervals = [];
    var clearRequested = true;
    var ambient = false;
    var frozen = false;
    var disposed = false;
    var timeAccumulator = 0;
    var ambientAccumulator = 0;

    function fittedDimensions(width, height, scale, pixelCap) {
      var targetWidth = Math.max(1, Math.floor(width * scale));
      var targetHeight = Math.max(1, Math.floor(height * scale));
      var textureReduction = Math.min(1, maximumTextureSize / targetWidth, maximumTextureSize / targetHeight);
      if (textureReduction < 1) {
        targetWidth = Math.max(1, Math.floor(targetWidth * textureReduction));
        targetHeight = Math.max(1, Math.floor(targetHeight * textureReduction));
      }
      var pixels = targetWidth * targetHeight;
      if (pixels > pixelCap) {
        var pixelReduction = Math.sqrt(pixelCap / pixels);
        targetWidth = Math.max(1, Math.floor(targetWidth * pixelReduction));
        targetHeight = Math.max(1, Math.floor(targetHeight * pixelReduction));
      }
      return { width: targetWidth, height: targetHeight };
    }

    function resizeDocumentTargets() {
      var velocityDimensions = fittedDimensions(
        viewport.documentWidth,
        viewport.documentHeight,
        mobile ? MOBILE_VELOCITY_SCALE : DESKTOP_VELOCITY_SCALE,
        mobile ? MOBILE_VELOCITY_CAP : DESKTOP_VELOCITY_CAP
      );
      var pigmentDimensions = fittedDimensions(
        viewport.documentWidth,
        viewport.documentHeight,
        mobile ? MOBILE_PIGMENT_SCALE : DESKTOP_PIGMENT_SCALE,
        mobile ? MOBILE_PIGMENT_CAP : DESKTOP_PIGMENT_CAP
      );
      [velocityA, velocityB, pressureA, pressureB, divergenceTarget].forEach(function resizeVelocity(target) {
        if (target.width !== velocityDimensions.width || target.height !== velocityDimensions.height) {
          target.setSize(velocityDimensions.width, velocityDimensions.height);
        }
      });
      [pigmentA, pigmentB].forEach(function resizePigment(target) {
        if (target.width !== pigmentDimensions.width || target.height !== pigmentDimensions.height) {
          target.setSize(pigmentDimensions.width, pigmentDimensions.height);
        }
      });
      velocityTexelUniform[0] = 1 / velocityDimensions.width;
      velocityTexelUniform[1] = 1 / velocityDimensions.height;
      pigmentTexelUniform[0] = 1 / pigmentDimensions.width;
      pigmentTexelUniform[1] = 1 / pigmentDimensions.height;
      clearRequested = true;
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
      var nextContentLeft = finite(nextViewport.contentLeft, viewport.contentLeft);
      var nextContentRight = finite(nextViewport.contentRight, viewport.contentRight);
      var nextContentFeather = Math.max(1, finite(nextViewport.contentFeather, viewport.contentFeather));
      var nextContentOpacity = clamp(finite(nextViewport.contentOpacity, viewport.contentOpacity), 0.35, 0.82);
      var documentChanged = viewport.documentWidth !== nextDocumentWidth ||
        viewport.documentHeight !== nextDocumentHeight;
      var changed = documentChanged || viewport.width !== nextWidth || viewport.height !== nextHeight ||
        viewport.scrollX !== nextScrollX || viewport.scrollY !== nextScrollY ||
        viewport.contentLeft !== nextContentLeft || viewport.contentRight !== nextContentRight ||
        viewport.contentFeather !== nextContentFeather || viewport.contentOpacity !== nextContentOpacity;
      if (!changed) return false;

      viewport.width = nextWidth;
      viewport.height = nextHeight;
      viewport.scrollX = nextScrollX;
      viewport.scrollY = nextScrollY;
      viewport.documentWidth = nextDocumentWidth;
      viewport.documentHeight = nextDocumentHeight;
      viewport.contentLeft = Math.min(nextContentLeft, nextContentRight);
      viewport.contentRight = Math.max(nextContentLeft, nextContentRight);
      viewport.contentFeather = nextContentFeather;
      viewport.contentOpacity = nextContentOpacity;
      viewportUniform[0] = viewport.scrollX;
      viewportUniform[1] = viewport.scrollY;
      viewportUniform[2] = viewport.width;
      viewportUniform[3] = viewport.height;
      documentSizeUniform[0] = viewport.documentWidth;
      documentSizeUniform[1] = viewport.documentHeight;
      contentRectUniform[0] = viewport.contentLeft;
      contentRectUniform[1] = viewport.contentRight;
      contentRectUniform[2] = viewport.contentFeather;
      contentRectUniform[3] = viewport.contentOpacity;
      composite.position.set(viewport.width * 0.5, viewport.height * 0.5, 4);
      composite.scale.set(viewport.width, viewport.height, 1);
      if (documentChanged) resizeDocumentTargets();
      return true;
    }

    function setEmitter(emitter) {
      if (disposed) return false;
      emitter = emitter || {};
      var origin = copyPoint(emitter.origin, emitterState.origin);
      var front = copyPoint(emitter.front || emitter.origin, origin);
      var active = Boolean(emitter.active);
      var pressure = clamp(finite(emitter.pressure, 0), 0, 1);
      var palettePhase = finite(emitter.palettePhase, emitterState.palettePhase);
      var changed = emitterState.active !== active || emitterState.origin.x !== origin.x ||
        emitterState.origin.y !== origin.y || emitterState.front.x !== front.x ||
        emitterState.front.y !== front.y || emitterState.pressure !== pressure ||
        emitterState.palettePhase !== palettePhase;
      emitterState.active = active;
      emitterState.origin = origin;
      emitterState.front = front;
      emitterState.pressure = pressure;
      emitterState.palettePhase = palettePhase;
      return changed;
    }

    function normalizeImpact(impact) {
      if (!impact || !impact.origin) return null;
      var origin = copyPoint(impact.origin);
      var velocity = copyPoint(impact.velocity);
      return {
        origin: origin,
        velocity: velocity,
        radius: clamp(finite(impact.radius, 28), 2, 360),
        amount: clamp(finite(impact.amount, impact.pressure === undefined ? 0.5 : impact.pressure), 0.01, 2.5),
        palettePhase: finite(impact.palettePhase, 0)
      };
    }

    function addImpactBatch(batch) {
      if (disposed || !Array.isArray(batch)) return 0;
      var accepted = 0;
      for (var index = 0; index < batch.length && pendingImpacts.length < 256; index += 1) {
        var normalized = normalizeImpact(batch[index]);
        if (!normalized) continue;
        pendingImpacts.push(normalized);
        accepted += 1;
      }
      return accepted;
    }

    function impactsForRevealInterval(gesture, startReveal, endReveal) {
      if (endReveal <= startReveal + 0.000001) return;
      var intervalMidpoint = (startReveal + endReveal) * 0.5;
      var tangent = quadraticTangent(gesture.from, gesture.control, gesture.to, intervalMidpoint);
      var intervalLength = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y) *
        (endReveal - startReveal);
      var width = Math.max(1, finite(gesture.width, 40) * finite(gesture.spread, 1));
      var spacing = Math.max(18, width * 0.18);
      var sampleCount = clamp(Math.ceil(intervalLength / spacing), 1, 48);
      for (var sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
        var progress = startReveal + (endReveal - startReveal) *
          ((sampleIndex + 0.5) / sampleCount);
        var point = quadraticPoint(gesture.from, gesture.control, gesture.to, progress);
        var localTangent = quadraticTangent(gesture.from, gesture.control, gesture.to, progress);
        var tangentLength = Math.max(1, Math.sqrt(
          localTangent.x * localTangent.x + localTangent.y * localTangent.y
        ));
        var landingGrowth = gesture.kind < 0.5 ? (0.34 + 0.66 * Math.min(1, progress * 2.8)) : 0.78;
        pendingImpacts.push({
          origin: point,
          velocity: {
            x: localTangent.x / tangentLength * 112,
            y: localTangent.y / tangentLength * 112 + 58
          },
          radius: clamp(width * 0.23 * landingGrowth, 12, 180),
          amount: clamp(0.19 + width / 900, 0.2, 0.62),
          palettePhase: finite(gesture.palettePhase, 0) + progress * 0.34 + sampleIndex * 0.009
        });
      }
      lastRevealIntervals.push({ id: gesture.id, from: startReveal, to: endReveal });
    }

    function collectSimulationSources() {
      var packet = model.getSimulationPacket();
      lastRevealIntervals.length = 0;
      if (!packet) return;
      var layoutChanged = lastLayoutRevision >= 0 && packet.layoutRevision !== lastLayoutRevision;
      if (layoutChanged) clearRequested = true;
      if (clearRequested) knownReveal = Object.create(null);
      if (packet.revision !== lastPacketRevision || clearRequested) {
        var nextKnownReveal = Object.create(null);
        var gestures = packet.gestures || [];
        for (var index = 0; index < gestures.length; index += 1) {
          var gesture = gestures[index];
          var priorReveal = finite(knownReveal[gesture.id], 0);
          var nextReveal = clamp(finite(gesture.reveal, 0), 0, 1);
          if (nextReveal > priorReveal) impactsForRevealInterval(gesture, priorReveal, nextReveal);
          nextKnownReveal[gesture.id] = Math.max(priorReveal, nextReveal);
        }
        knownReveal = nextKnownReveal;
      }
      lastPacketRevision = finite(packet.revision, lastPacketRevision);
      lastLayoutRevision = finite(packet.layoutRevision, lastLayoutRevision);
    }

    function swapVelocity() {
      var previousRead = velocityRead;
      velocityRead = velocityWrite;
      velocityWrite = previousRead;
    }

    function swapPressure() {
      var previousRead = pressureRead;
      pressureRead = pressureWrite;
      pressureWrite = previousRead;
    }

    function swapPigment() {
      var previousRead = pigmentRead;
      pigmentRead = pigmentWrite;
      pigmentWrite = previousRead;
      compositeUniforms.uPigment.value = pigmentRead.texture;
    }

    function renderPass(material, target) {
      passQuad.material = material;
      renderer.setRenderTarget(target);
      renderer.render(passScene, passCamera);
    }

    function clearAllTargets() {
      targets.forEach(function clearTarget(target) { renderPass(clearMaterial, target); });
      clearRequested = false;
    }

    function uploadImpactChunk(impacts, startIndex) {
      impactPointRadius.fill(0);
      impactVelocityPhase.fill(0);
      var count = Math.min(IMPACT_LIMIT, impacts.length - startIndex);
      for (var index = 0; index < count; index += 1) {
        var impact = impacts[startIndex + index];
        var offset = index * 4;
        impactPointRadius[offset] = impact.origin.x;
        impactPointRadius[offset + 1] = impact.origin.y;
        impactPointRadius[offset + 2] = impact.radius;
        impactPointRadius[offset + 3] = impact.amount;
        impactVelocityPhase[offset] = impact.velocity.x;
        impactVelocityPhase[offset + 1] = impact.velocity.y;
        impactVelocityPhase[offset + 2] = impact.palettePhase;
        impactVelocityPhase[offset + 3] = (startIndex + index) * 0.61803398875;
      }
      impactCountUniform.value = count;
      return count;
    }

    function applyImpactSources(impacts) {
      for (var startIndex = 0; startIndex < impacts.length; startIndex += IMPACT_LIMIT) {
        uploadImpactChunk(impacts, startIndex);
        sourceVelocityMaterial.uniforms.uSource.value = velocityRead.texture;
        renderPass(sourceVelocityMaterial, velocityWrite);
        swapVelocity();
        sourcePigmentMaterial.uniforms.uSource.value = pigmentRead.texture;
        renderPass(sourcePigmentMaterial, pigmentWrite);
        swapPigment();
      }
      impactCountUniform.value = 0;
    }

    function emitterImpact() {
      if (!emitterState.active || emitterState.pressure <= 0.01) return null;
      var directionX = emitterState.front.x - emitterState.origin.x;
      var directionY = emitterState.front.y - emitterState.origin.y;
      var directionLength = Math.max(1, Math.sqrt(directionX * directionX + directionY * directionY));
      return {
        origin: copyPoint(emitterState.origin),
        velocity: {
          x: directionX / directionLength * (150 + emitterState.pressure * 210),
          y: directionY / directionLength * (150 + emitterState.pressure * 210) + 96
        },
        radius: 11 + emitterState.pressure * 24,
        amount: 0.16 + emitterState.pressure * 0.42,
        palettePhase: emitterState.palettePhase
      };
    }

    function simulationStep() {
      advectVelocityMaterial.uniforms.uVelocity.value = velocityRead.texture;
      advectVelocityMaterial.uniforms.uPigment.value = pigmentRead.texture;
      advectVelocityMaterial.uniforms.uDelta.value = fixedStep;
      renderPass(advectVelocityMaterial, velocityWrite);
      swapVelocity();

      divergenceMaterial.uniforms.uVelocity.value = velocityRead.texture;
      renderPass(divergenceMaterial, divergenceTarget);
      var pressureIterations = mobile ? 4 : 8;
      for (var pressureIndex = 0; pressureIndex < pressureIterations; pressureIndex += 1) {
        pressureMaterial.uniforms.uPressure.value = pressureRead.texture;
        renderPass(pressureMaterial, pressureWrite);
        swapPressure();
      }
      gradientMaterial.uniforms.uVelocity.value = velocityRead.texture;
      gradientMaterial.uniforms.uPressure.value = pressureRead.texture;
      renderPass(gradientMaterial, velocityWrite);
      swapVelocity();

      advectPigmentMaterial.uniforms.uPigment.value = pigmentRead.texture;
      advectPigmentMaterial.uniforms.uVelocity.value = velocityRead.texture;
      advectPigmentMaterial.uniforms.uDelta.value = fixedStep;
      renderPass(advectPigmentMaterial, pigmentWrite);
      swapPigment();

      var impacts = pendingImpacts.splice(0, pendingImpacts.length);
      var localEmitterImpact = emitterImpact();
      if (localEmitterImpact) impacts.push(localEmitterImpact);
      if (impacts.length) applyImpactSources(impacts);
    }

    function update(delta) {
      if (disposed || frozen) return false;
      var elapsed = clamp(finite(delta, 0), 0, 0.25);
      collectSimulationSources();
      timeAccumulator += elapsed;
      if (ambient) {
        ambientAccumulator += elapsed;
        if (ambientAccumulator + 0.000001 < ambientInterval && !clearRequested && !pendingImpacts.length) {
          return false;
        }
        ambientAccumulator %= ambientInterval;
      }

      var stepCount;
      if (ambient) {
        stepCount = 1;
        timeAccumulator = 0;
      } else {
        stepCount = Math.floor((timeAccumulator + 0.000001) / fixedStep);
        if ((clearRequested || pendingImpacts.length || emitterState.active) && stepCount < 1) stepCount = 1;
        stepCount = Math.min(maximumSteps, stepCount);
        if (stepCount < 1) return false;
        timeAccumulator = Math.max(0, timeAccumulator - stepCount * fixedStep);
      }

      var previousTarget = typeof renderer.getRenderTarget === 'function' ? renderer.getRenderTarget() : null;
      try {
        if (clearRequested) clearAllTargets();
        for (var stepIndex = 0; stepIndex < stepCount; stepIndex += 1) simulationStep();
      } finally {
        renderer.setRenderTarget(previousTarget);
      }
      return true;
    }

    function setAmbient(value) {
      if (disposed) return;
      ambient = Boolean(value);
      ambientAccumulator = 0;
      timeAccumulator = 0;
    }

    function setMobile(value) {
      if (disposed) return false;
      var nextMobile = Boolean(value);
      if (nextMobile === mobile) return false;
      mobile = nextMobile;
      fixedStep = mobile ? MOBILE_FIXED_STEP : DESKTOP_FIXED_STEP;
      maximumSteps = mobile ? MOBILE_MAX_STEPS : DESKTOP_MAX_STEPS;
      ambientInterval = mobile ? MOBILE_AMBIENT_INTERVAL : DESKTOP_AMBIENT_INTERVAL;
      ambientAccumulator = 0;
      timeAccumulator = 0;
      resizeDocumentTargets();
      return true;
    }

    function freeze() {
      if (disposed) return;
      frozen = true;
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      if (composite.parent) composite.parent.remove(composite);
      if (passQuad.parent) passQuad.parent.remove(passQuad);
      targets.forEach(function disposeTarget(target) { target.dispose(); });
      simulationMaterials.forEach(function disposeMaterial(material) { material.dispose(); });
      compositeMaterial.dispose();
      passGeometry.dispose();
      compositeGeometry.dispose();
      pendingImpacts.length = 0;
    }

    var debug = {
      targets: targets,
      materials: simulationMaterials,
      compositeUniforms: compositeUniforms,
      lastRevealIntervals: lastRevealIntervals
    };

    return {
      setViewport: setViewport,
      setEmitter: setEmitter,
      setMobile: setMobile,
      addImpactBatch: addImpactBatch,
      update: update,
      setAmbient: setAmbient,
      freeze: freeze,
      dispose: dispose,
      _debug: debug
    };
  };
})(window);
