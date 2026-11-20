/* Laboratuvar sahnesi: tezgâh, kan tüpü, pipet, damlalar, boncuklar, moleküler görünüm. */
window.TP = window.TP || {};
(function (TP) {
  const G = TP.G, M = TP.M;

  function buildBench(scene) {
    const grp = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshStandardMaterial({ color: 0xe2e0d8, roughness: 0.96, metalness: 0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    grp.add(floor);

    // hafif zemin vinyetı
    const vig = new THREE.Mesh(
      new THREE.PlaneGeometry(1500, 1500),
      new THREE.MeshBasicMaterial({
        map: G.canvasTex(512, 512, function (ctx, w, h) {
          const g = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w / 2);
          g.addColorStop(0, "rgba(255,255,255,0)");
          g.addColorStop(0.55, "rgba(226,223,214,0.25)");
          g.addColorStop(1, "rgba(208,204,194,0.55)");
          ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        }),
        transparent: true, depthWrite: false,
      })
    );
    vig.rotation.x = -Math.PI / 2;
    vig.position.y = 0.01;
    grp.add(vig);
    scene.add(grp);
    return grp;
  }

  function buildTube() {
    const g = new THREE.Group();
    const R = 6.2, H = 54;

    const glass = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.92, H, 40, 1, true), M.glass);
    glass.position.y = H / 2;
    glass.renderOrder = 3;
    g.add(glass);
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.92, R * 0.92, 0.6, 40), M.glass);
    bottom.position.y = 0.3;
    g.add(bottom);

    const blood = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.9, R * 0.86, 17, 36), M.blood);
    blood.position.y = 8.8;
    g.add(blood);
    const plasma = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.9, R * 0.9, 21, 36), M.liquidPlasma);
    plasma.position.y = 27.6;
    g.add(plasma);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.5, R + 0.5, 5, 36), new THREE.MeshStandardMaterial({ color: 0x2a78d6, roughness: 0.45 }));
    cap.position.y = H + 1.4;
    g.add(cap);
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(R - 1.2, R - 1.2, 0.8, 30), M.dark);
    capTop.position.y = H + 4.0;
    g.add(capTop);

    const rack = new THREE.Mesh(new THREE.CylinderGeometry(R + 3.5, R + 4.5, 2.4, 40), M.dark);
    rack.position.y = 1.2;
    rack.receiveShadow = true;
    g.add(rack);

    const lab = G.label("Kan örneği · plazma", { fs: 20, mm: 3.8, color: "#52514e" });
    lab.position.set(0, 68, 0);
    g.add(lab);

    return { group: g, plasmaY: 27.6 };
  }

  function buildPipette() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.0, 26, 24), new THREE.MeshStandardMaterial({ color: 0x3d4b5c, roughness: 0.4 }));
    body.position.y = 22;
    g.add(body);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 10, 24), M.dark);
    grip.position.y = 32;
    g.add(grip);
    const ejector = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 2, 24), new THREE.MeshStandardMaterial({ color: 0xeb6834, roughness: 0.45 }));
    ejector.position.y = 16;
    g.add(ejector);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.35, 11, 20), new THREE.MeshStandardMaterial({ color: 0xe9edf1, roughness: 0.35, transparent: true, opacity: 0.85 }));
    tip.position.y = 4.5;
    g.add(tip);
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 4, 16), M.liquidPlasma);
    liquid.position.y = 2.4;
    liquid.visible = false;
    g.add(liquid);
    g.visible = false;
    return { group: g, liquid: liquid };
  }

  function dropMaterial(kind) {
    const c = {
      plasma: 0xf0d27a, buffer: 0x9ec9e9, bead: 0xb98a55, wash: 0xbdd9ef, assay: 0xd9e8f2, blood: 0x9d2228,
    }[kind] || 0x9ec9e9;
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.12, transparent: true, opacity: 0.92 });
  }
  function buildDrops(scene) {
    const drops = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), dropMaterial("buffer"));
      m.visible = false;
      m.castShadow = false;
      scene.add(m);
      drops.push({ mesh: m, active: false, p0: new THREE.Vector3(), p1: new THREE.Vector3(), t0: 0, dur: 1, lift: 20, kind: "buffer" });
    }
    return drops;
  }

  /* Elektrot üzerindeki boncuklar (instanced) */
  function buildBeads(countPerWe) {
    const geo = new THREE.SphereGeometry(0.17, 8, 6);
    const meshes = [];
    const rnd = TP.Model.rngFactory(1234);
    WE_DATA().forEach(function (we, idx) {
      const im = new THREE.InstancedMesh(geo, M.bead, countPerWe);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const base = [];
      for (let i = 0; i < countPerWe; i++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 1.72;
        base.push({ x: we.x + Math.cos(a) * r, z: we.z + Math.sin(a) * r, d: rnd() * 0.35 + 0.65, j: rnd() * 6.28 });
      }
      im.userData.base = base;
      meshes.push(im);
    });
    return meshes;
  }
  function WE_DATA() {
    // kartuş koordinatında WE merkezleri (şerit 180° döndüğü için)
    return [{ x: 21.5, z: 77.5 }, { x: 21.5, z: 70.5 }, { x: 21.5, z: 63.5 }];
  }

  function buildMolecular() {
    const g = new THREE.Group();
    const C = TP.C;

    const back = new THREE.Mesh(
      new THREE.CircleGeometry(39, 64),
      new THREE.MeshBasicMaterial({
        map: G.canvasTex(512, 512, function (ctx, w, h) {
          const gr = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
          gr.addColorStop(0, "rgba(255,255,255,0.97)");
          gr.addColorStop(0.72, "rgba(252,252,251,0.9)");
          gr.addColorStop(1, "rgba(252,252,251,0)");
          ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
        }),
        transparent: true, depthWrite: false,
      })
    );
    back.renderOrder = -1;
    g.add(back);

    const title = G.label("Boncuk üzerinde sandviç yapı  ·  ölçek dışı", { fs: 19, mm: 4.0, color: "#52514e" });
    title.position.set(0, 26, 0);
    g.add(title);

    const lanes = [];
    const infos = [
      { name: "CA19-9", color: "#eb6834" },
      { name: "TIMP1", color: "#2a78d6" },
      { name: "LRG1", color: "#7a5fb5" },
    ];
    infos.forEach(function (info, li) {
      const lane = new THREE.Group();
      lane.position.x = (li - 1) * 25;

      const bead = new THREE.Mesh(new THREE.SphereGeometry(3.3, 32, 24), M.bead);
      bead.castShadow = false;
      lane.add(bead);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(3.31, 32, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 }));
      lane.add(shine);

      const dirs = [];
      for (let i = 0; i < 6; i++) {
        const az = (i / 6) * Math.PI * 2 + li * 0.4;
        const el = 0.35 + (i % 3) * 0.42;
        const d = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();
        dirs.push(d);
      }
      const antibodies = [];
      dirs.forEach(function (d) {
        const ab = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.4, 8), M.antibody);
        stem.position.y = 4.5;
        ab.add(stem);
        const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.7, 8), M.antibody);
        armL.position.set(-0.55, 6.2, 0); armL.rotation.z = 0.55;
        ab.add(armL);
        const armR = armL.clone(); armR.position.x = 0.55; armR.rotation.z = -0.55;
        ab.add(armR);
        ab.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
        lane.add(ab);
        antibodies.push(ab);
      });

      const antigens = [], detectors = [], hrps = [];
      dirs.forEach(function (d, i) {
        const tip = d.clone().multiplyScalar(7.0);
        const ag = new THREE.Mesh(new THREE.SphereGeometry(0.85, 18, 14), M.antigen);
        ag.position.copy(tip);
        ag.scale.setScalar(0.001);
        lane.add(ag); antigens.push(ag);

        const det = new THREE.Group();
        const ds = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.5, 8), M.detector);
        ds.position.y = 0.75; det.add(ds);
        const da = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.0, 8), M.detector);
        da.position.set(-0.28, 1.45, 0); da.rotation.z = 0.5; det.add(da);
        const db = da.clone(); db.position.x = 0.28; db.rotation.z = -0.5; det.add(db);
        det.position.copy(d.clone().multiplyScalar(8.2));
        det.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d));
        det.scale.setScalar(0.001);
        lane.add(det); detectors.push(det);

        const hrp = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), M.hrp);
        hrp.position.copy(d.clone().multiplyScalar(9.9));
        hrp.scale.setScalar(0.001);
        lane.add(hrp); hrps.push(hrp);
      });

      const lab = G.label(info.name, { fs: 22, mm: 4.4, color: "#ffffff", bg: info.color });
      lab.position.set(0, -9.5, 0);
      lane.add(lab);

      g.add(lane);
      lanes.push({ group: lane, antigens: antigens, detectors: detectors, hrps: hrps });
    });

    g.visible = false;
    return { group: g, back: back, lanes: lanes };
  }

  TP.dropMat = dropMaterial;
  TP.buildBench = buildBench;
  TP.buildTube = buildTube;
  TP.buildPipette = buildPipette;
  TP.buildDrops = buildDrops;
  TP.buildBeads = buildBeads;
  TP.buildMolecular = buildMolecular;
  TP.WE_DATA = WE_DATA;
})(window.TP);
