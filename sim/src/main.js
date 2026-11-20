/* Uygulama döngüsü, kamera geçişleri, oynatma kontrolü. */
(function () {
  const TP = window.TP;
  const canvas = document.getElementById("scene");

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const O = TP.buildWorld(renderer);
  const scene = O.scene, camera = O.camera, controls = O.controls;

  const sim = {
    step: 0, t: 0, playing: false, tour: false,
    patient: { ca: 12, timp: 78, lrg: 44, preset: "saglikli" },
    result: null, noise: true, seed: 42, screenMode: "idle",
  };

  const app = {
    O: O, sim: sim, renderer: renderer,
    goStep: goStep, screenMode: function (m) { sim.screenMode = m; },
  };
  TP.app = app;

  TP.UI.init(app);

  let camTween = null;
  function setCameraGoal(step) {
    const c = TP.STEPS[step].cam;
    camTween = {
      p0: camera.position.clone(),
      p1: new THREE.Vector3(c.pos[0], c.pos[1], c.pos[2]),
      t0: controls.target.clone(),
      t1: new THREE.Vector3(c.target[0], c.target[1], c.target[2]),
      t: 0, dur: 1.5,
    };
  }
  function goStep(i, user) {
    i = Math.max(0, Math.min(TP.STEPS.length - 1, i));
    sim.step = i; sim.t = 0;
    const s = TP.STEPS[i];
    s.enter(O, sim);
    TP.UI.setStep(i);
    O.cart.labels.forEach(function (l) { l.visible = (i === 1 || i === 4); });
    TP.UI.setGaugeInstant();
    setCameraGoal(i);
    if (user) { sim.playing = false; syncPlay(); }
  }

  controls.addEventListener("start", function () { camTween = null; });

  function syncPlay() {
    const b = document.getElementById("play");
    b.textContent = sim.playing ? "❚❚" : "▶";
    b.title = sim.playing ? "Durdur" : "Oynat";
  }
  document.getElementById("play").addEventListener("click", function () {
    sim.playing = !sim.playing;
    if (sim.playing && sim.step === 0 && sim.t === 0) { /* baştan */ }
    syncPlay();
  });
  document.getElementById("prev").addEventListener("click", function () { goStep(sim.step - 1, true); });
  document.getElementById("next").addEventListener("click", function () { goStep(sim.step + 1, true); });
  document.getElementById("cam").addEventListener("click", function () { setCameraGoal(sim.step); });
  document.getElementById("tour").addEventListener("click", function (e) {
    sim.tour = !sim.tour;
    e.currentTarget.classList.toggle("on", sim.tour);
    if (sim.tour) {
      if (sim.step === TP.STEPS.length - 1) goStep(0, false);
      sim.playing = true; syncPlay();
    }
  });

  window.addEventListener("keydown", function (e) {
    if (e.code === "Space") { e.preventDefault(); sim.playing = !sim.playing; syncPlay(); }
    if (e.code === "ArrowRight") goStep(sim.step + 1, true);
    if (e.code === "ArrowLeft") goStep(sim.step - 1, true);
  });

  window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  let time = 0;

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;

    const s = TP.STEPS[sim.step];
    if (sim.playing) {
      sim.t += dt / s.dur;
      if (sim.t >= 1) {
        if (sim.step < TP.STEPS.length - 1) goStep(sim.step + 1, false);
        else if (sim.tour) goStep(0, false);
        else { sim.playing = false; sim.t = 1; syncPlay(); }
      }
    }

    s.update(O, sim, Math.min(1, sim.t), time);

    if (camTween) {
      camTween.t += dt;
      const u = TP.G.easeInOut(Math.min(1, camTween.t / camTween.dur));
      camera.position.lerpVectors(camTween.p0, camTween.p1, u);
      controls.target.lerpVectors(camTween.t0, camTween.t1, u);
      if (u >= 1) camTween = null;
    }
    controls.update();
    renderer.render(scene, camera);
    TP.UI.tick(dt);

    // yükleme ekranı
    if (!frame.done) {
      frame.done = true;
      const l = document.getElementById("loading");
      l.classList.add("hide");
      setTimeout(function () { l.style.display = "none"; }, 600);
    }
  }

  TP.UI.setGaugeInstant();
  goStep(0, false);

  /* Test/sunum kısayolu: ?step=7&t=1&p=lewis&snap=1 */
  const q = new URLSearchParams(location.search);
  if (q.has("step")) {
    const i = Math.max(0, Math.min(TP.STEPS.length - 1, parseInt(q.get("step"), 10) || 0));
    const pid = q.get("p");
    if (pid) {
      const p = TP.Model.PRESETS.filter(function (x) { return x.id === pid; })[0];
      if (p) {
        sim.patient = { ca: p.ca, timp: p.timp, lrg: p.lrg, preset: p.id };
        TP.UI.syncSliders();
        TP.UI.refreshPatient(false);
      }
    }
    goStep(i, false);
    sim.t = q.has("t") ? Math.max(0, Math.min(1, parseFloat(q.get("t")))) : 1;
    if (q.get("snap") === "1") {
      const c = TP.STEPS[i].cam;
      camera.position.set(c.pos[0], c.pos[1], c.pos[2]);
      controls.target.set(c.target[0], c.target[1], c.target[2]);
      camTween = null;
    }
  }
  frame();

  // ilk karede sayaç sıfırlansın
  if (!q.has("step")) setTimeout(function () { TP.UI.setStep(0); }, 30);
})();
