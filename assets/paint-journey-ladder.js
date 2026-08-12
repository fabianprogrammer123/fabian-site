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

    var maxRungs = Math.max(128, Math.floor(Number(options.maxRungs) || 32));
    var ladderWidth = Math.max(14, Number(options.width) || 34);
    var rungSpacing = Math.max(10, Number(options.rungSpacing) || 24);
    var railRadius = Math.max(1.2, Number(options.railRadius) || 2.35);
    var rungRadius = Math.max(0.9, Number(options.rungRadius) || 1.65);
    var baseRailRadius = railRadius;
    var baseRungRadius = rungRadius;

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
    var rungs = new THREE.InstancedMesh(rungGeometry, rungMaterial, maxRungs);
    rungs.name = 'ladder-rungs';
    rungs.count = 0;
    rungs.visible = false;
    rungs.frustumCulled = false;
    rungs.renderOrder = 4;
    rungs.castShadow = true;
    rungs.receiveShadow = true;
    if (rungs.instanceMatrix && typeof rungs.instanceMatrix.setUsage === 'function' && THREE.DynamicDrawUsage) {
      rungs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    root.add(rungs);

    var bottom = new THREE.Vector3();
    var top = new THREE.Vector3();
    var direction = new THREE.Vector3();
    var unitDirection = new THREE.Vector3(0, 1, 0);
    var sideDirection = new THREE.Vector3(1, 0, 0);
    var cylinderAxis = new THREE.Vector3(0, 1, 0);
    var deployedBottom = new THREE.Vector3();
    var deployedTop = new THREE.Vector3();
    var scaledDirection = new THREE.Vector3();
    var rungTransform = new THREE.Object3D();
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
      var thickness = railRadius / baseRailRadius;
      rail.scale.set(thickness, length, thickness);
      rail.quaternion.setFromUnitVectors(cylinderAxis, unitDirection);
      rail.visible = length > 0.001;
    }

    function placeRungs(fullLength, progress, anchor) {
      var rungCount = Math.min(maxRungs, Math.max(2, Math.floor(fullLength / rungSpacing)));
      var visibleCount = 0;
      for (var index = 0; index < rungCount; index += 1) {
        var spanProgress = (index + 1) / (rungCount + 1);
        var reached = anchor === 'top'
          ? spanProgress >= 1 - progress
          : spanProgress <= progress;
        if (!reached || progress <= 0) continue;

        rungTransform.position.set(
          bottom.x + direction.x * spanProgress,
          bottom.y + direction.y * spanProgress,
          bottom.z + direction.z * spanProgress
        );
        var thickness = rungRadius / baseRungRadius;
        rungTransform.scale.set(thickness, ladderWidth + railRadius * 2, thickness);
        rungTransform.quaternion.setFromUnitVectors(cylinderAxis, sideDirection);
        rungTransform.updateMatrix();
        rungs.setMatrixAt(visibleCount, rungTransform.matrix);
        visibleCount += 1;
      }
      rungs.count = visibleCount;
      rungs.visible = visibleCount > 0;
      if (rungs.instanceMatrix) rungs.instanceMatrix.needsUpdate = true;
    }

    function setMetrics(metrics) {
      if (disposed) return;
      metrics = metrics || {};
      ladderWidth = Math.max(14, Number(metrics.width) || ladderWidth);
      rungSpacing = Math.max(10, Number(metrics.rungSpacing) || rungSpacing);
      railRadius = Math.max(1.2, Number(metrics.railRadius) || railRadius);
      rungRadius = Math.max(0.9, Number(metrics.rungRadius) || rungRadius);
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
      setMetrics: setMetrics,
      hide: hide,
      dispose: dispose,
      get visibleRungCount() { return rungs.count; }
    };
  };
}(window));
