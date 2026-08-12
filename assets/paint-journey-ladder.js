(function paintJourneyLadder(window) {
  'use strict';

  var PaintJourney = window.PaintJourney = window.PaintJourney || {};

  PaintJourney.createLadder = function createLadder(options) {
    options = options || {};
    var THREE = options.THREE;
    var scene = options.scene;
    if (!THREE || !scene || typeof scene.add !== 'function') {
      throw new Error('PaintJourney.createLadder requires THREE and a scene');
    }

    var maxRungs = Math.max(4, Math.floor(Number(options.maxRungs) || 32));
    var ladderWidth = Math.max(14, Number(options.width) || 34);
    var rungSpacing = Math.max(10, Number(options.rungSpacing) || 24);
    var railRadius = Math.max(1.2, Number(options.railRadius) || 2.35);
    var rungRadius = Math.max(0.9, Number(options.rungRadius) || 1.65);

    var root = new THREE.Group();
    root.name = 'paint-journey-ladder';
    root.visible = false;
    scene.add(root);

    var railGeometry = new THREE.CylinderGeometry(railRadius, railRadius * 0.94, 1, 8, 1, false);
    var rungGeometry = new THREE.CylinderGeometry(rungRadius, rungRadius, 1, 8, 1, false);
    var railMaterial = new THREE.MeshStandardMaterial({
      color: 0x26292b,
      roughness: 0.76,
      metalness: 0.18,
      flatShading: true
    });
    var rungMaterial = new THREE.MeshStandardMaterial({
      color: 0xd9d5ca,
      roughness: 0.68,
      metalness: 0.12,
      flatShading: true
    });

    function makeMesh(name, geometry, material, renderOrder) {
      var mesh = new THREE.Mesh(geometry, material);
      mesh.name = name;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = renderOrder;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      return mesh;
    }

    var rails = [
      makeMesh('ladder-rail-body-left', railGeometry, railMaterial, 3),
      makeMesh('ladder-rail-body-right', railGeometry, railMaterial, 3)
    ];
    var rungs = [];
    for (var rungIndex = 0; rungIndex < maxRungs; rungIndex += 1) {
      rungs.push(makeMesh('ladder-rung-body-' + rungIndex, rungGeometry, rungMaterial, 4));
    }

    var bottom = new THREE.Vector3();
    var top = new THREE.Vector3();
    var direction = new THREE.Vector3();
    var unitDirection = new THREE.Vector3(0, 1, 0);
    var sideDirection = new THREE.Vector3(1, 0, 0);
    var cylinderAxis = new THREE.Vector3(0, 1, 0);
    var deployedBottom = new THREE.Vector3();
    var deployedTop = new THREE.Vector3();
    var scaledDirection = new THREE.Vector3();
    var disposed = false;

    function clamp01(value) {
      value = Number(value);
      if (!Number.isFinite(value)) return 1;
      return Math.max(0, Math.min(1, value));
    }

    function copyPoint(target, source) {
      target.set(
        Number(source && source.x) || 0,
        Number(source && source.y) || 0,
        Number(source && source.z) || 0
      );
    }

    function placeRail(rail, side, length) {
      var offset = side * ladderWidth * 0.5;
      rail.position.set(
        (deployedBottom.x + deployedTop.x) * 0.5 + sideDirection.x * offset,
        (deployedBottom.y + deployedTop.y) * 0.5 + sideDirection.y * offset,
        (deployedBottom.z + deployedTop.z) * 0.5 + sideDirection.z * offset
      );
      rail.scale.set(1, length, 1);
      rail.quaternion.setFromUnitVectors(cylinderAxis, unitDirection);
      rail.visible = length > 0.001;
    }

    function placeRungs(fullLength, progress, anchor) {
      var rungCount = Math.max(2, Math.min(maxRungs, Math.floor(fullLength / rungSpacing)));
      for (var index = 0; index < maxRungs; index += 1) {
        var rung = rungs[index];
        if (index >= rungCount || progress <= 0) {
          rung.visible = false;
          continue;
        }

        var spanProgress = (index + 1) / (rungCount + 1);
        var reached = anchor === 'top'
          ? spanProgress >= 1 - progress
          : spanProgress <= progress;
        if (!reached) {
          rung.visible = false;
          continue;
        }

        rung.position.set(
          bottom.x + direction.x * spanProgress,
          bottom.y + direction.y * spanProgress,
          bottom.z + direction.z * spanProgress
        );
        rung.scale.set(1, ladderWidth + railRadius * 2, 1);
        rung.quaternion.setFromUnitVectors(cylinderAxis, sideDirection);
        rung.visible = true;
      }
    }

    function setSpan(nextBottom, nextTop, spanOptions) {
      if (disposed) return;
      spanOptions = spanOptions || {};
      copyPoint(bottom, nextBottom);
      copyPoint(top, nextTop);
      direction.subVectors(top, bottom);
      var fullLength = direction.length();
      if (fullLength < 0.001) {
        root.visible = false;
        return;
      }

      unitDirection.copy(direction).multiplyScalar(1 / fullLength);
      var planarLength = Math.sqrt(
        unitDirection.x * unitDirection.x + unitDirection.y * unitDirection.y
      );
      if (planarLength > 0.001) {
        sideDirection.set(
          -unitDirection.y / planarLength,
          unitDirection.x / planarLength,
          0
        );
      } else {
        sideDirection.set(1, 0, 0);
      }

      var progress = clamp01(spanOptions.progress);
      var anchor = spanOptions.anchor === 'top' ? 'top' : 'bottom';
      scaledDirection.copy(direction).multiplyScalar(progress);
      if (anchor === 'top') {
        deployedTop.copy(top);
        deployedBottom.subVectors(top, scaledDirection);
      } else {
        deployedBottom.copy(bottom);
        deployedTop.addVectors(bottom, scaledDirection);
      }

      var deployedLength = fullLength * progress;
      placeRail(rails[0], -1, deployedLength);
      placeRail(rails[1], 1, deployedLength);
      placeRungs(fullLength, progress, anchor);
      root.visible = progress > 0;
    }

    function hide() {
      if (disposed) return;
      root.visible = false;
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      root.visible = false;
      if (root.parent) root.parent.remove(root);
      railGeometry.dispose();
      rungGeometry.dispose();
      railMaterial.dispose();
      rungMaterial.dispose();
    }

    return {
      root: root,
      setSpan: setSpan,
      hide: hide,
      dispose: dispose
    };
  };
}(window));
