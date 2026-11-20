/* Yardımcı grafik katmanı: malzemeler, yuvarlak gövde, canvas doku, etiket. */
window.TP = window.TP || {};
(function (TP) {
  const C = {
    bg: 0xecebe6, ink: 0x0b0b0b, panel: 0x2a78d6, ca: 0xeb6834,
    green: 0x0ca30c, yellow: 0xfab219, red: 0xd03b3b,
    timp: 0x2a78d6, lrg: 0x7a5fb5,
  };

  function std(o) { return new THREE.MeshStandardMaterial(o); }
  const M = {
    white: std({ color: 0xf4f2ec, roughness: 0.32, metalness: 0.0 }),
    shell: new THREE.MeshPhysicalMaterial({ color: 0xc9c5b8, roughness: 0.4, clearcoat: 0.45, clearcoatRoughness: 0.28 }),
    cart: std({ color: 0xdcd5c4, roughness: 0.58 }),
    dark: std({ color: 0x2b2c30, roughness: 0.55 }),
    darker: std({ color: 0x1b1c1f, roughness: 0.6 }),
    slot: std({ color: 0x3a3b40, roughness: 0.8 }),
    pet: std({ color: 0xf6f2e4, roughness: 0.45, metalness: 0.02 }),
    carbon: std({ color: 0x1a1a1c, roughness: 0.48, metalness: 0.18 }),
    silver: std({ color: 0xb4bac1, roughness: 0.32, metalness: 0.72 }),
    agcl: std({ color: 0x8d938c, roughness: 0.4, metalness: 0.35 }),
    dielectric: std({ color: 0x2a78d6, roughness: 0.52 }),
    hydro: std({ color: 0xdd7a2a, roughness: 0.5 }),
    gold: std({ color: 0xd9ae57, roughness: 0.24, metalness: 0.9 }),
    pcb: std({ color: 0x1e5c3c, roughness: 0.65 }),
    magnet: std({ color: 0x4c4f58, roughness: 0.3, metalness: 0.85 }),
    bead: std({ color: 0x8a5a2d, roughness: 0.55 }),
    beadDark: std({ color: 0x6b4420, roughness: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0.95, thickness: 1.2, ior: 1.46, transparent: false, depthWrite: false }),
    cover: new THREE.MeshPhysicalMaterial({ color: 0xcfd6dd, roughness: 0.15, transmission: 0.6, thickness: 2, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    liquidPlasma: std({ color: 0xf0d27a, roughness: 0.25, transparent: true, opacity: 0.9 }),
    liquidBuffer: std({ color: 0x9ec9e9, roughness: 0.25, transparent: true, opacity: 0.85 }),
    liquidWash: std({ color: 0xbdd9ef, roughness: 0.2, transparent: true, opacity: 0.75 }),
    liquidBead: std({ color: 0xb98a55, roughness: 0.5, transparent: true, opacity: 0.95 }),
    liquidAssay: std({ color: 0xd9e8f2, roughness: 0.2, transparent: true, opacity: 0.8 }),
    blood: std({ color: 0x8e1c22, roughness: 0.35 }),
    label: std({ color: 0xf7f5ef, roughness: 0.8 }),
    antibody: std({ color: 0x5d6b7a, roughness: 0.45 }),
    detector: std({ color: 0x3f6f8f, roughness: 0.45 }),
    hrp: std({ color: 0x22a06b, roughness: 0.4, emissive: 0x0d3a26, emissiveIntensity: 0.35 }),
    antigen: std({ color: 0xe0a33a, roughness: 0.4, emissive: 0x5a3a05, emissiveIntensity: 0.2 }),
    wire: new THREE.LineBasicMaterial({ color: 0x6f7c8a, transparent: true, opacity: 0.4 }),
  };
  Object.keys(M).forEach(function (k) {
    if (M[k].isMeshStandardMaterial) M[k].envMapIntensity = 0.5;
  });

  const G = {};

  G.makeRoundedShape = function (w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    r = Math.min(r, w / 2, h / 2);
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };

  /* Yuvarlak köşeli blok: w (x), h (z), d (y) */
  G.roundedBlock = function (w, h, d, r, mat) {
    const shape = G.makeRoundedShape(w, h, r);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 8 });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  G.canvasTex = function (w, h, draw, opts) {
    const c = document.createElement("canvas");
    c.width = w * (opts && opts.ss || 2);
    c.height = h * (opts && opts.ss || 2);
    const ctx = c.getContext("2d");
    ctx.scale((opts && opts.ss) || 2, (opts && opts.ss) || 2);
    draw(ctx, w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  };

  G.label = function (text, opts) {
    opts = opts || {};
    const fs = opts.fs || 22, pad = opts.pad || 8;
    const font = (opts.weight || 600) + " " + fs + 'px "Segoe UI", Inter, Arial, sans-serif';
    const tmp = document.createElement("canvas").getContext("2d");
    tmp.font = font;
    const tw = Math.ceil(tmp.measureText(text).width);
    const w = tw + pad * 2, h = fs + pad * 1.4;
    const tex = G.canvasTex(w, h, function (ctx) {
      ctx.font = font;
      ctx.textBaseline = "middle";
      if (opts.bg !== false) {
        ctx.fillStyle = opts.bg || "rgba(252,252,251,0.94)";
        const r = 7;
        ctx.beginPath();
        ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.quadraticCurveTo(w, 0, w, r);
        ctx.lineTo(w, h - r); ctx.quadraticCurveTo(w, h, w - r, h);
        ctx.lineTo(r, h); ctx.quadraticCurveTo(0, h, 0, h - r);
        ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.fill();
      }
      ctx.fillStyle = opts.color || "#0b0b0b";
      ctx.fillText(text, pad, h / 2 + 1);
    });
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sp = new THREE.Sprite(mat);
    const k = (opts.mm || 5.2) / h;
    sp.scale.set(w * k, h * k, 1);
    sp.renderOrder = 10;
    return sp;
  };

  /* ince düz levha (x-z düzlemi) */
  G.plate = function (w, l, mat, th) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, th || 0.05, l), mat);
    m.castShadow = false; m.receiveShadow = true;
    return m;
  };

  G.disc = function (r, h, mat, seg) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 32), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  G.setOpacity = function (obj, o) {
    obj.visible = o > 0.001;
    obj.traverse(function (n) {
      if (n.material) {
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        mats.forEach(function (mt) {
          if (!mt.__base) { mt.__base = { op: mt.opacity, tr: mt.transparent }; }
          if (o >= 0.999) {
            mt.opacity = mt.__base.op; mt.transparent = mt.__base.tr;
          } else {
            mt.transparent = true; mt.opacity = mt.__base.op * o;
          }
        });
      }
    });
  };

  G.lerp = function (a, b, t) { return a + (b - a) * t; };
  G.clamp01 = function (x) { return Math.max(0, Math.min(1, x)); };
  G.smooth = function (t) { t = G.clamp01(t); return t * t * (3 - 2 * t); };
  G.easeOut = function (t) { t = G.clamp01(t); return 1 - Math.pow(1 - t, 3); };
  G.easeInOut = function (t) { t = G.clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  TP.C = C; TP.M = M; TP.G = G;
})(window.TP);
