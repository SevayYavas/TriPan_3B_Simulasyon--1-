/* Arayüz: hasta paneli, adımlar, grafik, risk göstergesi, okuyucu ekranı. */
window.TP = window.TP || {};
(function (TP) {
  const UI = {};
  TP.UI = UI;
  const M = TP.Model;
  const $ = function (s) { return document.querySelector(s); };
  const fmt = function (v, d) {
    if (!isFinite(v)) return "—";
    return v.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
  };
  const CAT = { "YEŞİL": { sym: "●", cls: "g", hex: 0x0ca30c }, "SARI": { sym: "▲", cls: "y", hex: 0xfab219 }, "KIRMIZI": { sym: "■", cls: "r", hex: 0xd03b3b } };
  UI.catHex = function (cat) { return (CAT[cat] || CAT["YEŞİL"]).hex; };

  let app = null, gaugeShown = 0, chartData = null, screenKey = "", lastScreen = 0;
  const scr = { ctx: null, canvas: null, tex: null };

  UI.init = function (a) {
    app = a;
    scr.canvas = a.O.reader.screenCanvas;
    scr.ctx = scr.canvas.getContext("2d");
    scr.tex = a.O.reader.screenTex;

    buildSteps();
    buildPresets();
    buildSliders();
    buildChannels();
    wireInfo();
    wireChartZoom();
    syncSliders();
    refreshPatient(false);
    setStep(0);
  };

  function buildSteps() {
    const el = $("#steps");
    el.innerHTML = "";
    TP.STEPS.forEach(function (s, i) {
      if (i === 0) return;
      const b = document.createElement("button");
      b.className = "step";
      b.innerHTML = '<span class="n">' + s.tag + '</span><span class="tx">' + s.title + "</span>";
      b.addEventListener("click", function () { app.goStep(i, true); });
      el.appendChild(b);
    });
  }

  function buildPresets() {
    const el = $("#presets");
    el.innerHTML = "";
    M.PRESETS.forEach(function (p) {
      const b = document.createElement("button");
      b.className = "preset";
      b.innerHTML = p.name + "<small>" + p.note + "</small>";
      b.title = p.note;
      b.dataset.id = p.id;
      b.addEventListener("click", function () { applyPreset(p); });
      el.appendChild(b);
    });
  }

  function applyPreset(p) {
    app.sim.patient = { ca: p.ca, timp: p.timp, lrg: p.lrg, preset: p.id };
    syncSliders();
    refreshPatient(true);
  }

  const SLIDERS = [
    { id: "ca", label: "CA19-9", unit: "U/mL", min: 0, max: 800, step: 1, dec: 1 },
    { id: "timp", label: "TIMP1", unit: "ng/mL", min: 30, max: 160, step: 0.5, dec: 1 },
    { id: "lrg", label: "LRG1", unit: "µg/mL", min: 15, max: 120, step: 0.5, dec: 1 },
  ];
  function buildSliders() {
    const el = $("#sliders");
    el.innerHTML = "";
    SLIDERS.forEach(function (s) {
      const w = document.createElement("div");
      w.className = "slider";
      w.innerHTML =
        '<div class="row"><span>' + s.label + "</span><span><b id='v-" + s.id + "'>—</b> <span style='color:#8a8880'>" + s.unit + "</span></span></div>" +
        "<input type='range' id='s-" + s.id + "' min='" + s.min + "' max='" + s.max + "' step='" + s.step + "'>";
      el.appendChild(w);
      const inp = w.querySelector("input");
      inp.addEventListener("input", function () {
        app.sim.patient[s.id] = parseFloat(inp.value);
        app.sim.patient.preset = null;
        document.querySelectorAll(".preset").forEach(function (p) { p.classList.remove("on"); });
        refreshPatient(true);
        syncLabels();
      });
    });
  }
  function syncSliders() {
    SLIDERS.forEach(function (s) { $("#s-" + s.id).value = app.sim.patient[s.id]; });
    syncLabels();
  }
  function syncLabels() {
    SLIDERS.forEach(function (s) {
      $("#v-" + s.id).textContent = fmt(app.sim.patient[s.id], s.dec);
    });
  }

  function buildChannels() {
    const el = $("#channels");
    el.innerHTML = "";
    const info = [
      { k: "CA19-9", color: "#eb6834", sub: "seyreltmesiz" },
      { k: "TIMP1", color: "#2a78d6", sub: "1:400" },
      { k: "LRG1", color: "#7a5fb5", sub: "1:320.000" },
    ];
    info.forEach(function (i) {
      const d = document.createElement("div");
      d.className = "chan";
      d.id = "ch-" + i.k.replace(/[^a-z0-9]/gi, "");
      d.innerHTML =
        '<span class="dot" style="background:' + i.color + '"></span>' +
        '<span class="nm">' + i.k + "<small>" + i.sub + "</small></span>" +
        '<span class="val" id="val-' + i.k.replace(/[^a-z0-9]/gi, "") + '">—<small>—</small></span>';
      el.appendChild(d);
    });
  }

  function wireInfo() {
    const dlg = $("#info");
    $("#btn-info").addEventListener("click", function () { dlg.showModal(); });
    $("#info-close").addEventListener("click", function () { dlg.close(); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  }

  /* ---------------- hasta / ölçüm ---------------- */
  UI.refreshPatient = function (anim) {
    const p = app.sim.patient;
    app.sim.result = M.evaluate(p.ca, p.timp, p.lrg, { noise: app.sim.noise, seed: app.sim.seed });
    const r = app.sim.result;
    Object.keys(r.meas).forEach(function (k) {
      const id = k.replace(/[^a-z0-9]/gi, "");
      const m = r.meas[k];
      const row = document.getElementById("ch-" + id);
      const val = document.getElementById("val-" + id);
      const unit = M.UNIT[k];
      const shown = k === "CA19-9" && m.over ? "> 500" : fmt(m.plasma, k === "CA19-9" ? 1 : 1);
      val.innerHTML = shown + " <span style='font-weight:400;color:#8a8880;font-size:10px'>" + unit + "</span>" +
        "<small>" + fmt(m.current, 0) + " nA</small>";
      row.classList.toggle("off", false);
    });
    drawGauge();
    updateRisk(r.risk);
    buildChartData();
    updateScreen(true);
  };

  const refreshPatient = function (a) { UI.refreshPatient(a); };
  UI.syncSliders = syncSliders;

  function updateRisk(r) {
    const badge = $("#cat-badge");
    const c = CAT[r.category];
    badge.className = "badge " + c.cls;
    badge.textContent = c.sym + " " + (r.category === "KIRMIZI" ? "Kırmızı · yüksek risk" : r.category === "SARI" ? "Sarı · sınırda" : "Yeşil · düşük risk");
    $("#model-note").textContent = r.model;
    $("#advice").textContent = r.advice;
    const w = $("#warnings");
    w.innerHTML = "";
    r.warnings.forEach(function (t) {
      const d = document.createElement("div");
      d.className = "warn";
      d.textContent = t;
      w.appendChild(d);
    });
    gaugeTarget = r.score;
  }

  /* ---------------- risk göstergesi ---------------- */
  let gaugeTarget = 0;
  function drawGauge() {
    const cv = $("#gauge");
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.675, R = W * 0.327;
    const a0 = Math.PI * 0.86, a1 = Math.PI * 2.14;
    function ang(p) { return a0 + (a1 - a0) * (p / 100); }
    ctx.lineCap = "round";
    // iz
    ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.strokeStyle = "#e6e4dc"; ctx.lineWidth = 34; ctx.stroke();
    // bölgeler
    const zones = [[0, 95, "#0ca30c"], [95, 99, "#fab219"], [99, 100, "#d03b3b"]];
    zones.forEach(function (z) {
      ctx.beginPath(); ctx.arc(cx, cy, R, ang(z[0]) + 0.004, ang(z[1]) - 0.004);
      ctx.strokeStyle = z[2]; ctx.lineWidth = 20; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.globalAlpha = 1;
    });
    // tikler
    [0, 25, 50, 75, 95, 99].forEach(function (v) {
      const a = ang(v);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (R + 20), cy + Math.sin(a) * (R + 20));
      ctx.lineTo(cx + Math.cos(a) * (R + 28), cy + Math.sin(a) * (R + 28));
      ctx.strokeStyle = "#a8a59c"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#8a8880"; ctx.font = "600 17px 'Segoe UI'"; ctx.textAlign = "center";
      ctx.fillText(String(v), cx + Math.cos(a) * (R + 43), cy + Math.sin(a) * (R + 43) + 6);
    });
    // iğne
    const a = ang(gaugeShown);
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(a) * 14, cy - Math.sin(a) * 14);
    ctx.lineTo(cx + Math.cos(a) * (R - 12), cy + Math.sin(a) * (R - 12));
    ctx.strokeStyle = "#101215"; ctx.lineWidth = 10; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.fillStyle = "#101215"; ctx.fill();
    // skor değeri — iğnenin altında, göstergeyle çakışmaz
    const val = fmt(isFinite(gaugeShown) ? gaugeShown : 0, 1);
    const bx = 10;
    ctx.textAlign = "left";
    ctx.font = "800 58px 'Segoe UI'";
    const vw = ctx.measureText(val).width;
    ctx.font = "600 22px 'Segoe UI'";
    const uw = ctx.measureText("/ 100").width;
    const xs = cx - (vw + bx + uw) / 2;
    ctx.font = "800 58px 'Segoe UI'"; ctx.fillStyle = "#101215";
    ctx.fillText(val, xs, H - 26);
    ctx.font = "600 22px 'Segoe UI'"; ctx.fillStyle = "#8a8880";
    ctx.fillText("/ 100", xs + vw + bx, H - 26);
  }
  UI.tick = function (dt) {
    const target = isFinite(gaugeTarget) ? gaugeTarget : 0;
    if (Math.abs(target - gaugeShown) > 0.05) {
      gaugeShown += (target - gaugeShown) * Math.min(1, dt * 6);
      drawGauge();
    }
    const r = app.sim.result && app.sim.result.risk;
    if (r) {
      $("#cat-badge").className = "badge " + CAT[r.category].cls;
    }
  };
  UI.setGaugeInstant = function () { gaugeShown = gaugeTarget; drawGauge(); };

  /* ---------------- amperometri grafiği ---------------- */
  const CHINFO = [
    { k: "CA19-9", color: "#eb6834" }, { k: "TIMP1", color: "#2a78d6" }, { k: "LRG1", color: "#7a5fb5" },
  ];
  function buildChartData() {
    chartData = [];
    const seed = app.sim.seed;
    CHINFO.forEach(function (ci, idx) {
      const base = app.sim.result.meas[ci.k].current;
      const rnd = M.rngFactory(seed * 13 + idx * 97);
      const pts = [];
      for (let i = 0; i < 70; i++) {
        const u = i / 69;
        const rise = 1 - Math.exp(-u * 5.5);
        const v = 60 + (base - 60) * rise * (1 + (rnd() - 0.5) * 0.06) + (rnd() - 0.5) * 9;
        pts.push(v);
      }
      chartData.push({ name: ci.k, color: ci.color, pts: pts, current: base });
    });
  }
  UI.buildChartData = buildChartData;

  let lastReveal = 1;
  function drawChart(reveal) {
    lastReveal = reveal;
    const cv = $("#chart");
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height, S = W / 752;
    ctx.clearRect(0, 0, W, H);
    const L = 44 * S, R = 8 * S, T = 12 * S, B = 26 * S;
    const yMax = 1800;
    // ızgara
    ctx.font = "500 " + Math.round(16 * S) + "px 'Segoe UI'"; ctx.fillStyle = "#a3a19a"; ctx.textAlign = "right";
    for (let v = 0; v <= 1600; v += 400) {
      const y = T + (H - T - B) * (1 - v / yMax);
      ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - R, y);
      ctx.strokeStyle = "rgba(11,11,11,.07)"; ctx.lineWidth = Math.max(1, S); ctx.stroke();
      ctx.fillText(String(v), L - 7 * S, y + 5 * S);
    }
    // kanal ayraçları
    for (let i = 1; i < 3; i++) {
      const x = L + (W - L - R) * (i / 3);
      ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, H - B);
      ctx.setLineDash([4 * S, 5 * S]); ctx.strokeStyle = "rgba(11,11,11,.16)"; ctx.stroke(); ctx.setLineDash([]);
    }
    if (!chartData) return;
    const total = G01(reveal) * 3;
    for (let c = 0; c < 3; c++) {
      const ch = chartData[c];
      const shown = Math.max(0, Math.min(1, total - c));
      if (shown <= 0) continue;
      const n = Math.floor(shown * (ch.pts.length - 1));
      const x0 = L + (W - L - R) * (c / 3);
      const x1 = L + (W - L - R) * ((c + 1) / 3);
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const x = x0 + (x1 - x0) * (i / (ch.pts.length - 1));
        const y = T + (H - T - B) * (1 - ch.pts[i] / yMax);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = ch.color; ctx.lineWidth = 3.4 * S; ctx.lineJoin = "round"; ctx.stroke();
      const lastX = x0 + (x1 - x0) * (n / (ch.pts.length - 1));
      const lastY = T + (H - T - B) * (1 - ch.pts[n] / yMax);
      ctx.beginPath(); ctx.arc(lastX, lastY, 5 * S, 0, Math.PI * 2); ctx.fillStyle = ch.color; ctx.fill();
    }
    ctx.fillStyle = "#a3a19a"; ctx.font = "500 " + Math.round(15 * S) + "px 'Segoe UI'"; ctx.textAlign = "center";
    ctx.fillText("kanal 1 → 2 → 3 · zaman (hızlandırılmış)", (L + W - R) / 2, H - 6 * S);
  }
  function G01(x) { return Math.max(0, Math.min(1, x)); }

  /* grafiğe tıkla: büyüt / küçült */
  let chartZoomed = false;
  function toggleChartZoom() {
    chartZoomed = !chartZoomed;
    const card = $("#chart-card"), cv = $("#chart");
    card.classList.toggle("zoom", chartZoomed);
    cv.width = chartZoomed ? 2256 : 752;
    cv.height = chartZoomed ? 792 : 264;
    $("#zoom-hint").textContent = chartZoomed ? "küçült ⤢" : "büyüt ⤢";
    drawChart(lastReveal);
  }
  function wireChartZoom() {
    $("#chart-card").addEventListener("click", toggleChartZoom);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && chartZoomed) toggleChartZoom();
    });
  }

  /* ---------------- adım / anlatım ---------------- */
  function setStep(i) {
    const s = TP.STEPS[i];
    $("#cap-tag").textContent = s.tag;
    $("#cap-title").textContent = s.title;
    $("#cap-desc").textContent = s.desc;
    document.querySelectorAll(".step").forEach(function (el, idx) {
      el.classList.toggle("active", idx + 1 === i);
      el.classList.toggle("done", idx + 1 < i);
    });
    $("#chart-card").classList.toggle("show", i >= 6);
    if (i < 6 && chartZoomed) toggleChartZoom();
    $("#measure-state").textContent = i < 6 ? (i === 0 ? "bekliyor" : "hazırlanıyor") : "ölçüldü";
  }
  UI.setStep = setStep;

  UI.measureProgress = function (t, sim) {
    drawChart(t);
  };
  UI.resultProgress = function (t, sim) {
    drawChart(1);
    if (t > 0.55) {
      gaugeTarget = sim.result.risk.score;
      const badge = $("#cat-badge");
      const c = CAT[sim.result.risk.category];
      badge.className = "badge " + c.cls;
    }
  };
  UI.contactProgress = function (p) {
    if (p > 0 && p < 1) UI.toast("pogo kontak testi… " + "%" + Math.round(p * 100));
    else if (p >= 1) UI.toast("Kartuş algılandı · 5/5 kontak");
  };

  let toastTimer = null;
  UI.toast = function (msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 1400);
  };

  /* ---------------- okuyucu ekranı ---------------- */
  UI.screen = function (mode, info) {
    updateScreen(false, mode, info);
  };
  function updateScreen(force, mode, info) {
    const now = performance.now();
    if (!force && now - lastScreen < 110) return;
    lastScreen = now;
    if (mode) app.screenMode = mode;
    const m = app.screenMode || "idle";
    const sim = app.sim;
    const key = m + "|" + Math.round((info && info.t || 0) * 8);
    if (!force && key === screenKey) return;
    screenKey = key;
    drawScreen(m, sim, info || {});
    scr.tex.needsUpdate = true;
  }

  function drawScreen(mode, sim, info) {
    const ctx = scr.ctx, W = 512, H = 683;
    const blue = "#2a78d6";
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f7f6f1"; ctx.fillRect(0, 0, W, H);
    // üst bar
    ctx.fillStyle = "#101215"; ctx.fillRect(0, 0, W, 64);
    ctx.fillStyle = "#fff"; ctx.font = "800 26px 'Segoe UI'"; ctx.textAlign = "left";
    ctx.fillText("TriPan", 24, 41);
    ctx.fillStyle = "#8fbcf0"; ctx.font = "600 15px 'Segoe UI'"; ctx.textAlign = "right";
    ctx.fillText("3B SİM · SANAL", W - 22, 39);

    const r = sim.result;
    if (mode === "measure" || mode === "result") {
      if (!r) return;
    }
    ctx.textAlign = "center";

    if (mode === "idle") {
      ctx.fillStyle = "#101215"; ctx.font = "800 40px 'Segoe UI'";
      ctx.fillText("Hazır", W / 2, 210);
      ctx.fillStyle = "#52514e"; ctx.font = "500 22px 'Segoe UI'";
      ctx.fillText("Kartuşu yerleştirin", W / 2, 250);
      drawChip(ctx, W / 2 - 90, 300, 180, 54, "#e9e7df", "#52514e", "Kartuş yuvası boş");
      ctx.strokeStyle = "#e2e0d8"; ctx.lineWidth = 3;
      ctx.strokeRect(70, 420, W - 140, 130);
      ctx.fillStyle = "#a3a19a"; ctx.font = "500 19px 'Segoe UI'";
      ctx.fillText("pogo · 5 kontak", W / 2, 470);
      ctx.fillText("mıknatıs · 3 × Ø3×2 mm", W / 2, 502);
    } else if (mode === "sample") {
      ctx.fillStyle = "#101215"; ctx.font = "800 30px 'Segoe UI'";
      ctx.fillText("Örnek hazırlanıyor", W / 2, 140);
      const rows = [["CA19-9", "seyreltmesiz"], ["TIMP1", "1:400"], ["LRG1", "1:320.000"]];
      rows.forEach(function (row, i) {
        const y = 210 + i * 92;
        ctx.fillStyle = "#fff"; roundRect(ctx, 46, y, W - 92, 74, 14); ctx.fill();
        ctx.fillStyle = "#101215"; ctx.font = "700 24px 'Segoe UI'"; ctx.textAlign = "left";
        ctx.fillText(row[0], 68, y + 46);
        ctx.fillStyle = "#52514e"; ctx.font = "600 20px 'Segoe UI'"; ctx.textAlign = "right";
        ctx.fillText(row[1], W - 70, y + 46);
      });
      progressBar(ctx, 46, 520, W - 92, 8, info.t || 0);
    } else if (mode === "incubate") {
      ctx.fillStyle = "#101215"; ctx.font = "800 30px 'Segoe UI'";
      ctx.fillText("İnkübasyon", W / 2, 150);
      ctx.fillStyle = "#52514e"; ctx.font = "500 20px 'Segoe UI'";
      ctx.fillText("antikor kaplı manyetik boncuklar", W / 2, 190);
      ctx.fillText("sandviç yapı kuruluyor", W / 2, 220);
      ctx.font = "800 64px 'Segoe UI'"; ctx.fillStyle = blue;
      ctx.fillText("≈ 60 dk", W / 2, 360);
      ctx.fillStyle = "#8a8880"; ctx.font = "500 19px 'Segoe UI'";
      ctx.fillText("hızlandırılmış gösterim", W / 2, 396);
      progressBar(ctx, 46, 470, W - 92, 8, info.t || 0);
    } else if (mode === "wash") {
      ctx.fillStyle = "#101215"; ctx.font = "800 30px 'Segoe UI'";
      ctx.fillText("Yıkama", W / 2, 170);
      ctx.fillStyle = "#52514e"; ctx.font = "500 21px 'Segoe UI'";
      ctx.fillText("bağlanmayan antikorlar", W / 2, 225);
      ctx.fillText("ve belirteçler uzaklaştırılıyor", W / 2, 257);
      progressBar(ctx, 46, 340, W - 92, 8, info.t || 0);
    } else if (mode === "magnet") {
      ctx.fillStyle = "#101215"; ctx.font = "800 30px 'Segoe UI'";
      ctx.fillText("Mıknatıs aktif", W / 2, 160);
      ctx.fillStyle = blue; ctx.font = "700 22px 'Segoe UI'";
      ctx.fillText("boncuklar elektrot yüzeyinde", W / 2, 205);
      for (let i = 0; i < 3; i++) {
        const y = 290 + i * 92;
        ctx.fillStyle = "#fff"; roundRect(ctx, 66, y, W - 132, 70, 14); ctx.fill();
        ctx.fillStyle = "#101215"; ctx.font = "700 21px 'Segoe UI'"; ctx.textAlign = "left";
        ctx.fillText(["WE1", "WE2", "WE3"][i], 88, y + 44);
        ctx.textAlign = "right"; ctx.fillStyle = "#52514e"; ctx.font = "600 19px 'Segoe UI'";
        ctx.fillText("Ø3 × 2 mm N52", W - 90, y + 44);
      }
    } else if (mode === "contact") {
      ctx.fillStyle = "#101215"; ctx.font = "800 30px 'Segoe UI'";
      ctx.fillText("Kartuş algılandı", W / 2, 170);
      ctx.fillStyle = "#52514e"; ctx.font = "500 21px 'Segoe UI'";
      ctx.fillText("pogo kontak testi", W / 2, 216);
      const p = Math.min(1, (info.t || 0) * 1.6);
      ctx.strokeStyle = "#e2e0d8"; ctx.lineWidth = 18;
      ctx.beginPath(); ctx.arc(W / 2, 340, 74, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = blue;
      ctx.beginPath(); ctx.arc(W / 2, 340, 74, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
      ctx.fillStyle = "#101215"; ctx.font = "800 26px 'Segoe UI'";
      ctx.fillText("%" + Math.round(p * 100), W / 2, 350);
      ctx.fillStyle = "#52514e"; ctx.font = "600 19px 'Segoe UI'";
      ctx.fillText("5 / 5 kontak", W / 2, 470);
    } else if (mode === "ready") {
      ctx.fillStyle = "#0ca30c"; ctx.font = "800 40px 'Segoe UI'";
      ctx.fillText("Hazır", W / 2, 220);
      ctx.fillStyle = "#101215"; ctx.font = "600 23px 'Segoe UI'";
      ctx.fillText("Ölçüm başlatılabilir", W / 2, 262);
      ctx.fillStyle = blue; roundRect(ctx, W / 2 - 110, 320, 220, 70, 35); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "700 24px 'Segoe UI'";
      ctx.fillText("ÖLÇÜMÜ BAŞLAT", W / 2, 365);
      ctx.fillStyle = "#8a8880"; ctx.font = "500 18px 'Segoe UI'";
      ctx.fillText("H₂O₂ · sabit voltaj · amperometri", W / 2, 440);
    } else if (mode === "measure") {
      if (!r) return;
      ctx.fillStyle = "#101215"; ctx.font = "800 26px 'Segoe UI'";
      ctx.fillText("Ölçüm", W / 2, 108);
      const ks = ["CA19-9", "TIMP1", "LRG1"];
      ks.forEach(function (k, i) {
        const y = 145 + i * 128;
        ctx.fillStyle = "#fff"; roundRect(ctx, 34, y, W - 68, 108, 16); ctx.fill();
        ctx.fillStyle = ["#eb6834", "#2a78d6", "#7a5fb5"][i];
        roundRect(ctx, 34, y, 8, 108, 4); ctx.fill();
        ctx.textAlign = "left"; ctx.fillStyle = "#52514e"; ctx.font = "600 19px 'Segoe UI'";
        ctx.fillText(k, 58, y + 32);
        ctx.fillStyle = "#101215"; ctx.font = "800 38px 'Segoe UI'";
        ctx.fillText(Math.round(r.meas[k].current) + " nA", 58, y + 80);
        ctx.textAlign = "right"; ctx.fillStyle = "#8a8880"; ctx.font = "600 16px 'Segoe UI'";
        ctx.fillText(k === "CA19-9" && r.meas[k].over ? "> 500" : fmt(r.meas[k].plasma, 1) + " " + M.UNIT[k], W - 54, y + 40);
      });
      ctx.fillStyle = "#8a8880"; ctx.font = "500 16px 'Segoe UI'"; ctx.textAlign = "center";
      ctx.fillText("değerler temsilîdir · sanal ölçüm", W / 2, H - 28);
    } else if (mode === "result") {
      if (!r) return;
      const cat = r.risk.category;
      const hex = cat === "KIRMIZI" ? "#d03b3b" : cat === "SARI" ? "#fab219" : "#0ca30c";
      ctx.fillStyle = hex; roundRect(ctx, 30, 96, W - 60, 130, 18); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "700 20px 'Segoe UI'";
      ctx.fillText(cat === "KIRMIZI" ? "■ YÜKSEK RİSK" : cat === "SARI" ? "▲ SINIRDA" : "● DÜŞÜK RİSK", W / 2, 132);
      ctx.font = "800 66px 'Segoe UI'";
      ctx.fillText(fmt(r.risk.score, 1), W / 2, 205);
      ctx.font = "600 18px 'Segoe UI'";
      ctx.fillText("risk skoru / 100", W / 2, 238);
      ctx.textAlign = "left"; ctx.fillStyle = "#101215"; ctx.font = "600 19px 'Segoe UI'";
      wrap(ctx, r.risk.advice, 44, 286, W - 88, 27);
      ctx.fillStyle = "#8a8880"; ctx.font = "500 16px 'Segoe UI'";
      ctx.fillText(r.risk.model, 44, 500);
      ctx.fillStyle = "#a3a19a"; ctx.font = "500 14px 'Segoe UI'";
      ctx.fillText("sanal simülasyon · klinik karar yerine geçmez", 44, 620);
    }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawChip(ctx, x, y, w, h, bg, fg, text) {
    ctx.fillStyle = bg; roundRect(ctx, x, y, w, h, 12); ctx.fill();
    ctx.fillStyle = fg; ctx.font = "600 18px 'Segoe UI'"; ctx.textAlign = "center";
    ctx.fillText(text, x + w / 2, y + h / 2 + 6);
  }
  function progressBar(ctx, x, y, w, h, t) {
    ctx.fillStyle = "#e6e4dc"; roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = "#2a78d6"; roundRect(ctx, x, y, Math.max(2, w * Math.max(0, Math.min(1, t))), h, h / 2); ctx.fill();
  }
  function wrap(ctx, text, x, y, maxW, lh) {
    const words = text.split(" "), line = [];
    let yy = y;
    for (let i = 0; i < words.length; i++) {
      const test = line.concat(words[i]).join(" ");
      if (ctx.measureText(test).width > maxW && line.length) {
        ctx.fillText(line.join(" "), x, yy); line.length = 0; yy += lh;
      }
      line.push(words[i]);
    }
    if (line.length) ctx.fillText(line.join(" "), x, yy);
  }

  UI.refresh = function () { refreshPatient(false); };
})(window.TP);
