/* Elektrot şeridi ve Rev B kartuş geometrisi (spec_rev_b.py ölçüleri, mm). */
window.TP = window.TP || {};
(function (TP) {
  const G = TP.G, M = TP.M;

  function rectHole(x0, y0, x1, y1, r) {
    const p = new THREE.Path();
    r = r || 0;
    p.moveTo(x0 + r, y0);
    p.lineTo(x1 - r, y0);
    if (r) p.quadraticCurveTo(x1, y0, x1, y0 + r);
    p.lineTo(x1, y1 - r);
    if (r) p.quadraticCurveTo(x1, y1, x1 - r, y1);
    p.lineTo(x0 + r, y1);
    if (r) p.quadraticCurveTo(x0, y1, x0, y1 - r);
    p.lineTo(x0, y0 + r);
    if (r) p.quadraticCurveTo(x0, y0, x0 + r, y0);
    return p;
  }
  function circleHole(cx, cy, r) {
    const p = new THREE.Path();
    p.absarc(cx, cy, r, 0, Math.PI * 2, true);
    return p;
  }

  const WE_X = 5.5, WE_Y = [13.5, 20.5, 27.5];

  /* Şerit: yerel x -7..7, z 0..31, y yukarı. Baskı yüzü üstte. */
  function buildStrip() {
    const g = new THREE.Group();
    const T = 0.3;

    const pet = new THREE.Mesh(new THREE.BoxGeometry(14, T, 31), M.pet);
    pet.position.set(0, T / 2, 15.5);
    pet.receiveShadow = true;
    g.add(pet);

    const printY = T + 0.012;

    for (let i = 0; i < 5; i++) {
      const x = (7 + (i - 2) * 2.54) - 7;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 6.0), M.silver);
      pad.position.set(x, printY, 3.5);
      g.add(pad);
      const tr = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 4.2), M.silver);
      tr.position.set(x, printY, 8.2);
      g.add(tr);
    }

    const ce = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 18), M.carbon);
    ce.position.set(-5.25, printY + 0.02, 20.5);
    g.add(ce);

    const re = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 18), M.agcl);
    re.position.set(4.5, printY + 0.02, 20.5);
    g.add(re);

    const wes = [];
    WE_Y.forEach(function (y) {
      const ring = G.disc(2.2, 0.05, M.carbon, 40);
      ring.position.set(WE_X - 7, printY + 0.02, y);
      g.add(ring);
      const act = G.disc(2.0, 0.05, M.carbon, 40);
      act.position.set(WE_X - 7, printY + 0.035, y);
      g.add(act);
      wes.push(act);
    });

    // Dielektrik katman (şekil y = -z; rotateX sonrası z doğru çıkar)
    const shape = new THREE.Shape();
    shape.moveTo(-7, -31); shape.lineTo(7, -31); shape.lineTo(7, -7); shape.lineTo(-7, -7); shape.closePath();
    WE_Y.forEach(function (y) { shape.holes.push(circleHole(WE_X - 7, -y, 2.0)); });
    shape.holes.push(rectHole(-6.05, -29.4, -4.45, -11.6));
    shape.holes.push(rectHole(3.95, -29.4, 5.05, -11.6));
    const dg = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false, curveSegments: 24 });
    dg.rotateX(-Math.PI / 2);
    const die = new THREE.Mesh(dg, M.dielectric);
    die.position.y = T + 0.02;
    g.add(die);

    // Hidrofobik halka (13 × 20, duvar 0,4) — merkez z 20,5
    const ring = G.makeRoundedShape(13, 20, 1.2);
    const inner = G.makeRoundedShape(12.2, 19.2, 0.9);
    ring.holes.push(inner);
    const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.05, bevelEnabled: false, curveSegments: 12 });
    rg.rotateX(-Math.PI / 2);
    const rmesh = new THREE.Mesh(rg, M.hydro);
    rmesh.position.set(0, T + 0.09, 20.5);
    g.add(rmesh);

    // mıknatıs vurgu halkaları (adım 4)
    const glow = [];
    WE_Y.forEach(function (y) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(2.1, 2.6, 40),
        new THREE.MeshBasicMaterial({ color: 0x4aa3ff, transparent: true, opacity: 0, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(WE_X - 7, 0.01, y);
      g.add(ring);
      glow.push(ring);
    });

    return { group: g, wes: wes, WE_Y: WE_Y, glow: glow };
  }

  const KUYU = {
    "1.1": ["Plazma girişi", 8.0, 10.0, 6.0, 5.0],
    "1.2": ["Tampon 1:400", 19.5, 10.0, 9.0, 7.0],
    "1.3": ["Tampon 1:800", 32.0, 10.0, 12.0, 7.5],
    "1.4": ["CA19-9 boncuk", 9.0, 26.0, 5.0, 4.0],
    "1.5": ["TIMP1 boncuk", 20.0, 26.0, 5.0, 4.0],
    "1.6": ["LRG1 boncuk", 31.0, 26.0, 5.0, 4.0],
    "1.7": ["Yıkama tamponu", 11.5, 40.5, [15.0, 10.0], 7.0],
    "1.8": ["HQ / H₂O₂", 29.5, 40.5, 8.0, 6.0],
    "1.9": ["Atık", 20.0, 53.5, [30.0, 8.0], 7.0],
  };

  /* Kartuş: yerel x 0..40, z 0..84, y 0..10. Gövde y 0..10, altında şerit yuvası. */
  function buildCartridge(strip) {
    const g = new THREE.Group();

    const shape = G.makeRoundedShape(40, 84, 3);
    Object.keys(KUYU).forEach(function (id) {
      const k = KUYU[id];
      const X = k[1], Y = k[2], d = k[3];
      if (typeof d === "number") {
        shape.holes.push(circleHole(X - 20, -(Y - 42), d / 2));
      } else {
        shape.holes.push(rectHole(X - 20 - d[0] / 2, -(Y + d[1] / 2 - 42), X - 20 + d[0] / 2, -(Y - d[1] / 2 - 42), 1.5));
      }
    });
    shape.holes.push(rectHole(12.75 - 20, -(81.5 - 42), 27.25 - 20, -(59.5 - 42), 1.2));

    const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 10.0, bevelEnabled: false, curveSegments: 24 });
    bodyGeo.rotateX(-Math.PI / 2);
    bodyGeo.translate(20, 0, 42);
    const body = new THREE.Mesh(bodyGeo, M.cart);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);

    const wells = {}, labels = [];
    const liquidMat = {
      "1.1": M.liquidPlasma, "1.2": M.liquidBuffer, "1.3": M.liquidBuffer,
      "1.4": M.liquidBead, "1.5": M.liquidBead, "1.6": M.liquidBead,
      "1.7": M.liquidWash, "1.8": M.liquidAssay, "1.9": M.liquidWash,
    };
    const RIMCOL = {
      "1.1": 0xa87a1e, "1.2": 0x3a6f9e, "1.3": 0x3a6f9e,
      "1.4": 0x8a5c2b, "1.5": 0x8a5c2b, "1.6": 0x8a5c2b,
      "1.7": 0x5b8bab, "1.8": 0x5f7688, "1.9": 0x6f6f68,
    };
    Object.keys(KUYU).forEach(function (id) {
      const k = KUYU[id];
      const X = k[1], Y = k[2], d = k[3], depth = k[4];
      const rimMat = new THREE.MeshStandardMaterial({ color: RIMCOL[id], roughness: 0.42, envMapIntensity: 0.35 });
      if (typeof d === "number") {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(d / 2 + 0.3, 0.28, 8, 44), rimMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(X, 10.06, Y);
        g.add(rim);
      } else {
        const outer = G.makeRoundedShape(d[0] + 1.4, d[1] + 1.4, 1.8);
        outer.holes.push(G.makeRoundedShape(d[0] + 0.24, d[1] + 0.24, 1.2));
        const fg = new THREE.ExtrudeGeometry(outer, { depth: 0.08, bevelEnabled: false, curveSegments: 10 });
        fg.rotateX(-Math.PI / 2);
        const frame = new THREE.Mesh(fg, rimMat);
        frame.position.set(X, 10.02, Y);
        g.add(frame);
      }
      if (typeof d === "number") {
        const b = G.disc(d / 2, 0.12, M.darker, 36);
        b.position.set(X, 0.08, Y);
        g.add(b);
        const liq = new THREE.Mesh(new THREE.CylinderGeometry(d / 2 - 0.25, d / 2 - 0.25, 1, 32), liquidMat[id].clone());
        liq.position.set(X, 0.15, Y);
        liq.visible = false;
        g.add(liq);
        wells[id] = { x: X, y: Y, d: d, depth: depth, liquid: liq, maxH: depth - 0.4 };
      } else {
        const b = G.plate(d[0], d[1], M.darker, 0.12);
        b.position.set(X, 0.08, Y);
        g.add(b);
        const liq = new THREE.Mesh(new THREE.BoxGeometry(d[0] - 0.4, 1, d[1] - 0.4), liquidMat[id].clone());
        liq.position.set(X, 0.15, Y);
        liq.visible = false;
        g.add(liq);
        wells[id] = { x: X, y: Y, d: d, depth: depth, liquid: liq, maxH: depth - 0.4, rect: true };
      }
      const lab = G.label(id + " " + k[0], { fs: 20, mm: 2.3, color: "#52514e" });
      lab.position.set(X, 11.6, Y);
      g.add(lab);
      labels.push(lab);
      wells[id].label = lab;
    });

    strip.group.rotation.y = Math.PI;
    strip.group.position.set(20, 0.02, 91);
    g.add(strip.group);

    const winEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(14.5, 0.08, 22)),
      new THREE.LineBasicMaterial({ color: 0x7f8b98, transparent: true, opacity: 0.6 })
    );
    winEdges.position.set(20, 10.05, 70.5);
    g.add(winEdges);

    const wfMat = new THREE.MeshStandardMaterial({ color: 0x2a78d6, roughness: 0.35 });
    [[12.45, 70.5, 0.6, 22.8], [27.55, 70.5, 0.6, 22.8],
     [20, 59.2, 15.4, 0.6], [20, 81.8, 15.4, 0.6]].forEach(function (f) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(f[2], 0.12, f[3]), wfMat);
      bar.position.set(f[0], 10.1, f[1]);
      g.add(bar);
    });

    return { group: g, wells: wells, labels: labels, strip: strip, window: new THREE.Vector3(20, 10, 70.5) };
  }

  TP.buildStrip = buildStrip;
  TP.buildCartridge = buildCartridge;
  TP.KUYU = KUYU;
  TP.WE_CART = WE_Y.map(function (y) { return new THREE.Vector2(21.5, y); });
})(window.TP);
