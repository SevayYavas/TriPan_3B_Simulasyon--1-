/* Sahneyi kur: ışıklar, ortam, tüm parçalar. */
window.TP = window.TP || {};
(function (TP) {
  const G = TP.G, M = TP.M;

  function makeEnvironment(renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(100, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0xf8f7f4, side: THREE.BackSide })
    );
    envScene.add(top);
    const box = new THREE.Mesh(new THREE.BoxGeometry(120, 60, 120), new THREE.MeshBasicMaterial({ color: 0xd8d5cd, side: THREE.BackSide }));
    box.position.y = -40;
    envScene.add(box);
    const light = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    light.position.set(0, 70, 0);
    light.rotation.x = Math.PI / 2;
    envScene.add(light);
    const rt = pmrem.fromScene(envScene, 0.04);
    pmrem.dispose();
    return rt.texture;
  }

  TP.buildWorld = function (renderer) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xefeee8);
    scene.fog = new THREE.Fog(0xefeee8, 780, 1700);
    scene.environment = makeEnvironment(renderer);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xcfcbc0, 0.45);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1.25);
    key.position.set(170, 300, -170);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -320; sc.right = 320; sc.top = 320; sc.bottom = -320; sc.near = 1; sc.far = 900;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.5;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.38);
    fill.position.set(-240, 140, 180);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xdfe8ff, 0.30);
    rim.position.set(-40, 90, 300);
    scene.add(rim);

    const bench = TP.buildBench(scene);

    const reader = TP.buildReader();
    scene.add(reader.group);

    const strip = TP.buildStrip();
    const cart = TP.buildCartridge(strip);
    cart.group.position.copy(TP.CART_HOVER);
    scene.add(cart.group);

    const beads = TP.buildBeads(110);
    beads.forEach(function (b) { cart.group.add(b); });

    const tube = TP.buildTube();
    tube.group.position.set(-80, 0, 42);
    scene.add(tube.group);

    const pipette = TP.buildPipette();
    scene.add(pipette.group);

    const drops = TP.buildDrops(scene);

    const mol = TP.buildMolecular();
    mol.group.position.set(2, 112, 14);
    scene.add(mol.group);

    const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 1, 4000);
    camera.position.set(148, 152, -196);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 34, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 45;
    controls.maxDistance = 720;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.screenSpacePanning = true;
    controls.update();

    return {
      scene: scene, camera: camera, controls: controls, bench: bench,
      reader: reader, cart: cart, strip: strip, tube: tube, pipette: pipette,
      drops: drops, beads: beads, mol: mol,
    };
  };
})(window.TP);
