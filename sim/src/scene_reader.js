/* TriPan okuyucu — spec_okuyucu.py (48 × 170 × 18 mm, gövde içi 12 mm). */
window.TP = window.TP || {};
(function (TP) {
  const G = TP.G, M = TP.M;

  function buildReader() {
    const g = new THREE.Group();

    // Alt gövde
    const base = G.roundedBlock(48, 170, 12, 4, M.shell);
    g.add(base);

    // Yan duvarlar (üst kenar 18 mm); kontak bölmesi (z > 70) açık kalır
    const wallMat = M.shell;
    const walls = [
      [2.5, 6, 155, -22.75, 15, -7.5],
      [2.5, 6, 155, 22.75, 15, -7.5],
      [44, 6, 2.5, 0, 15, -83.75],
      [44, 6, 2.5, 0, 15, 83.75],
    ];
    walls.forEach(function (w) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w[0], w[1], w[2]), wallMat);
      m.position.set(w[3], w[4], w[5]);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    });

    // İç zemin (yuva tabanı)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(44, 0.3, 144), M.dark);
    floor.position.set(0, 12.16, -8);
    floor.receiveShadow = true;
    g.add(floor);

    // Ekran modülü (ön)
    const scrBase = G.roundedBlock(38, 60, 5.6, 2.2, M.shell);
    scrBase.position.set(0, 12, -52);
    scrBase.castShadow = true;
    g.add(scrBase);
    const bezel = G.roundedBlock(38, 60, 1.7, 2.2, M.darker);
    bezel.position.set(0, 17.6, -52);
    g.add(bezel);

    const scrCanvas = document.createElement("canvas");
    scrCanvas.width = 512; scrCanvas.height = 683;
    const scrTex = new THREE.CanvasTexture(scrCanvas);
    scrTex.encoding = THREE.sRGBEncoding;
    scrTex.anisotropy = 8;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(30.6, 40.8),
      new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false })
    );
    const scrGrp = new THREE.Group();
    scrGrp.rotation.x = -Math.PI / 2;
    scrGrp.position.set(0, 19.34, -52);
    screen.rotation.z = Math.PI;   // ekranın üstü kullanıcıya dönük
    scrGrp.add(screen);
    g.add(scrGrp);

    // Güç / ölçüm tuşu
    const btn = G.disc(2.1, 0.7, M.silver, 32);
    btn.position.set(18, 12.35, -74);
    g.add(btn);
    const btnRing = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.35, 10, 32), M.darker);
    btnRing.rotation.x = Math.PI / 2;
    btnRing.position.set(18, 12.15, -74);
    g.add(btnRing);

    // Durum LED'i
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x2a78d6, transparent: true, opacity: 0.25 })
    );
    led.position.set(-19, 12.4, -76);
    g.add(led);

    // USB-C (arka duvar)
    const usb = new THREE.Mesh(new THREE.BoxGeometry(9, 3.2, 1.2), M.darker);
    usb.position.set(0, 8, 84.6);
    g.add(usb);

    // Kontak köprüsü (arka) — şerit kuyruğu köprünün altına girer
    const bridgeMat = M.shell;
    [-14.2, 14.2].forEach(function (x) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(2.6, 14, 3.4), bridgeMat);
      pil.position.set(x, 19, 75.8);
      pil.castShadow = true; pil.receiveShadow = true;
      g.add(pil);
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(31, 2.4, 4.2), bridgeMat);
    beam.position.set(0, 26.2, 75.8);
    beam.castShadow = true;
    g.add(beam);

    // Kartuş yuvası çevresi (siyah conta)
    const gasket = new THREE.Mesh(
      new THREE.BoxGeometry(45, 0.2, 95),
      new THREE.MeshBasicMaterial({ color: 0x1a1b1e })
    );
    gasket.position.set(0, 12.34, 30.3);
    g.add(gasket);

    // Mıknatıslar (kartuş yuvası zemininde; X 25,5 → yerel 1,5)
    const mags = [];
    const magGlow = [];
    [51.8, 58.8, 65.8].forEach(function (z) {
      const m = G.disc(1.5, 2.0, M.magnet, 32);
      m.position.set(1.5, 11.2, z);
      m.castShadow = true;
      g.add(m);
      mags.push(m);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.7, 2.5, 40),
        new THREE.MeshBasicMaterial({ color: 0x4aa3ff, transparent: true, opacity: 0, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(1.5, 12.35, z);
      g.add(ring);
      magGlow.push(ring);
    });

    // Pogo pin dizisi (5 × 2,54 mm) — köprüden şerit pedlerine
    const pogo = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.BoxGeometry(14, 5.0, 4.2), M.darker);
    housing.position.set(0, 0.1, 0);
    pogo.add(housing);
    for (let i = 0; i < 5; i++) {
      const x = -5.08 + i * 2.54;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 3.2, 12), M.gold);
      barrel.position.set(x, -2.8, 0);
      pogo.add(barrel);
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.26, 6.0, 12), M.gold);
      tip.position.set(x, -5.8, 0);
      pogo.add(tip);
      const spring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.12, 6, 14), M.silver);
      spring.rotation.x = Math.PI / 2;
      spring.position.set(x, -4.6, 0);
      pogo.add(spring);
    }
    pogo.position.set(0, 22.2, 75.8);
    g.add(pogo);

    // PCB ve bileşenler (yuva zemininin altında, gövde içinde)
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(42, 0.8, 100), M.pcb);
    pcb.position.set(0, 10.6, 10);
    g.add(pcb);
    const comp1 = new THREE.Mesh(new THREE.BoxGeometry(30.5, 2.6, 18), M.darker);
    comp1.position.set(-6, 9.0, 34);
    g.add(comp1);
    const comp2 = new THREE.Mesh(new THREE.BoxGeometry(18, 3.1, 25.5), M.darker);
    comp2.position.set(12, 8.9, 12);
    g.add(comp2);

    return {
      group: g, screen: screen, screenCanvas: scrCanvas, screenTex: scrTex,
      led: led, pogo: pogo, magnets: mags, magGlow: magGlow,
    };
  }

  TP.buildReader = buildReader;

  // Yerel okuyucu koordinatları → dünya (okuyucu merkezde, z -85..85)
  TP.readerLocal = function (x, y, z) { return new THREE.Vector3(x, y, z); };
  TP.CART_POS = new THREE.Vector3(-20, 12.3, -11.7);   // oturmuş konum (yerel x0=4, z0=73,3)
  TP.CART_HOVER = new THREE.Vector3(-20, 46, -11.7);
})(window.TP);
