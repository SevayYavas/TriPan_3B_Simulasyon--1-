/* TriPan — sanal hasta, sensör ve risk skoru modeli.
   Kaynaklar: adim2/risk_skoru.py (katsayılar, referanslar), adim3/sensor_sim.py (4PL kalibrasyon).
   Tüm değerler sanaldır; klinik kanıt değildir. */
window.TP = window.TP || {};
(function (TP) {
  const LN2 = Math.LN2;
  const PHI95 = 1.6448536269514722;

  function lin2log(mean, sd) {
    const s2 = Math.log(1 + (sd / mean) ** 2);
    return { mean: (Math.log(mean) - s2 / 2) / LN2, sd: Math.sqrt(s2) / LN2 };
  }

  const REF = {
    "CA19-9": { mean: Math.log2(10), sd: (Math.log2(37) - Math.log2(10)) / PHI95 },
    "TIMP1": lin2log(73.5, 14.2),
    "LRG1": lin2log(43.0, 9.9),
  };
  const COEF3 = { "CA19-9": 0.733, "TIMP1": 1.348, "LRG1": 0.961 };
  const COEF2 = { "TIMP1": 1.630, "LRG1": 1.140 };
  const RHO = 0.20;
  const ESIK_SARI = 95, ESIK_KIRMIZI = 99, LEWIS = 1.5;

  const UNIT = { "CA19-9": "U/mL", "TIMP1": "ng/mL", "LRG1": "µg/mL" };
  const RANGE = { "CA19-9": [1.5, 500], "TIMP1": [5.2, 1000], "LRG1": [4.2, 800] };

  // 4PL — sensor_sim.py ile aynı parametreler
  const I_BLANK = 60, I_SPAN = 1440, SIG_CV = 0.05, PIP_CV = 0.02;
  const CH = {
    "CA19-9": { lo: 5, hi: 500, lod: 1.5, D: 1, adim: 0, carpan: 1, plasmaUnit: "U/mL" },
    "TIMP1": { lo: 43.4, hi: 2500, lod: 13, D: 400, adim: 1, carpan: 1e-3, plasmaUnit: "ng/mL" },
    "LRG1": { lo: 43.4, hi: 2500, lod: 13, D: 320000, adim: 2, carpan: 1e-6, plasmaUnit: "µg/mL" },
  };
  Object.keys(CH).forEach(function (k) {
    const p = CH[k];
    p.ec50 = Math.sqrt(p.lo * p.hi);
    p.h = Math.log(81) / Math.log(p.hi / p.lo);
    const frac = function (c) { return Math.pow(c, p.h) / (Math.pow(p.ec50, p.h) + Math.pow(c, p.h)); };
    p.sigBlank = I_SPAN * frac(p.lod) / 3;
    p.frac = frac;
  });

  function currentOf(k, wellConc) {
    const p = CH[k], c = Math.max(wellConc, 0);
    return I_BLANK + I_SPAN * Math.pow(c, p.h) / (Math.pow(p.ec50, p.h) + Math.pow(c, p.h));
  }
  function concOf(k, i) {
    const p = CH[k], f = Math.min(1 - 1e-9, Math.max(1e-9, (i - I_BLANK) / I_SPAN));
    return p.ec50 * Math.pow(f / (1 - f), 1 / p.h);
  }

  function rngFactory(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rnd) {
    let u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* Plazma değeri → çipin okuduğu değer (seyreltme, 4PL, gürültü, aralık kırpma) */
  function measure(k, plasma, opts) {
    const p = CH[k];
    const wellTrue = plasma / p.carpan / p.D;
    let well = wellTrue;
    if (opts && opts.noise) {
      const rnd = rngFactory(opts.seed + k.length * 7919);
      if (p.adim) well = well * Math.exp(gauss(rnd) * PIP_CV * Math.sqrt(p.adim));
    }
    let i = currentOf(k, well);
    if (opts && opts.noise) {
      const rnd = rngFactory((opts.seed * 31 + k.charCodeAt(0) * 977) >>> 0);
      const sd = Math.sqrt(p.sigBlank ** 2 + (SIG_CV * (i - I_BLANK)) ** 2);
      i += gauss(rnd) * sd;
    }
    let measuredWell = concOf(k, i);
    let over = false;
    if (measuredWell > p.hi) { measuredWell = p.hi; over = true; }
    if (measuredWell < p.lod * 0.5) measuredWell = p.lod * 0.5;
    const plasmaMeasured = measuredWell * p.D * p.carpan;
    return {
      current: i, well: measuredWell, plasma: plasmaMeasured, over: over,
      inRange: !over && wellTrue >= p.lod && wellTrue <= p.hi,
    };
  }

  function zscore(marker, value) {
    const r = REF[marker];
    return (Math.log2(Math.max(value, 1e-6)) - r.mean) / r.sd;
  }
  function coefSd(coef) {
    const ks = Object.keys(coef);
    let v = 0;
    ks.forEach(function (k) { v += coef[k] * coef[k]; });
    for (let i = 0; i < ks.length; i++)
      for (let j = i + 1; j < ks.length; j++)
        v += 2 * RHO * coef[ks[i]] * coef[ks[j]];
    return Math.sqrt(v);
  }
  const SD3 = coefSd(COEF3), SD2 = coefSd(COEF2);

  function ncdf(x) {
    // Abramowitz–Stegun 7.1.26
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = 1 - d * ((((1.330274429 * t - 1.821255978) * t + 1.781477937) * t - 0.356563782) * t + 0.319381530) * t;
    return x >= 0 ? p : 1 - p;
  }

  /* risk_skoru.py akışı: kalite kontrol → Lewis → z → panel → persentil → kategori */
  function risk(meas) {
    const warnings = [];
    const vals = {
      "CA19-9": meas["CA19-9"].plasma,
      "TIMP1": meas["TIMP1"].plasma,
      "LRG1": meas["LRG1"].plasma,
    };
    let ca = vals["CA19-9"];
    if (meas["CA19-9"].over) {
      warnings.push("CA19-9 ölçüm üst sınırını aştı (> 500 U/mL); modele 500 olarak girdi.");
      ca = 500;
    }
    const lewis = ca < LEWIS;
    const coef = lewis ? COEF2 : COEF3;
    const zs = {}, katki = {};
    let s = 0;
    Object.keys(coef).forEach(function (k) {
      const v = k === "CA19-9" ? ca : vals[k];
      zs[k] = zscore(k, v);
      katki[k] = coef[k] * zs[k];
      s += katki[k];
    });
    if (lewis) warnings.push("CA19-9 < 1,5 U/mL: kişi CA19-9 üretemiyor olabilir (Lewis-negatif). Skor TIMP1 + LRG1 ile hesaplandı.");
    if (zs["TIMP1"] > 2) warnings.push("TIMP1 yüksek: sarılık, kronik pankreatit ve kaşeksi de TIMP1'i yükseltebilir.");
    let pct = 100 * ncdf(s / (lewis ? SD2 : SD3));
    pct = Math.max(0.1, Math.min(99.9, pct));
    let kat, oneri;
    if (pct >= ESIK_KIRMIZI) {
      kat = "KIRMIZI";
      oneri = "Yüksek risk. Gastroenteroloji sevki ve ileri görüntüleme (EUS veya MR) önerilir.";
    } else if (pct >= ESIK_SARI) {
      kat = "SARI";
      oneri = "Sınırda. 3 ay içinde testi tekrarlayın; klinik risk faktörleriyle değerlendirin.";
    } else {
      kat = "YEŞİL";
      oneri = "Düşük risk. Risk grubundaysa rutin takip aralığında tekrar.";
    }
    return {
      score: pct, category: kat, advice: oneri, model: lewis ? "TIMP1 + LRG1 (yedek)" : "CA19-9 + TIMP1 + LRG1",
      z: zs, contribution: katki, lewis: lewis, warnings: warnings, panel: s,
    };
  }

  function evaluate(ca199, timp1, lrg1, opts) {
    const src = { "CA19-9": ca199, "TIMP1": timp1, "LRG1": lrg1 };
    const m = {};
    let outOfRange = null;
    Object.keys(src).forEach(function (k) {
      m[k] = measure(k, src[k], opts);
      if (k === "CA19-9" && src[k] < LEWIS) return;
      if (src[k] < RANGE[k][0] || src[k] > RANGE[k][1]) outOfRange = k;
    });
    const r = risk(m);
    if (outOfRange && outOfRange !== "CA19-9") {
      r.warnings.unshift(outOfRange + " ölçüm aralığı dışında; farklı seyreltmeyle tekrar ölçülmeli.");
    }
    return { meas: m, risk: r, source: src };
  }

  const PRESETS = [
    { id: "saglikli", name: "Sağlıklı kontrol", ca: 12, timp: 78, lrg: 44, note: "Rutin takip" },
    { id: "sinirda", name: "Sınırda (sarı)", ca: 24, timp: 102, lrg: 57, note: "3 ay içinde tekrar" },
    { id: "erken", name: "Erken evre hasta", ca: 30, timp: 120, lrg: 66, note: "CA19-9 normal ama panel yakalıyor" },
    { id: "ucu", name: "Üçü de yüksek", ca: 85, timp: 110, lrg: 62, note: "Kırmızı bölge" },
    { id: "lewis", name: "Lewis-negatif", ca: 0.8, timp: 105, lrg: 60, note: "CA19-9 üretmiyor; yedek model" },
  ];

  TP.Model = {
    REF: REF, COEF3: COEF3, COEF2: COEF2, CH: CH, UNIT: UNIT, RANGE: RANGE,
    I_BLANK: I_BLANK, I_SPAN: I_SPAN, SD3: SD3, SD2: SD2,
    measure: measure, evaluate: evaluate, risk: risk, zscore: zscore, currentOf: currentOf, concOf: concOf,
    PRESETS: PRESETS, ncdf: ncdf, rngFactory: rngFactory, gauss: gauss,
  };
})(window.TP);
