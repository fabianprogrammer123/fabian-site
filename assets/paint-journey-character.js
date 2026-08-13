(function paintJourneyCharacter(window, document) {
  'use strict';

  var PaintJourney = window.PaintJourney = window.PaintJourney || {};

  PaintJourney.createCharacter = function createCharacter(options) {
    options = options || {};
    var THREE = options.THREE;
    var scene = options.scene;
    if (!THREE || !scene || typeof scene.add !== 'function') {
      throw new Error('PaintJourney.createCharacter requires THREE and a scene');
    }

    var PI = Math.PI;
    var TAU = PI * 2;
    var disposed = false;
    var secondaryTime = 0;
    var currentPose = 'rest';
    var reusable = {
      capsule: THREE.CapsuleGeometry
        ? new THREE.CapsuleGeometry(5, 16, 3, 8)
        : new THREE.CylinderGeometry(5, 5, 26, 8),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 10),
      sphere: new THREE.SphereGeometry(1, 12, 8),
      box: new THREE.BoxGeometry(1, 1, 1)
    };
    var charcoal = new THREE.MeshStandardMaterial({
      color: 0x242628,
      roughness: 0.82,
      metalness: 0.03,
      flatShading: true
    });
    var offWhite = new THREE.MeshPhysicalMaterial({
      color: 0xf1ede3,
      roughness: 0.76,
      metalness: 0,
      clearcoat: 0.04,
      flatShading: true
    });
    var shadowMaterial = new THREE.MeshStandardMaterial({
      color: 0x151719,
      roughness: 1,
      transparent: true,
      opacity: 0.16,
      depthWrite: false
    });
    var bucketInteriorMaterial = new THREE.MeshStandardMaterial({
      color: 0x17191a,
      roughness: 0.92,
      metalness: 0.04
    });
    var paintMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xff335f,
      emissive: 0x2a0612,
      emissiveIntensity: 0.28,
      roughness: 0.28,
      metalness: 0,
      clearcoat: 0.74,
      clearcoatRoughness: 0.2
    });

    function makeFaceTexture() {
      if (!document || typeof document.createElement !== 'function' || !THREE.CanvasTexture) return null;
      var canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      var context = canvas.getContext && canvas.getContext('2d');
      if (!context) return null;
      context.fillStyle = '#f1ede3';
      context.fillRect(0, 0, 64, 64);
      context.fillStyle = '#c8c2b6';
      for (var y = 4; y < 64; y += 8) {
        for (var x = 4; x < 64; x += 8) {
          context.beginPath();
          context.arc(x + ((y / 8) % 2) * 2, y, 1.2, 0, TAU);
          context.fill();
        }
      }
      context.fillStyle = '#242628';
      context.beginPath();
      context.arc(23, 28, 3.2, 0, TAU);
      context.arc(41, 28, 3.2, 0, TAU);
      context.fill();
      context.beginPath();
      context.moveTo(25, 41);
      context.quadraticCurveTo(32, 47, 40, 40);
      context.strokeStyle = '#242628';
      context.lineWidth = 2.4;
      context.lineCap = 'round';
      context.stroke();
      context.beginPath();
      context.arc(17, 36, 1.7, 0, TAU);
      context.arc(47, 36, 1.7, 0, TAU);
      context.fill();
      var texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    }

    var faceTexture = makeFaceTexture();
    var faceMaterial = offWhite.clone();
    if (faceTexture) faceMaterial.map = faceTexture;

    function joint(name, parent, x, y, z) {
      var node = new THREE.Object3D();
      node.name = name;
      node.position.set(x || 0, y || 0, z || 0);
      if (parent) parent.add(node);
      return node;
    }

    function mesh(name, geometry, material, parent, x, y, z, sx, sy, sz) {
      var shape = new THREE.Mesh(geometry, material);
      shape.name = name;
      shape.position.set(x || 0, y || 0, z || 0);
      shape.scale.set(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz);
      shape.castShadow = true;
      shape.receiveShadow = true;
      parent.add(shape);
      return shape;
    }

    function limb(name, parent, length, radius, material) {
      return mesh(name, reusable.cylinder, material, parent, 0, -length / 2, 0, radius, length, radius);
    }

    var root = joint('paint-climber-root');
    var rigLighting = joint('rig-lighting', root);
    var keyLight = new THREE.HemisphereLight(0xfff8e8, 0x31363d, 0.55);
    keyLight.name = 'rig-key-light';
    keyLight.position.set(20, 110, 45);
    rigLighting.add(keyLight);
    var rimLight = new THREE.DirectionalLight(0xdde7ff, 0.45);
    rimLight.name = 'rig-rim-light';
    rimLight.position.set(-45, 105, 65);
    rimLight.target.name = 'rig-rim-target';
    rimLight.target.position.set(0, 65, 0);
    rigLighting.add(rimLight);
    rigLighting.add(rimLight.target);
    var contactShadow = mesh(
      'contact-shadow',
      new THREE.CircleGeometry(18, 16),
      shadowMaterial,
      root,
      0, 2, -5,
      1.25, 0.24, 1
    );
    contactShadow.castShadow = false;
    contactShadow.receiveShadow = false;

    var pelvis = joint('pelvis', root, 0, 56, 0);
    mesh('pelvis-shell', reusable.sphere, charcoal, pelvis, 0, 0, 0, 12.8, 9.8, 8.8);

    var spine = joint('spine', pelvis, 0, 5, 0);
    var breathingJoint = joint('breathing-joint', spine);
    mesh('torso', reusable.capsule, charcoal, breathingJoint, 0, 18, 0, 2.08, 1.34, 1.34);
    var neck = joint('neck', spine, 0, 39, 0);
    mesh('neck-form', reusable.cylinder, offWhite, neck, 0, 3.5, 0, 5, 7, 5);
    var head = joint('head', neck, 0, 11, 0);
    mesh('dotted-face', reusable.sphere, faceMaterial, head, 0, 0, 0, 12.5, 13.2, 10.8);
    mesh('cap', reusable.sphere, charcoal, head, 0, 7.9, 0, 12.8, 5.4, 11.1);

    function buildArm(side, name) {
      var shoulder = joint(name + '-shoulder', spine, side * 14, 32, 0);
      mesh(name + '-shoulder-cap', reusable.sphere, charcoal, shoulder, 0, 0, 0, 6.2, 6.2, 5.9);
      limb(name + '-upper-arm', shoulder, 21, 6.1, charcoal);
      var elbow = joint(name + '-elbow', shoulder, 0, -21, 0);
      mesh(name + '-elbow-cap', reusable.sphere, offWhite, elbow, 0, 0, 0, 5.4, 5.4, 5.1);
      limb(name + '-forearm', elbow, 19, 5.6, offWhite);
      var wrist = joint(name + '-wrist', elbow, 0, -19, 0);
      mesh(name + '-hand', reusable.sphere, offWhite, wrist, 0, -2.5, 0, 5.9, 6.2, 5.1);
      return { shoulder: shoulder, elbow: elbow, wrist: wrist };
    }

    function buildLeg(side, name) {
      var hip = joint(name + '-hip', pelvis, side * 7.2, -3, 0);
      mesh(name + '-hip-cap', reusable.sphere, charcoal, hip, 0, 0, 0, 7, 7, 6.4);
      limb(name + '-thigh', hip, 26, 7.4, charcoal);
      var knee = joint(name + '-knee', hip, 0, -26, 0);
      mesh(name + '-knee-cap', reusable.sphere, offWhite, knee, 0, 0, 0, 6.2, 5.9, 5.8);
      limb(name + '-shin', knee, 24, 6.5, offWhite);
      var ankle = joint(name + '-ankle', knee, 0, -24, 0);
      mesh(name + '-shoe', reusable.box, charcoal, ankle, side * 1.1, -3, 4, 8, 5.2, 12.4);
      return { hip: hip, knee: knee, ankle: ankle };
    }

    var throwingArm = buildArm(-1, 'throwing');
    var bucketArm = buildArm(1, 'bucket');
    var leftLeg = buildLeg(-1, 'left');
    var rightLeg = buildLeg(1, 'right');
    var throwingHand = throwingArm.wrist;

    var bucketPose = joint('bucket-pose', bucketArm.wrist, 1, -4, 0);
    var bucketSway = joint('bucket-sway', bucketPose);
    var bucket = joint('bucket', bucketSway, 3, -14, 0);
    mesh('bucket-body', new THREE.CylinderGeometry(8.8, 7.2, 18, 12, 1, false), offWhite, bucket, 0, 0, 0);
    mesh('bucket-interior', new THREE.CylinderGeometry(8, 8, 1, 16), bucketInteriorMaterial, bucket, 0, 8.55, 0);
    var paintSurface = mesh('paint-surface', new THREE.CylinderGeometry(7.2, 7.2, 0.75, 20), paintMaterial, bucket, 0, 9.08, 0);
    paintSurface.castShadow = false;
    mesh('bucket-band', new THREE.CylinderGeometry(9.1, 9.1, 2.5, 12), charcoal, bucket, 0, 7.8, 0);
    var bucketRim = joint('bucket-rim', bucket, 0, 9, 0);
    var bucketLip = joint('bucketLip', bucketRim);
    mesh('bucket-lip-form', new THREE.TorusGeometry(9.1, 1.1, 5, 12), charcoal, bucketLip, 0, 0, 0, 1, 1, 0.72);
    var bucketSpoutForm = mesh(
      'bucket-spout-form',
      new THREE.CylinderGeometry(0.6, 3, 5.2, 3, 1, false),
      charcoal,
      bucketLip,
      9.6, 0.55, 0,
      1, 1, 0.76
    );
    bucketSpoutForm.rotation.z = -PI / 2;
    var paintSpout = joint('paint-spout', bucketLip, 12.2, 0.55, 0);
    var handle = mesh('bucket-handle', new THREE.TorusGeometry(9.6, 0.9, 5, 16), charcoal, bucket, 0, 5, 0);
    handle.scale.y = 1.22;
    handle.rotation.x = PI / 2;

    scene.add(root);

    var poseNodes = [
      pelvis, spine, neck, head,
      throwingArm.shoulder, throwingArm.elbow, throwingArm.wrist,
      bucketArm.shoulder, bucketArm.elbow, bucketArm.wrist,
      leftLeg.hip, leftLeg.knee, leftLeg.ankle,
      rightLeg.hip, rightLeg.knee, rightLeg.ankle,
      bucketPose
    ];
    var basePose = poseNodes.map(function (node) {
      return {
        position: node.position.clone(),
        rotation: node.rotation.clone(),
        scale: node.scale.clone()
      };
    });

    function resetPose() {
      for (var index = 0; index < poseNodes.length; index += 1) {
        var node = poseNodes[index];
        var base = basePose[index];
        node.position.copy(base.position);
        node.rotation.copy(base.rotation);
        node.scale.copy(base.scale);
      }
    }

    function clamp01(value) {
      value = Number(value);
      if (!Number.isFinite(value)) return 0;
      return Math.max(0, Math.min(1, value));
    }

    function smooth(value) {
      value = clamp01(value);
      return value * value * (3 - 2 * value);
    }

    function ankleInRoot(leg) {
      var pelvisAngle = pelvis.rotation.z;
      var hipAngle = pelvisAngle + leg.hip.rotation.z;
      var kneeAngle = hipAngle + leg.knee.rotation.z;
      var pelvisCos = Math.cos(pelvisAngle);
      var pelvisSin = Math.sin(pelvisAngle);
      var hipCos = Math.cos(hipAngle);
      var hipSin = Math.sin(hipAngle);
      var kneeCos = Math.cos(kneeAngle);
      var kneeSin = Math.sin(kneeAngle);
      return {
        x: pelvis.position.x
          + leg.hip.position.x * pelvisCos - leg.hip.position.y * pelvisSin
          + leg.knee.position.x * hipCos - leg.knee.position.y * hipSin
          + leg.ankle.position.x * kneeCos - leg.ankle.position.y * kneeSin,
        y: pelvis.position.y
          + leg.hip.position.x * pelvisSin + leg.hip.position.y * pelvisCos
          + leg.knee.position.x * hipSin + leg.knee.position.y * hipCos
          + leg.ankle.position.x * kneeSin + leg.ankle.position.y * kneeCos
      };
    }

    var plantedAnkles = {
      left: ankleInRoot(leftLeg),
      right: ankleInRoot(rightLeg)
    };

    function walkAnkleCorrection(leg, target) {
      var ankle = ankleInRoot(leg);
      return { x: target.x - ankle.x, y: target.y - ankle.y };
    }

    function flattenFoot(leg) {
      leg.ankle.rotation.z = -(pelvis.rotation.z + leg.hip.rotation.z + leg.knee.rotation.z);
    }

    function applyCarryPose() {
      throwingArm.shoulder.rotation.z = -0.08;
      throwingArm.elbow.rotation.z = -0.28;
      bucketArm.shoulder.rotation.z = 0.18;
      bucketArm.elbow.rotation.z = 0.34;
      bucketPose.rotation.z = -0.08;
    }

    function poseWalk(progress, phase) {
      applyCarryPose();
      var cycle = phase + progress * TAU * 1.25;
      var enterEnvelope = smooth(clamp01(progress / 0.1));
      var exitEnvelope = smooth(clamp01((1 - progress) / 0.12));
      var motionEnvelope = enterEnvelope * exitEnvelope;
      var stride = Math.sin(cycle) * motionEnvelope;
      var liftLeft = Math.max(0, Math.sin(cycle)) * motionEnvelope;
      var liftRight = Math.max(0, -Math.sin(cycle)) * motionEnvelope;
      pelvis.position.y += Math.abs(Math.sin(cycle * 2)) * 0.62 * motionEnvelope;
      pelvis.rotation.y = -stride * 0.032;
      spine.rotation.y = stride * 0.04;
      spine.rotation.z = -stride * 0.014;
      head.rotation.z = -stride * 0.03;
      leftLeg.hip.rotation.z = stride * 0.24;
      rightLeg.hip.rotation.z = -stride * 0.24;
      leftLeg.knee.rotation.z = -liftLeft * 0.36;
      rightLeg.knee.rotation.z = -liftRight * 0.36;
      throwingArm.shoulder.rotation.z += -stride * 0.11;
      bucketArm.shoulder.rotation.z += stride * 0.07;
      throwingArm.elbow.rotation.z += -liftRight * 0.08;
      bucketArm.elbow.rotation.z += liftLeft * 0.04;
      bucketPose.rotation.z += -Math.sin(cycle - 1.25) * 0.075 * motionEnvelope;

      var leftCorrection = walkAnkleCorrection(leftLeg, plantedAnkles.left);
      var rightCorrection = walkAnkleCorrection(rightLeg, plantedAnkles.right);
      var rightSupport = smooth(clamp01((stride + 0.2) / 0.4));
      pelvis.position.x += leftCorrection.x * (1 - rightSupport) + rightCorrection.x * rightSupport;
      pelvis.position.y += leftCorrection.y * (1 - rightSupport) + rightCorrection.y * rightSupport;
      flattenFoot(leftLeg);
      flattenFoot(rightLeg);
    }

    function poseDeployLadder(progress, phase) {
      applyCarryPose();
      var t = smooth(progress);
      var anticipation = Math.sin(progress * PI);
      contactShadow.visible = false;
      pelvis.position.y -= anticipation * 1.55;
      spine.rotation.z = -0.04 * t + anticipation * 0.025;
      head.rotation.z = 0.025 * t - anticipation * 0.018;
      throwingArm.shoulder.rotation.z = -0.08 + 1.08 * t;
      throwingArm.elbow.rotation.z = -0.28 + 1.06 * t;
      bucketArm.shoulder.rotation.z = 0.18 + 0.04 * t;
      bucketArm.elbow.rotation.z = 0.34 + 0.08 * t;
      leftLeg.hip.rotation.z = -0.1 * t;
      rightLeg.hip.rotation.z = 0.12 * t;
      leftLeg.knee.rotation.z = -0.2 * t;
      rightLeg.knee.rotation.z = -0.2 * t;
    }

    function poseClimbLadder(progress, cycles) {
      cycles = Math.max(2, Math.round(Number(cycles) || 2));
      var cycle = progress * TAU * cycles;
      var reach = Math.sin(cycle);
      var travel = smooth(progress);
      var motion = smooth(clamp01(progress / 0.14)) * smooth(clamp01((1 - progress) / 0.14));
      contactShadow.visible = false;
      pelvis.position.y += Math.abs(Math.cos(cycle)) * 0.42 * motion;
      pelvis.rotation.y = reach * 0.018 * motion;
      spine.rotation.z = -0.04 * (1 - travel) - reach * 0.022 * motion;
      head.rotation.z = 0.025 * (1 - travel) - reach * 0.04 * motion;
      throwingArm.shoulder.rotation.z = 1 + 1.45 * travel + reach * 0.07 * motion;
      throwingArm.elbow.rotation.z = 0.78 + 0.12 * travel - reach * 0.08 * motion;
      bucketArm.shoulder.rotation.z = 0.22 + 0.02 * travel + reach * 0.025 * motion;
      bucketArm.elbow.rotation.z = 0.42 - 0.02 * travel - reach * 0.04 * motion;
      leftLeg.hip.rotation.z = -0.1 + 0.18 * travel + reach * 0.16 * motion;
      rightLeg.hip.rotation.z = 0.12 - 0.2 * travel - reach * 0.16 * motion;
      leftLeg.knee.rotation.z = -0.2 - 0.06 * travel - (0.08 + Math.max(0, -reach) * 0.15) * motion;
      rightLeg.knee.rotation.z = -0.2 - 0.06 * travel - (0.08 + Math.max(0, reach) * 0.15) * motion;
      bucketPose.rotation.z = -0.08 - reach * 0.025 * motion;
    }

    function poseRetrieveLadder(progress) {
      var t = smooth(progress);
      contactShadow.visible = false;
      pelvis.position.y -= Math.sin(t * PI) * 1.45;
      spine.rotation.z = Math.sin(t * PI) * 0.07;
      head.rotation.z = -Math.sin(t * PI) * 0.035;
      throwingArm.shoulder.rotation.z = 2.45 + (-0.08 - 2.45) * t;
      throwingArm.elbow.rotation.z = 0.9 + (-0.28 - 0.9) * t;
      bucketArm.shoulder.rotation.z = 0.24 + (0.18 - 0.24) * t;
      bucketArm.elbow.rotation.z = 0.4 + (0.34 - 0.4) * t;
      leftLeg.hip.rotation.z = 0.08 * (1 - t);
      rightLeg.hip.rotation.z = -0.08 * (1 - t);
      leftLeg.knee.rotation.z = -0.26 * (1 - t);
      rightLeg.knee.rotation.z = -0.26 * (1 - t);
      bucketPose.rotation.z = -0.08;
    }

    function posePaintSwing(progress, phase) {
      applyCarryPose();
      var gesture = Math.sin(smooth(progress) * PI);
      var depth = Math.sin(progress * PI * 2);
      pelvis.rotation.y = -gesture * 0.1;
      spine.rotation.z = -gesture * 0.14;
      head.rotation.z = gesture * 0.055 - depth * 0.012;
      bucketArm.shoulder.rotation.z += gesture * 0.92;
      bucketArm.shoulder.rotation.x = depth * 0.2;
      bucketArm.elbow.rotation.z += gesture * 0.42;
      bucketArm.wrist.rotation.z = -gesture * 0.34;
      bucketPose.rotation.z += -gesture * 0.72;
      throwingArm.shoulder.rotation.z += -gesture * 0.28;
      throwingArm.elbow.rotation.z += gesture * 0.12;
      leftLeg.hip.rotation.z = -gesture * 0.1;
      rightLeg.hip.rotation.z = gesture * 0.1;
      leftLeg.knee.rotation.z = -gesture * 0.08;
    }

    function poseRest(progress, phase) {
      applyCarryPose();
      var settle = smooth(progress);
      var idle = Math.sin(phase + progress * TAU) * 0.025;
      pelvis.position.y -= 1.2 * settle;
      pelvis.rotation.z = -0.025 * settle;
      spine.rotation.z = 0.045 * settle + idle;
      head.rotation.z = -idle * 0.7;
      leftLeg.knee.rotation.z = -0.06;
    }

    function poseVanish(progress) {
      applyCarryPose();
      var t = smooth(progress);
      var farewell = Math.sin(t * PI);
      pelvis.position.y -= 1.2 * t;
      pelvis.rotation.z = -0.025 * t;
      spine.rotation.z = 0.045 * t;
      head.rotation.z = -farewell * 0.04;
      throwingArm.shoulder.rotation.z += farewell * 0.32;
      throwingArm.elbow.rotation.z += farewell * 0.18;
    }

    function setPose(name, progress, phase) {
      if (disposed) return;
      resetPose();
      contactShadow.visible = true;
      progress = clamp01(progress);
      phase = Number.isFinite(Number(phase)) ? Number(phase) : 0;
      currentPose = name;
      switch (name) {
        case 'walk': poseWalk(progress, phase); break;
        case 'deploy-ladder': poseDeployLadder(progress, phase); break;
        case 'climb-ladder': poseClimbLadder(progress, phase); break;
        case 'retrieve-ladder': poseRetrieveLadder(progress); break;
        case 'paint-swing': posePaintSwing(progress, phase); break;
        case 'vanish': poseVanish(progress); break;
        case 'rest': poseRest(progress, phase); break;
        default: poseRest(progress, phase);
      }
    }

    function setScreenPose(screenPose) {
      if (disposed) return;
      screenPose = screenPose || {};
      var x = Number(screenPose.x);
      var y = Number(screenPose.y);
      var depth = Number(screenPose.depth);
      var scale = Math.abs(Number(screenPose.scale));
      var facing = Number(screenPose.facing);
      if (!Number.isFinite(x)) x = 0;
      if (!Number.isFinite(y)) y = 0;
      if (!Number.isFinite(depth)) depth = 0;
      if (!Number.isFinite(scale) || scale === 0) scale = 1;
      if (!Number.isFinite(facing) || facing === 0) facing = 1;
      root.position.set(x, y, depth);
      root.scale.set(scale * (facing < 0 ? -1 : 1), scale, scale);
    }

    function update(delta) {
      if (disposed) return;
      delta = Number(delta);
      secondaryTime += Number.isFinite(delta) ? Math.max(0, Math.min(0.1, delta)) : 0;
      var carryMotion = currentPose === 'walk' ? 1 : (currentPose === 'rest' ? 0.35 : 0);
      bucketSway.rotation.z = Math.sin(secondaryTime * 2.15) * 0.018 * carryMotion;
      bucketSway.rotation.x = Math.cos(secondaryTime * 1.55) * 0.008 * carryMotion;
      var breath = 1 + Math.sin(secondaryTime * 1.8) * 0.012;
      breathingJoint.scale.set(1 / breath, breath, 1);
    }

    function setPaintHue(hue) {
      if (disposed) return;
      hue = Number(hue);
      if (!Number.isFinite(hue)) return;
      var resolvePigment = PaintJourney.pigmentRgb;
      if (typeof resolvePigment !== 'function') return;
      var pigment = resolvePigment(hue);
      var red = pigment.r / 255;
      var green = pigment.g / 255;
      var blue = pigment.b / 255;
      if (paintMaterial.color && typeof paintMaterial.color.setRGB === 'function') {
        paintMaterial.color.setRGB(red, green, blue, THREE.SRGBColorSpace);
      }
      if (paintMaterial.emissive && typeof paintMaterial.emissive.setRGB === 'function') {
        paintMaterial.emissive.setRGB(red * 0.16, green * 0.16, blue * 0.16);
      }
    }

    var fadeMaterials = [
      charcoal, offWhite, shadowMaterial, bucketInteriorMaterial, paintMaterial, faceMaterial
    ];
    var baseMaterialOpacity = fadeMaterials.map(function (material) {
      return Number.isFinite(Number(material.opacity)) ? Number(material.opacity) : 1;
    });

    function setOpacity(opacity) {
      if (disposed) return;
      opacity = clamp01(opacity);
      root.visible = opacity > 0.001;
      for (var index = 0; index < fadeMaterials.length; index += 1) {
        var material = fadeMaterials[index];
        material.transparent = opacity < 0.999 || baseMaterialOpacity[index] < 0.999;
        material.opacity = baseMaterialOpacity[index] * opacity;
        if ('depthWrite' in material) material.depthWrite = opacity >= 0.999 && baseMaterialOpacity[index] >= 0.999;
      }
    }

    function disposeMaterial(material, disposedMaterials, disposedTextures) {
      if (!material || disposedMaterials.indexOf(material) !== -1) return;
      disposedMaterials.push(material);
      Object.keys(material).forEach(function (key) {
        var value = material[key];
        if (value && value.isTexture && disposedTextures.indexOf(value) === -1) {
          disposedTextures.push(value);
          if (typeof value.dispose === 'function') value.dispose();
        }
      });
      if (typeof material.dispose === 'function') material.dispose();
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      if (root.parent) root.parent.remove(root);
      var disposedGeometries = [];
      var disposedMaterials = [];
      var disposedTextures = [];
      root.traverse(function (object) {
        if (object.geometry && disposedGeometries.indexOf(object.geometry) === -1) {
          disposedGeometries.push(object.geometry);
          if (typeof object.geometry.dispose === 'function') object.geometry.dispose();
        }
        if (Array.isArray(object.material)) {
          object.material.forEach(function (material) {
            disposeMaterial(material, disposedMaterials, disposedTextures);
          });
        } else {
          disposeMaterial(object.material, disposedMaterials, disposedTextures);
        }
      });
    }

    setPose('rest', 0, 0);
    update(0);

    return {
      root: root,
      bucketLip: bucketLip,
      paintSpout: paintSpout,
      throwingHand: throwingHand,
      setPose: setPose,
      setScreenPose: setScreenPose,
      setPaintHue: setPaintHue,
      setOpacity: setOpacity,
      update: update,
      dispose: dispose
    };
  };
}(window, typeof document === 'undefined' ? null : document));
