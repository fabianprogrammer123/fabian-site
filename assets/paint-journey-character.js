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
      context.fillRect(26, 42, 12, 2);
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

    var pelvis = joint('pelvis', root, 0, 65, 0);
    mesh('pelvis-shell', reusable.sphere, charcoal, pelvis, 0, 0, 0, 13, 9, 8);

    var spine = joint('spine', pelvis, 0, 5, 0);
    var breathingJoint = joint('breathing-joint', spine);
    mesh('torso', reusable.capsule, charcoal, breathingJoint, 0, 21, 0, 1.7, 1.45, 1.15);
    var neck = joint('neck', spine, 0, 46, 0);
    mesh('neck-form', reusable.cylinder, offWhite, neck, 0, 4, 0, 5.2, 8, 5.2);
    var head = joint('head', neck, 0, 13, 0);
    mesh('dotted-face', reusable.sphere, faceMaterial, head, 0, 0, 0, 12, 13, 10.5);
    mesh('cap', reusable.sphere, charcoal, head, 0, 8, 0, 12.4, 5.6, 10.8);

    function buildArm(side, name) {
      var shoulder = joint(name + '-shoulder', spine, side * 18, 38, 0);
      mesh(name + '-shoulder-cap', reusable.sphere, charcoal, shoulder, 0, 0, 0, 6.8, 6.8, 6.2);
      limb(name + '-upper-arm', shoulder, 27, 5.2, charcoal);
      var elbow = joint(name + '-elbow', shoulder, 0, -27, 0);
      mesh(name + '-elbow-cap', reusable.sphere, offWhite, elbow, 0, 0, 0, 5.5, 5.5, 5.2);
      limb(name + '-forearm', elbow, 25, 4.5, offWhite);
      var wrist = joint(name + '-wrist', elbow, 0, -25, 0);
      mesh(name + '-hand', reusable.sphere, offWhite, wrist, 0, -3, 0, 6, 7, 4.8);
      return { shoulder: shoulder, elbow: elbow, wrist: wrist };
    }

    function buildLeg(side, name) {
      var hip = joint(name + '-hip', pelvis, side * 8.5, -3, 0);
      mesh(name + '-hip-cap', reusable.sphere, charcoal, hip, 0, 0, 0, 6.8, 6.8, 6.2);
      limb(name + '-thigh', hip, 32, 6.2, charcoal);
      var knee = joint(name + '-knee', hip, 0, -32, 0);
      mesh(name + '-knee-cap', reusable.sphere, offWhite, knee, 0, 0, 0, 6.2, 5.8, 5.8);
      limb(name + '-shin', knee, 29, 5.3, offWhite);
      var ankle = joint(name + '-ankle', knee, 0, -29, 0);
      mesh(name + '-shoe', reusable.box, charcoal, ankle, side * 1.5, -3.5, 4.5, 8.5, 6, 15);
      return { hip: hip, knee: knee, ankle: ankle };
    }

    var throwingArm = buildArm(-1, 'throwing');
    var bucketArm = buildArm(1, 'bucket');
    var leftLeg = buildLeg(-1, 'left');
    var rightLeg = buildLeg(1, 'right');
    var throwingHand = throwingArm.wrist;

    var bucketPose = joint('bucket-pose', bucketArm.wrist, 1, -6, 0);
    var bucketSway = joint('bucket-sway', bucketPose);
    var bucket = joint('bucket', bucketSway, 4, -19, 0);
    mesh('bucket-body', new THREE.CylinderGeometry(10, 8, 22, 12, 1, false), offWhite, bucket, 0, 0, 0);
    mesh('bucket-band', new THREE.CylinderGeometry(10.4, 10.4, 3, 12), charcoal, bucket, 0, 9.5, 0);
    var bucketRim = joint('bucket-rim', bucket, 0, 11, 0);
    var bucketLip = joint('bucketLip', bucketRim);
    mesh('bucket-lip-form', new THREE.TorusGeometry(10.3, 1.35, 5, 12), charcoal, bucketLip, 0, 0, 0, 1, 1, 0.72);
    var handle = mesh('bucket-handle', new THREE.TorusGeometry(11, 1, 5, 16), charcoal, bucket, 0, 6, 0);
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

    function poseWalk(progress, phase) {
      var cycle = phase + progress * TAU;
      var stride = Math.sin(cycle);
      var liftLeft = Math.max(0, Math.sin(cycle));
      var liftRight = Math.max(0, -Math.sin(cycle));
      pelvis.position.y += Math.abs(Math.sin(cycle * 2)) * 2.2;
      pelvis.rotation.y = -stride * 0.1;
      spine.rotation.y = stride * 0.12;
      spine.rotation.z = -stride * 0.035;
      leftLeg.hip.rotation.z = stride * 0.52;
      rightLeg.hip.rotation.z = -stride * 0.52;
      leftLeg.knee.rotation.z = -liftLeft * 0.72;
      rightLeg.knee.rotation.z = -liftRight * 0.72;
      leftLeg.ankle.rotation.z = -stride * 0.12;
      rightLeg.ankle.rotation.z = stride * 0.12;
      throwingArm.shoulder.rotation.z = -stride * 0.42;
      bucketArm.shoulder.rotation.z = stride * 0.25;
      throwingArm.elbow.rotation.z = -0.15 - liftRight * 0.22;
      bucketArm.elbow.rotation.z = 0.18 + liftLeft * 0.12;
      bucketPose.rotation.z = -stride * 0.18;
    }

    function poseCoil(progress, phase) {
      var t = smooth(progress);
      var loop = Math.sin(phase + progress * PI * 3);
      pelvis.rotation.y = -0.18 * t;
      spine.rotation.z = 0.13 * t;
      throwingArm.shoulder.rotation.z = -0.85 + loop * 0.2;
      throwingArm.shoulder.rotation.x = 0.45 * t;
      throwingArm.elbow.rotation.z = -1.45 + loop * 0.3;
      throwingArm.wrist.rotation.z = loop * 0.65;
      bucketArm.shoulder.rotation.z = 0.38;
      bucketArm.elbow.rotation.z = 0.72;
      bucketPose.rotation.z = -0.2;
    }

    function poseThrow(progress) {
      var anticipation = smooth(Math.min(1, progress / 0.38));
      var release = smooth(Math.max(0, (progress - 0.38) / 0.62));
      spine.rotation.z = 0.2 * anticipation - 0.3 * release;
      spine.rotation.y = -0.22 * anticipation + 0.5 * release;
      throwingArm.shoulder.rotation.z = -1.1 * anticipation + 2.15 * release;
      throwingArm.shoulder.rotation.x = 0.7 * anticipation - 0.95 * release;
      throwingArm.elbow.rotation.z = -1.2 * anticipation + 0.75 * release;
      throwingArm.wrist.rotation.z = -0.4 * anticipation + 0.85 * release;
      bucketArm.shoulder.rotation.z = 0.38;
      bucketArm.elbow.rotation.z = 0.55;
      leftLeg.hip.rotation.z = -0.2;
      rightLeg.hip.rotation.z = 0.24;
    }

    function poseBrace(progress) {
      var t = smooth(progress);
      pelvis.position.y -= 8 * t;
      pelvis.rotation.z = -0.11 * t;
      spine.rotation.z = 0.28 * t;
      leftLeg.hip.rotation.z = -0.48 * t;
      rightLeg.hip.rotation.z = 0.62 * t;
      leftLeg.knee.rotation.z = -0.45 * t;
      rightLeg.knee.rotation.z = -0.72 * t;
      throwingArm.shoulder.rotation.z = 1.45 * t;
      throwingArm.elbow.rotation.z = 0.5 * t;
      bucketArm.shoulder.rotation.z = -0.55 * t;
      bucketArm.elbow.rotation.z = -0.78 * t;
    }

    function poseClimb(progress, phase) {
      var cycle = phase + progress * TAU * 2;
      var reach = Math.sin(cycle);
      pelvis.position.y += Math.abs(Math.cos(cycle)) * 3;
      pelvis.rotation.y = reach * 0.1;
      spine.rotation.z = -reach * 0.08;
      throwingArm.shoulder.rotation.z = 2.75 + reach * 0.34;
      bucketArm.shoulder.rotation.z = -2.75 + reach * 0.34;
      throwingArm.elbow.rotation.z = 0.7 - reach * 0.45;
      bucketArm.elbow.rotation.z = -0.7 - reach * 0.45;
      leftLeg.hip.rotation.z = 0.35 - reach * 0.48;
      rightLeg.hip.rotation.z = -0.35 - reach * 0.48;
      leftLeg.knee.rotation.z = -0.62 + Math.max(0, reach) * 0.42;
      rightLeg.knee.rotation.z = -0.62 + Math.max(0, -reach) * 0.42;
      bucketPose.rotation.z = -reach * 0.25;
    }

    function posePullBucket(progress) {
      var t = smooth(progress);
      pelvis.position.y -= Math.sin(t * PI) * 5;
      spine.rotation.z = 0.34 * Math.sin(t * PI);
      bucketArm.shoulder.rotation.z = -1.95 + 2.45 * t;
      bucketArm.elbow.rotation.z = -0.9 + 1.4 * t;
      bucketArm.wrist.rotation.z = -0.35 * (1 - t);
      throwingArm.shoulder.rotation.z = 1.8 - 0.8 * t;
      throwingArm.elbow.rotation.z = 0.65;
      bucketPose.position.y += 10 * t;
      bucketPose.rotation.z = -0.38 + 0.28 * t;
    }

    function posePaintSwing(progress, phase) {
      var arc = Math.sin(phase + progress * PI);
      var follow = Math.cos(phase + progress * PI);
      pelvis.rotation.y = -arc * 0.18;
      spine.rotation.z = -arc * 0.22;
      bucketArm.shoulder.rotation.z = -0.35 + arc * 1.65;
      bucketArm.shoulder.rotation.x = follow * 0.38;
      bucketArm.elbow.rotation.z = 0.42 + arc * 0.6;
      bucketArm.wrist.rotation.z = -arc * 0.48;
      bucketPose.rotation.z = -arc * 0.7;
      throwingArm.shoulder.rotation.z = -arc * 0.6;
      leftLeg.hip.rotation.z = -arc * 0.16;
      rightLeg.hip.rotation.z = arc * 0.16;
    }

    function poseRest(progress, phase) {
      var settle = smooth(progress);
      var idle = Math.sin(phase + progress * TAU) * 0.025;
      pelvis.position.y -= 2 * settle;
      pelvis.rotation.z = -0.045 * settle;
      spine.rotation.z = 0.08 * settle + idle;
      throwingArm.shoulder.rotation.z = -0.14;
      throwingArm.elbow.rotation.z = -0.18;
      bucketArm.shoulder.rotation.z = 0.22;
      bucketArm.elbow.rotation.z = 0.28;
      bucketPose.rotation.z = -0.08;
      leftLeg.knee.rotation.z = -0.08;
    }

    function setPose(name, progress, phase) {
      if (disposed) return;
      resetPose();
      progress = clamp01(progress);
      phase = Number.isFinite(Number(phase)) ? Number(phase) : 0;
      switch (name) {
        case 'walk': poseWalk(progress, phase); break;
        case 'coil-rope': poseCoil(progress, phase); break;
        case 'throw-rope': poseThrow(progress); break;
        case 'brace': poseBrace(progress); break;
        case 'climb': poseClimb(progress, phase); break;
        case 'pull-bucket': posePullBucket(progress); break;
        case 'paint-swing': posePaintSwing(progress, phase); break;
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
      bucketSway.rotation.z = Math.sin(secondaryTime * 2.4) * 0.055;
      bucketSway.rotation.x = Math.cos(secondaryTime * 1.7) * 0.025;
      var breath = 1 + Math.sin(secondaryTime * 1.8) * 0.012;
      breathingJoint.scale.set(1 / breath, breath, 1);
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
      throwingHand: throwingHand,
      setPose: setPose,
      setScreenPose: setScreenPose,
      update: update,
      dispose: dispose
    };
  };
}(window, typeof document === 'undefined' ? null : document));
