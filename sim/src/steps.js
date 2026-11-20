/* Adım koreografisi: 0 hazırlık → 1 örnek/seyreltme → 2 sandviç → 3 yıkama
   → 4 mıknatısla aktarım → 5 temas → 6 ölçüm → 7 risk skoru */
window.TP = window.TP || {};
(function (TP) {
  const G = TP.G, M = TP.M;
  const V3 = THREE.Vector3;

  function cartPt(O, x, y, z) {
    const p = O.cart.group.position;
    return new V3(p.x + x, p.y + y, p.z + z);
  }
  function setLiquid(O, id, h) {
    const w = O.cart.wells[id];
    if (!w) return;
    w.liquid.visible = h > 0.04;
    w.liquid.scale.y = Math.max(h, 0.001);
    w.liquid.position.y = 0.15 + h / 2;
  }
  function clearWells(O) { Object.keys(O.cart.wells).forEach(function (id) { setLiquid(O, id, 0); }); }
  function setCartY(O, y) { O.cart.group.position.y = y; }
  function setPipette(O, p) {
    if (!p) { O.pipette.group.visible = false; O.pipette.liquid.visible = false; return; }
    O.pipette.group.visible = true;
    O.pipette.group.position.copy(p);
  }
  function hideDrops(O) { O.drops.forEach(function (d) { d.mesh.visible = false; }); }
  function drop(O, i, from, to, u, r, kind) {
    const d = O.drops[i];
    if (!d) return;
    d.mesh.visible = true;
    if (kind && d.mesh.userData.kind !== kind) {
      d.mesh.material = TP.dropMat(kind);
      d.mesh.userData.kind = kind;
    }
    const p = new V3().lerpVectors(from, to, u);
    p.y += Math.sin(Math.PI * u) * 4;
    d.mesh.position.copy(p);
    d.mesh.scale.setScalar(r || 0.85);
  }
  /* Yukarıdan pencereye dikey düşüş (gövdeye girmeden) */
  function dropVertical(O, i, from, to, u, r, kind) {
    const d = O.drops[i];
    if (!d) return;
    d.mesh.visible = true;
    if (kind && d.mesh.userData.kind !== kind) {
      d.mesh.material = TP.dropMat(kind);
      d.mesh.userData.kind = kind;
    }
    const p = new V3().copy(from);
    p.y = G.lerp(from.y, to.y, G.easeInOut(u));
    d.mesh.position.copy(p);
    d.mesh.scale.setScalar((r || 0.85) * (1 + 0.15 * Math.sin(Math.PI * u)));
  }
  function setGlow(O, a) {
    O.strip.glow.forEach(function (r) { r.material.opacity = 0.55 * a; });
    O.reader.magGlow.forEach(function (r) { r.material.opacity = 0.6 * a; });
  }
  function setPogo(O, a) {
    O.reader.pogo.position.y = 22.2 - 0.95 * a;
  }
  function setBeads(O, progress) {
    const dummy = new THREE.Object3D();
    O.beads.forEach(function (im, wi) {
      if (progress < 0) { im.visible = false; return; }
      im.visible = true;
      const base = im.userData.base;
      for (let i = 0; i < base.length; i++) {
        const b = base[i];
        const q = G.clamp01((progress * 1.35 - (1 - b.d) * 0.45) / 0.55);
        const y = G.lerp(9.0, 0.55, G.easeOut(q)) + (1 - q) * Math.sin(i * 1.7) * 0.6;
        dummy.position.set(b.x + (1 - q) * Math.sin(i * 2.1) * 0.5, y, b.z + (1 - q) * Math.cos(i * 1.3) * 0.5);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
    });
  }
  function setMolProgress(O, p, visible) {
    O.mol.group.visible = visible;
    if (!visible) return;
    p = G.clamp01(p);
    O.mol.lanes.forEach(function (lane, li) {
      lane.antigens.forEach(function (ag, i) {
        const s = G.easeOut(G.clamp01((p - 0.12 - i * 0.045 - li * 0.02) * 4.5));
        ag.scale.setScalar(Math.max(0.001, s));
      });
      lane.detectors.forEach(function (d, i) {
        const s = G.easeOut(G.clamp01((p - 0.52 - i * 0.035) * 4.0));
        d.scale.setScalar(Math.max(0.001, s));
      });
      lane.hrps.forEach(function (h, i) {
        const s = G.easeOut(G.clamp01((p - 0.70 - i * 0.035) * 4.0));
        h.scale.setScalar(Math.max(0.001, s));
      });
    });
  }

  function pipetteMove(O, u, fromWell, toWell, lift, dropIdx, dropKind, noDrop) {
    const A = fromWell, B = toWell;
    const pos = new V3().lerpVectors(A, B, G.easeInOut(u));
    pos.y += Math.sin(Math.PI * G.clamp01(u)) * lift;
    setPipette(O, pos);
    O.pipette.liquid.visible = u > 0.12 && u < 0.9;
    if (!noDrop) {
      if (u > 0.86) {
        const dstart = pos.clone(); dstart.y -= 10;
        drop(O, dropIdx, dstart, B, (u - 0.86) / 0.14, 0.9, dropKind);
      } else {
        O.drops[dropIdx].mesh.visible = false;
      }
    }
  }

  const WASH = { plane: null };

  function baseState(O) {
    setCartY(O, TP.CART_HOVER.y);
    clearWells(O);
    setPipette(O, null);
    hideDrops(O);
    setMolProgress(O, 0, false);
    setBeads(O, -1);
    setGlow(O, 0);
    setPogo(O, 0);
    O.reader.led.material.color.setHex(0x2a78d6);
    O.reader.led.material.opacity = 0.25;
  }
  function after1(O) {
    baseState(O);
    setLiquid(O, "1.1", 2.6);
    setLiquid(O, "1.2", 4.2);
    setLiquid(O, "1.3", 4.6);
  }
  function after2(O) {
    after1(O);
    setLiquid(O, "1.4", 3.2);
    setLiquid(O, "1.5", 3.2);
    setLiquid(O, "1.6", 3.2);
    setMolProgress(O, 1, true);
  }
  function after3(O) {
    after2(O);
    setLiquid(O, "1.7", 5.5);
    ["1.4", "1.5", "1.6"].forEach(function (id) { O.cart.wells[id].liquid.material.opacity = 0.55; });
  }
  function after4(O) {
    after3(O);
    setCartY(O, TP.CART_POS.y);
    setLiquid(O, "1.4", 0); setLiquid(O, "1.5", 0); setLiquid(O, "1.6", 0);
    setBeads(O, 1);
    setGlow(O, 1);
    setMolProgress(O, 1, false);
  }
  function after5(O) {
    after4(O);
    setPogo(O, 1);
    O.reader.led.material.color.setHex(0x2a78d6);
    O.reader.led.material.opacity = 1.0;
  }

  const TUBE_TOP = new V3(-80, 58, 42);

  const STEPS = [
    {
      key: "hazir", title: "Hazırlık", tag: "0",
      desc: "Kartuş ve okuyucu hazır. Test, risk grubundaki kişiden alınan standart bir kan örneğiyle başlar.",
      dur: 6,
      cam: { pos: [148, 152, -196], target: [0, 34, 0] },
      enter: baseState,
      update: function (O, sim, t, time) {
        baseState(O);
        O.cart.group.rotation.y = Math.sin(time * 0.25) * 0.03;
        if (TP.UI) TP.UI.screen("idle");
      },
    },
    {
      key: "ornek", title: "Kan örneği ve seyreltme", tag: "1",
      desc: "Plazma ayrılır. CA19-9 seyreltilmeden, TIMP1 1:400, LRG1 1:320.000 (iki adımda) çalışılır.",
      dur: 14,
      cam: { pos: [-56, 146, -200], target: [-30, 32, 26] },
      enter: baseState,
      update: function (O, sim, t) {
        baseState(O);
        O.cart.group.rotation.y = 0;
        const w11 = cartPt(O, 8, 13.5, 10), w12 = cartPt(O, 19.5, 13.5, 10), w13 = cartPt(O, 32, 13.5, 10);
        const trips = [
          { a: 0.02, b: 0.30, to: w11, fill: "1.1", h: 2.6, color: "plasma" },
          { a: 0.36, b: 0.64, to: w12, fill: "1.2", h: 4.2, color: "buffer" },
          { a: 0.70, b: 0.96, to: w13, fill: "1.3", h: 4.6, color: "buffer" },
        ];
        let active = false;
        trips.forEach(function (tr, i) {
          if (t >= tr.a && t <= tr.b) {
            active = true;
            pipetteMove(O, (t - tr.a) / (tr.b - tr.a), TUBE_TOP, tr.to, 8, i, tr.color);
          }
          if (t > tr.b) setLiquid(O, tr.fill, tr.h);
          if (t < tr.b) O.drops[i].mesh.visible = false;
        });
        if (!active) setPipette(O, null);
        if (t > 0.95) {
          const f = G.clamp01((t - 0.95) / 0.05);
          O.cart.wells["1.3"].liquid.material.color.setHex(0xa8cdea);
          O.cart.wells["1.3"].liquid.material.opacity = G.lerp(0.85, 1, f);
        }
        if (TP.UI) TP.UI.screen("sample", { t: t });
      },
    },
    {
      key: "sandvic", title: "Boncuk inkübasyonu", tag: "2",
      desc: "Her belirteç için antikor kaplı manyetik boncuklar plazmayla karışır. Boncuk – antikor – belirteç – dedektör – HRP zinciri kurulur.",
      dur: 15,
      cam: { pos: [56, 150, -84], target: [2, 106, 14] },
      enter: after1,
      update: function (O, sim, t, time) {
        after1(O);
        setMolProgress(O, G.clamp01(t * 1.1), true);
        O.mol.group.rotation.y = Math.sin(time * 0.2) * 0.06;
        ["1.4", "1.5", "1.6"].forEach(function (id, i) {
          setLiquid(O, id, 3.2 * G.easeOut(G.clamp01((t - i * 0.06) * 1.8)));
        });
        if (TP.UI) TP.UI.screen("incubate", { t: t });
      },
    },
    {
      key: "yikama", title: "Yıkama", tag: "3",
      desc: "Bağlanmayan antikor ve belirteçler yıkanıp uzaklaştırılır. Boncukta yalnızca sandviç yapı kalır.",
      dur: 11,
      cam: { pos: [34, 142, -90], target: [-4, 104, 20] },
      enter: after2,
      update: function (O, sim, t, time) {
        after2(O);
        setMolProgress(O, 1, true);
        O.mol.group.rotation.y = 0;
        setLiquid(O, "1.7", 5.5 * G.easeOut(G.clamp01(t * 2.2)));
        ["1.4", "1.5", "1.6"].forEach(function (id, i) {
          const l = O.cart.wells[id].liquid;
          l.material.opacity = G.lerp(0.9, 0.5, G.clamp01(t * 1.6));
          setLiquid(O, id, 3.2 - 0.6 * G.clamp01((t - 0.5 - i * 0.05) * 2));
        });
        if (!WASH.plane) {
          WASH.plane = new THREE.Mesh(
            new THREE.PlaneGeometry(70, 26),
            new THREE.MeshBasicMaterial({ color: 0x9fd0f5, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
          );
          WASH.plane.rotation.x = -Math.PI / 2;
          O.mol.group.add(WASH.plane);
        }
        const u = G.clamp01((t - 0.1) / 0.45);
        WASH.plane.position.y = G.lerp(-12, 16, u);
        WASH.plane.material.opacity = t < 0.55 ? 0.28 * Math.sin(Math.PI * u) : 0;
        if (TP.UI) TP.UI.screen("wash", { t: t });
      },
    },
    {
      key: "miknatis", title: "Mıknatısla elektrota aktarım", tag: "4",
      desc: "Boncuklar kendi çalışma elektrotlarına aktarılır; elektrot altındaki mıknatıs (Ø3 × 2 mm N52) boncukları yüzeyde tutar.",
      dur: 13,
      cam: { pos: [45, 175, 5], target: [2, 14, 56] },
      enter: after3,
      update: function (O, sim, t, time) {
        after3(O);
        const seat = G.easeInOut(G.clamp01(t / 0.32));
        setCartY(O, G.lerp(TP.CART_HOVER.y, TP.CART_POS.y, seat));
        O.cart.group.rotation.y = 0;
        setMolProgress(O, 1, t < 0.28);
        setGlow(O, G.clamp01((t - 0.45) / 0.2));
        setBeads(O, G.clamp01((t - 0.42) / 0.5));

        const froms = [cartPt(O, 9, 13.5, 26), cartPt(O, 20, 13.5, 26), cartPt(O, 31, 13.5, 26)];
        const overWin = [cartPt(O, 21.5, 12.6, 77.5), cartPt(O, 21.5, 12.6, 70.5), cartPt(O, 21.5, 12.6, 63.5)];
        const land = [cartPt(O, 21.5, 0.9, 77.5), cartPt(O, 21.5, 0.9, 70.5), cartPt(O, 21.5, 0.9, 63.5)];
        let anyActive = false;
        for (let i = 0; i < 3; i++) {
          const a = 0.33 + i * 0.19, b = a + 0.13, c = b + 0.12;
          if (t > a && t <= b) {
            anyActive = true;
            pipetteMove(O, (t - a) / (b - a), froms[i], overWin[i], 5, i, "bead", true);
          } else if (t > b && t < c) {
            anyActive = true;
            setPipette(O, null);
            dropVertical(O, i, overWin[i], land[i], (t - b) / (c - b), 0.95, "bead");
          }
        }
        if (!anyActive) {
          setPipette(O, null);
          if (t > 0.92) for (let i = 0; i < 3; i++) O.drops[i].mesh.visible = false;
        }
        if (t > 0.55) { setLiquid(O, "1.4", 0); setLiquid(O, "1.5", 0); setLiquid(O, "1.6", 0); }
        if (TP.UI) TP.UI.screen("magnet", { t: t });
      },
    },
    {
      key: "temas", title: "Temas ve ölçüme hazırlık", tag: "5",
      desc: "Kartuş yuvaya oturur; 5 yaylı kontak (pogo) şeritteki pedlere yukarıdan basar. Okuyucu kartuşu tanır.",
      dur: 10,
      cam: { pos: [118, 142, -168], target: [0, 24, 2] },
      enter: after4,
      update: function (O, sim, t, time) {
        after4(O);
        setCartY(O, TP.CART_POS.y);
        O.cart.group.rotation.y = 0;
        setPogo(O, G.easeOut(G.clamp01((t - 0.1) / 0.35)));
        const led = G.clamp01((t - 0.45) / 0.2);
        O.reader.led.material.opacity = led;
        O.reader.led.material.color.setHex(0x2a78d6);
        if (TP.UI) TP.UI.screen(t > 0.5 ? "ready" : "contact", { t: t });
        if (TP.UI) TP.UI.contactProgress(G.clamp01((t - 0.35) / 0.5));
      },
    },
    {
      key: "olcum", title: "Elektrokimyasal ölçüm", tag: "6",
      desc: "H₂O₂ eklenir, sabit voltajda amperometri yapılır. Ölçülen akım belirteç miktarıyla orantılıdır; üç kanal sırayla okunur.",
      dur: 19,
      cam: { pos: [32, 170, 6], target: [1.5, 12, 60] },
      enter: after5,
      update: function (O, sim, t, time) {
        after5(O);
        setCartY(O, TP.CART_POS.y);
        O.cart.group.rotation.y = 0;
        const d = cartPt(O, 20, 26, 70.5);
        drop(O, 3, d, cartPt(O, 20, 0.9, 70.5), G.clamp01((t - 0.04) / 0.14), 1.15, "assay");
        O.drops[3].mesh.visible = t < 0.24;
        O.reader.led.material.color.setHex(0x2a78d6);
        const pulse = 0.7 + 0.3 * Math.sin(time * 4);
        O.reader.led.material.opacity = pulse;
        setGlow(O, 1 + 0.15 * Math.sin(time * 3));
        if (TP.UI) TP.UI.screen("measure", { t: t, sim: sim });
        if (TP.UI) TP.UI.measureProgress(t, sim);
      },
    },
    {
      key: "skor", title: "Risk skoru", tag: "7",
      desc: "Üç ölçüm tek bir 0–100 risk skoruna çevrilir. Hekim sonucu renk kategorisi ve öneriyle görür.",
      dur: 12,
      cam: { pos: [110, 150, -160], target: [0, 20, 6] },
      enter: after5,
      update: function (O, sim, t, time) {
        after5(O);
        setCartY(O, TP.CART_POS.y);
        O.cart.group.rotation.y = 0;
        O.reader.led.material.color.setHex(TP.UI ? TP.UI.catHex(sim.result.risk.category) : 0x0ca30c);
        O.reader.led.material.opacity = 1;
        if (TP.UI) TP.UI.screen("result", { t: t, sim: sim });
        if (TP.UI) TP.UI.resultProgress(t, sim);
      },
    },
  ];

  TP.STEPS = STEPS;
  TP.steps = { cartPt: cartPt, setLiquid: setLiquid, setBeads: setBeads, setGlow: setGlow, setPogo: setPogo };
})(window.TP);
