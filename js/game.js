// Hauptspiel: Steuerung, Waffen aufnehmen, Zielen, Schießen, HUD.
(function () {
  'use strict';
  const SR = window.SR;
  const V3 = THREE.Vector3;

  const EYE = 1.65;
  const EYE_PRONE = 0.36; // Augenhöhe im Liegen
  const PRONE_TIME = 0.55; // Sekunden zum Hinlegen/Aufstehen
  const BASE_FOV = 75;
  const VM_FOV = 55;
  const BASE_SENS = 0.0022;
  const REACH = 2.7;
  // Plätze auf dem Tisch, gleichmäßig verteilt
  const SLOT_X = SR.WEAPON_DEFS.map((d, i, all) => (i - (all.length - 1) / 2) * 0.5);

  const $ = (id) => document.getElementById(id);
  const ui = {
    overlay: $('overlay'),
    start: $('startBtn'),
    startLabel: $('startLabel'),
    sens: $('sens'),
    sensOut: $('sensOut'),
    crosshair: $('crosshair'),
    hitmarker: $('hitmarker'),
    pattern: $('pattern'),
    scope: $('scope'),
    hitText: $('hitText'),
    prompt: $('prompt'),
    sDown: $('statDown'),
    sShots: $('statShots'),
    sHits: $('statHits'),
    sHeads: $('statHeads'),
    sTime: $('statTime'),
    sBest: $('statBest'),
    sStance: $('statStance'),
    sRespawn: $('statRespawn'),
    respawnRow: $('respawnRow'),
    wName: $('wName'),
    wKind: $('wKind'),
    wRpm: $('wRpm'),
    wBar: $('wBar'),
    wAmmo: $('wAmmo'),
    weapon: $('weaponCard'),
    banner: $('banner'),
    bannerText: $('bannerText'),
    bannerSub: $('bannerSub'),
    toast: $('toast'),
  };

  // ---------- Renderer & Szenen ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;
  $('stage').appendChild(renderer.domElement);
  SR.maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.05, 2000);
  camera.rotation.order = 'YXZ';
  const world = SR.buildWorld(scene, renderer);

  // Waffe in der Hand wird in einer eigenen Szene gezeichnet, damit sie nie in Wände/Tisch ragt.
  const vmScene = new THREE.Scene();
  vmScene.environment = world.envMap;
  const vmCamera = new THREE.PerspectiveCamera(VM_FOV, camera.aspect, 0.005, 10);
  vmScene.add(new THREE.HemisphereLight(0xcfe3ff, 0x5d6b3c, 0.5));
  const vmSun = new THREE.DirectionalLight(0xfff0d8, 1.1);
  vmScene.add(vmSun);
  const vmFlashLight = new THREE.PointLight(0xffb060, 0, 1.2, 2);
  vmScene.add(vmFlashLight);
  const weaponRoot = new THREE.Group();
  vmScene.add(weaponRoot);

  const muzzleLight = new THREE.PointLight(0xffb060, 0, 9, 2);
  scene.add(muzzleLight);

  const fx = SR.createEffects(scene, vmScene);
  const targets = SR.createTargets(scene);

  const shootables = world.shootables.slice();
  targets.forEach((t) => shootables.push(...t.parts));

  // ---------- Waffen auf dem Tisch ----------
  const table = world.table;
  const highlightMat = new THREE.LineBasicMaterial({ color: 0xe6ae45, transparent: true, opacity: 0.9 });
  const weapons = SR.WEAPON_DEFS.map((def, i) => {
    const t = def.build();
    t.group.rotation.set(0, 0, Math.PI / 2); // auf die Seite gelegt
    t.group.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(t.group);
    t.group.position.set(SLOT_X[i] - (bb.min.x + bb.max.x) / 2, table.topY - bb.min.y, table.z - (bb.min.z + bb.max.z) / 2);
    t.group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(t.group);
    t.group.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(t.group);
    const size = box.getSize(new V3());
    const center = box.getCenter(new V3());
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(size.x, 0.12) + 0.06, size.y + 0.12, size.z + 0.06),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.copy(center);
    hitbox.userData.slot = i;
    scene.add(hitbox);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(hitbox.geometry), highlightMat);
    outline.position.copy(center);
    outline.visible = false;
    scene.add(outline);

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.09),
      new THREE.MeshStandardMaterial({ map: SR.tex.label(def.short, { w: 256, h: 64 }), roughness: 0.9 })
    );
    label.position.set(SLOT_X[i], table.apronY, table.frontZ - 0.012);
    scene.add(label);

    const v = def.build();
    v.group.visible = false;
    weaponRoot.add(v.group);
    const flash = SR.makeMuzzleFlash(def.pellets ? 0.17 : def.id === 'kr86' || def.id === 'g36' ? 0.13 : 0.085);
    v.muzzle.add(flash);

    return { def, index: i, table: t, view: v, hitbox, outline, flash, onTable: true, kick: 0, boltT: 1, ejected: true, shots: 0 };
  });

  // ---------- Zustand ----------
  const state = {
    started: false,
    paused: true,
    locked: false,
    lockWorked: false,
    fallback: false,
    yaw: 0,
    pitch: -0.32,
    recoilPitch: 0,
    recoilYaw: 0,
    pos: new V3(0, world.padTop + EYE, 0.25),
    held: null,
    looking: null,
    trigger: false,
    aiming: false,
    ads: 0,
    equipT: 1,
    nextShot: 0,
    lastShot: -10,
    bloom: 0,
    swayX: 0,
    swayY: 0,
    bobT: 0,
    moving: false,
    prone: false,
    stance: 0,
    flashT: 0,
    mouseX: 0.5,
    keys: {},
    sens: 1,
  };
  const stats = { shots: 0, hits: 0, heads: 0, down: 0 };
  let round = { start: null, done: false, resetAt: 0 };
  let clock = 0;
  let best = null;
  try {
    const b = parseFloat(localStorage.getItem('sr-best'));
    if (b > 0) best = b;
    const s = parseFloat(localStorage.getItem('sr-sens'));
    if (s > 0) state.sens = s;
  } catch (e) {
    /* Speicher nicht verfügbar – egal */
  }

  // ---------- Hilfsfunktionen ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (t) => t * t * (3 - 2 * t);
  const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
  const isActive = () => state.started && !state.paused;

  function fmtTime(s) {
    if (s == null) return '–';
    const m = Math.floor(s / 60);
    const r = s - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1).replace('.', ',');
  }

  let toastTimer = 0;
  function toast(msg, secs) {
    ui.toast.textContent = msg;
    ui.toast.hidden = false;
    toastTimer = secs || 4;
  }

  function restartAnim(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function showHit(text, kind) {
    ui.hitText.textContent = text;
    ui.hitText.dataset.kind = kind;
    restartAnim(ui.hitText, 'show');
    ui.hitmarker.dataset.kind = kind;
    restartAnim(ui.hitmarker, 'show');
  }

  // ---------- Hinlegen ----------
  // Im Liegen streut die Waffe weniger und wackelt weniger.
  function proneSteady() {
    return lerp(1, 0.5, smooth(state.stance));
  }

  function toggleProne() {
    state.prone = !state.prone;
    SR.sound.prone(state.prone);
  }

  // ---------- Waffe nehmen / zurücklegen ----------
  function placeOnTable(w) {
    w.onTable = true;
    w.table.group.visible = true;
    w.view.group.visible = false;
    w.flash.visible = false;
  }

  function equip(w) {
    if (!w || state.held === w) return;
    if (state.held) placeOnTable(state.held);
    w.onTable = false;
    w.table.group.visible = false;
    w.outline.visible = false;
    w.view.group.visible = true;
    w.kick = 0;
    w.boltT = 1;
    w.ejected = true;
    state.held = w;
    state.equipT = 0;
    state.ads = 0;
    state.bloom = 0;
    state.nextShot = clock + 0.35;
    updateWeaponCard();
    SR.sound.pickup();
  }

  function putBack() {
    if (!state.held) return;
    placeOnTable(state.held);
    state.held = null;
    state.ads = 0;
    updateWeaponCard();
    SR.sound.pickup();
  }

  const ray = new THREE.Raycaster();
  const tmpDir = new V3();
  const aimDir = new V3();
  const tmpRight = new V3();
  const tmpUp = new V3();
  const tmpV = new V3();

  function lookAtWeapon() {
    if (state.prone || state.stance > 0.05) return null; // im Liegen kommt man nicht an den Tisch
    camera.getWorldDirection(tmpDir);
    ray.set(camera.position, tmpDir);
    ray.near = 0;
    ray.far = REACH;
    const boxes = weapons.filter((w) => w.onTable).map((w) => w.hitbox);
    const hit = ray.intersectObjects(boxes, false)[0];
    return hit ? weapons[hit.object.userData.slot] : null;
  }

  // ---------- Schießen ----------
  function fire(w) {
    const d = w.def;
    stats.shots++;
    if (round.start == null) round.start = clock;
    state.lastShot = clock;

    const e = smooth(state.ads);
    const steady = proneSteady();
    const spread = (lerp(d.hipSpread, d.adsSpread, e) + state.bloom + (state.moving ? 0.012 * (1 - e) : 0)) * steady;
    camera.updateMatrixWorld();
    camera.getWorldDirection(aimDir);
    tmpRight.setFromMatrixColumn(camera.matrixWorld, 0);
    tmpUp.setFromMatrixColumn(camera.matrixWorld, 1);
    jitter(aimDir, spread); // Zielfehler

    // Eine Kugel – oder bei Schrotflinten eine ganze Garbe Schrotkugeln
    const pellets = d.pellets || 1;
    const shot = { pellets, byTarget: new Map(), ping: false };
    ray.near = 0.1;
    ray.far = 1200;
    for (let i = 0; i < pellets; i++) {
      tmpDir.copy(aimDir);
      if (pellets > 1) jitter(tmpDir, d.pelletSpread);
      ray.set(camera.position, tmpDir);
      const hit = ray.intersectObjects(shootables, false)[0];
      if (hit) handleHit(hit, w, shot);
    }
    reportShot(shot);

    state.bloom = Math.min(d.maxBloom, state.bloom + d.bloom);
    const calm = lerp(1, 0.6, smooth(state.stance));
    state.recoilPitch += d.recoil * (0.8 + Math.random() * 0.4) * calm;
    state.recoilYaw += (Math.random() - 0.5) * d.recoilYaw * 2 * calm;
    w.kick = Math.min(1.4, w.kick + 1);
    w.shots++;

    w.flash.visible = true;
    w.flash.rotation.z = Math.random() * Math.PI * 2;
    w.flash.scale.setScalar(0.75 + Math.random() * 0.5);
    state.flashT = 0.05;
    muzzleLight.intensity = 2.2;
    vmFlashLight.intensity = 2.5;

    SR.sound.shot(d.sound);
    if (w.view.bolt || w.view.pump) {
      w.boltT = 0;
      w.ejected = false;
      if (w.view.bolt) SR.sound.bolt();
      else SR.sound.pump();
    } else if (d.id === 'revolver') {
      SR.sound.cylinder();
    }
    if (d.shell && !d.shell.delay) ejectShell(w);
  }

  function ejectShell(w) {
    const s = w.def.shell;
    w.view.group.updateMatrixWorld(true);
    w.view.eject.getWorldPosition(tmpV);
    const r = 0.8 + Math.random() * 0.4;
    fx.ejectShell(tmpV, new V3(s.side * r, s.up * r, 0.25 * r), s.r, s.len, s.color);
  }

  function jitter(dir, spread) {
    if (spread <= 0) return dir;
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * spread;
    return dir.addScaledVector(tmpRight, Math.cos(ang) * rad).addScaledVector(tmpUp, Math.sin(ang) * rad).normalize();
  }

  const RANK = { body: 1, bodyDown: 2, head: 3 };

  // Ein einzelnes Geschoss (oder eine Schrotkugel) trifft etwas.
  function handleHit(h, w, shot) {
    const ud = h.object.userData;
    const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new V3(0, 1, 0);
    const scale = 0.7 + h.distance / 22;
    const lite = shot.pellets > 1;
    if (ud.target && (ud.part === 'body' || ud.part === 'head')) {
      const t = ud.target;
      t.addHole(h, w.def.holeR);
      fx.impact(h.point, n, 'target', scale, lite);
      let entry = shot.byTarget.get(t);
      if (!entry) {
        entry = { t, pellets: 0, res: null };
        shot.byTarget.set(t, entry);
      }
      entry.pellets++;
      const res = t.hit(ud.part, w.def.pelletHit);
      if (res && (!entry.res || RANK[res.type] >= RANK[entry.res.type])) entry.res = res;
    } else {
      fx.impact(h.point, n, ud.surface || 'grass', scale, lite);
      if (ud.surface === 'steel' && !shot.ping) {
        shot.ping = true;
        SR.sound.hitBody(h.distance);
      }
    }
  }

  // Nach dem Schuss: Geräusche, Zähler und Treffer-Anzeige (einmal pro Schuss, auch bei Schrot).
  function reportShot(shot) {
    let best = null;
    shot.byTarget.forEach((entry) => {
      const t = entry.t;
      if (entry.res && entry.res.type === 'head') {
        SR.sound.hitHead(t.dist);
        stats.heads++;
      } else {
        SR.sound.hitBody(t.dist);
      }
      if (entry.res && (!best || RANK[entry.res.type] > RANK[best.res.type])) best = entry;
    });
    if (!best) return;
    stats.hits++;
    const N = SR.BODY_HITS_NEEDED;
    const extra = shot.pellets > 1 ? ' · ' + best.pellets + (best.pellets === 1 ? ' Kugel' : ' Kugeln') : '';
    if (best.res.type === 'head') showHit('Kopftreffer – umgefallen!' + extra, 'head');
    else if (best.res.type === 'bodyDown') showHit('Körper ' + N + '/' + N + ' – umgefallen!' + extra, 'down');
    else showHit('Körper ' + best.res.hits + '/' + N + extra, 'body');
  }

  // ---------- Runden ----------
  function resetRound() {
    targets.forEach((t) => t.reset());
    round = { start: null, done: false, resetAt: 0 };
    stats.shots = stats.hits = stats.heads = 0;
    ui.banner.hidden = true;
  }

  function checkRound() {
    let down = 0;
    targets.forEach((t) => {
      if (t.state === 'down' || t.state === 'falling') down++;
    });
    stats.down = down;
    if (!round.done && down === targets.length) {
      round.done = true;
      round.time = clock - (round.start == null ? clock : round.start);
      round.resetAt = clock + 8;
      const quote = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0;
      let rec = '';
      if (best == null || round.time < best) {
        best = round.time;
        rec = ' · neue Bestzeit!';
        try {
          localStorage.setItem('sr-best', String(best));
        } catch (e) {
          /* egal */
        }
      }
      ui.bannerText.textContent = 'Alle ' + targets.length + ' Scheiben liegen!';
      ui.bannerSub.textContent =
        'Zeit ' + fmtTime(round.time) + ' · ' + stats.shots + ' Schuss · Trefferquote ' + quote + ' % · ' + stats.heads + ' Kopftreffer' + rec;
      ui.banner.hidden = false;
      SR.sound.win();
    }
    if (round.done && clock >= round.resetAt) resetRound();
  }

  // ---------- HUD ----------
  const hudCache = {};
  function setText(el, key, val) {
    if (hudCache[key] !== val) {
      hudCache[key] = val;
      el.textContent = val;
    }
  }

  function updateWeaponCard() {
    const w = state.held;
    if (!w) {
      ui.wName.textContent = 'Keine Waffe';
      ui.wKind.textContent = 'Die Waffen liegen auf dem Tisch';
      ui.wRpm.textContent = '–';
      ui.wBar.style.width = '0%';
      ui.wAmmo.textContent = '–';
      ui.weapon.classList.add('empty');
      return;
    }
    const maxRpm = Math.max.apply(null, SR.WEAPON_DEFS.map((d) => d.rpm));
    ui.wName.textContent = w.def.name;
    ui.wKind.textContent = w.def.kind;
    ui.wRpm.textContent = w.def.rpm + ' Schuss/min';
    ui.wBar.style.width = Math.round((w.def.rpm / maxRpm) * 100) + '%';
    ui.wAmmo.textContent = '∞';
    ui.weapon.classList.remove('empty');
  }

  function updateHud(e) {
    setText(ui.sDown, 'down', stats.down + '/' + targets.length);
    setText(ui.sShots, 'shots', String(stats.shots));
    setText(ui.sHits, 'hits', String(stats.hits));
    setText(ui.sHeads, 'heads', String(stats.heads));
    const elapsed = round.done ? round.time : round.start == null ? null : clock - round.start;
    setText(ui.sTime, 'time', fmtTime(elapsed));
    setText(ui.sBest, 'best', fmtTime(best));
    setText(ui.sStance, 'stance', state.prone ? 'liegend' : 'stehend');
    let next = null;
    targets.forEach((t) => {
      const s = t.secondsUntilUp;
      if (s != null && (next == null || s < next)) next = s;
    });
    ui.respawnRow.hidden = next == null;
    if (next != null) {
      const m = Math.floor(Math.ceil(next) / 60);
      const sec = Math.ceil(next) % 60;
      setText(ui.sRespawn, 'respawn', m + ':' + (sec < 10 ? '0' : '') + sec);
    }

    // Aufnehmen-Hinweis
    let p = '';
    if (state.looking) {
      p = '<kbd>E</kbd> ' + state.looking.def.name + ' nehmen';
      if (state.held) p += ' <span>· ' + state.held.def.short + ' kommt zurück auf den Tisch</span>';
    } else if (state.prone && !state.held) {
      p = 'Mit <kbd>Strg</kbd> aufstehen, dann eine Waffe vom Tisch nehmen';
    } else if (!state.held) {
      p = 'Schau auf eine Waffe auf dem Tisch und drück <kbd>E</kbd>';
    }
    if (hudCache.prompt !== p) {
      hudCache.prompt = p;
      ui.prompt.innerHTML = p;
      ui.prompt.hidden = !p;
    }

    const w = state.held;
    const scoped = !!(w && w.def.scope && state.ads > 0.9);
    ui.scope.hidden = !scoped;
    if (scoped && ui.scope.className !== w.def.scope) ui.scope.className = w.def.scope;
    ui.crosshair.hidden = e > 0.35 || scoped;
    ui.crosshair.classList.toggle('dot', !w);

    let ring = 0;
    if (w) {
      const d = w.def;
      const spread = (lerp(d.hipSpread, d.adsSpread, e) + state.bloom + (state.moving ? 0.012 : 0)) * proneSteady() + (d.pelletSpread || 0);
      const toPx = (a) => (Math.tan(a) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * (window.innerHeight / 2);
      const px = toPx(spread);
      // Schrotflinten: Kreis zeigt, wie breit die Garbe auseinandergeht
      ring = d.pelletSpread ? Math.round(toPx(d.pelletSpread) * 2) : 0;
      const gap = Math.round(clamp(px, 3, 80));
      if (hudCache.gap !== gap) {
        hudCache.gap = gap;
        ui.crosshair.style.setProperty('--gap', gap + 'px');
      }
    }
    if (hudCache.ring !== ring) {
      hudCache.ring = ring;
      ui.pattern.hidden = !ring;
      if (ring) ui.pattern.style.setProperty('--d', ring + 'px');
    }
  }

  // ---------- Eingabe ----------
  function setPaused(p) {
    state.paused = p;
    ui.overlay.hidden = !p;
    ui.startLabel.textContent = state.started ? 'Weiterspielen' : 'Spiel starten';
    if (p) {
      state.trigger = false;
      state.aiming = false;
      state.keys = {};
    }
  }

  function enableFallback() {
    if (state.locked) return;
    if (state.lockWorked) {
      toast('Maus konnte nicht gefangen werden – bitte noch einmal klicken.', 3);
      return;
    }
    state.fallback = true;
    setPaused(false);
    toast('Maus-Fang ist hier nicht möglich: Maus bewegen oder an den Rand fahren zum Drehen, Pfeiltasten gehen auch.', 6);
  }

  function requestLock() {
    const el = renderer.domElement;
    if (!el.requestPointerLock) {
      enableFallback();
      return;
    }
    try {
      const r = el.requestPointerLock();
      if (r && typeof r.catch === 'function') r.catch(enableFallback);
    } catch (err) {
      enableFallback();
    }
  }

  ui.start.addEventListener('click', () => {
    SR.sound.init();
    state.started = true;
    if (state.fallback) setPaused(false);
    else requestLock();
  });

  ui.sens.value = String(state.sens);
  ui.sensOut.textContent = state.sens.toFixed(1).replace('.', ',');
  ui.sens.addEventListener('input', () => {
    state.sens = parseFloat(ui.sens.value) || 1;
    ui.sensOut.textContent = state.sens.toFixed(1).replace('.', ',');
    try {
      localStorage.setItem('sr-sens', String(state.sens));
    } catch (e) {
      /* egal */
    }
  });

  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === renderer.domElement;
    if (state.locked) {
      state.lockWorked = true;
      state.fallback = false;
      setPaused(false);
    } else if (state.started && !state.fallback) {
      setPaused(true);
    }
  });
  document.addEventListener('pointerlockerror', enableFallback);

  document.addEventListener('mousemove', (e) => {
    state.mouseX = e.clientX / window.innerWidth;
    if (!isActive() || (!state.locked && !state.fallback)) return;
    const mx = clamp(e.movementX || 0, -250, 250);
    const my = clamp(e.movementY || 0, -250, 250);
    const s = BASE_SENS * state.sens * (camera.fov / BASE_FOV);
    state.yaw -= mx * s;
    state.pitch = clamp(state.pitch - my * s, -1.5, 1.5);
    state.swayX = clamp(state.swayX - mx * 0.00004, -0.015, 0.015);
    state.swayY = clamp(state.swayY + my * 0.00004, -0.015, 0.015);
  });

  window.addEventListener('mousedown', (e) => {
    if (!isActive()) return;
    if (e.button === 0) state.trigger = true;
    if (e.button === 2) state.aiming = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) state.trigger = false;
    if (e.button === 2) state.aiming = false;
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    if (!isActive()) return;
    // Strg+Taste soll im Spiel keine Browser-Kürzel auslösen (z. B. Strg+S, Strg+D)
    if (e.ctrlKey) e.preventDefault();
    state.keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') toggleProne();
    else if (e.code === 'KeyE') equip(lookAtWeapon());
    else if (e.code === 'KeyQ') putBack();
    else if (e.code === 'KeyR') resetRound();
    else if (e.code === 'Escape' && state.fallback) setPaused(true);
  });
  window.addEventListener('keyup', (e) => {
    state.keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    state.keys = {};
    state.trigger = false;
    state.aiming = false;
  });

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = vmCamera.aspect = w / h;
    camera.updateProjectionMatrix();
    vmCamera.updateProjectionMatrix();
    hudCache.gap = null;
    hudCache.ring = null;
  });

  // ---------- Bewegung auf dem Platz ----------
  function blocked(x, z) {
    const b = world.bounds;
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return true;
    const r = 0.3;
    return x > table.minX - r && x < table.maxX + r && z > table.minZ - r && z < table.maxZ + r;
  }

  function move(dt) {
    const k = state.keys;
    const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
    const s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    const changing = Math.abs(state.stance - (state.prone ? 1 : 0)) > 0.02;
    state.moving = !!(f || s) && !changing;
    if (!state.moving) return;
    const speed = (state.prone ? (state.aiming ? 0.3 : 0.6) : state.aiming ? 1.2 : 2.4) * dt;
    const sin = Math.sin(state.yaw);
    const cos = Math.cos(state.yaw);
    let dx = -sin * f + cos * s;
    let dz = -cos * f - sin * s;
    const len = Math.hypot(dx, dz);
    dx = (dx / len) * speed;
    dz = (dz / len) * speed;
    if (!blocked(state.pos.x + dx, state.pos.z)) state.pos.x += dx;
    if (!blocked(state.pos.x, state.pos.z + dz)) state.pos.z += dz;
  }

  // ---------- Hauptschleife ----------
  function update(dt) {
    const active = isActive();
    const w = state.held;
    const d = w ? w.def : null;

    if (active) {
      const k = state.keys;
      const turn = 1.7 * dt * (camera.fov / BASE_FOV) * state.sens;
      state.yaw += ((k.ArrowLeft ? 1 : 0) - (k.ArrowRight ? 1 : 0)) * turn;
      state.pitch = clamp(state.pitch + ((k.ArrowUp ? 1 : 0) - (k.ArrowDown ? 1 : 0)) * turn, -1.5, 1.5);
      if (state.fallback) {
        if (state.mouseX < 0.05) state.yaw += turn;
        else if (state.mouseX > 0.95) state.yaw -= turn;
      }
      move(dt);
    } else {
      state.moving = false;
    }

    // Zielen (Rechtsklick)
    const aimWanted = active && w && state.aiming ? 1 : 0;
    state.ads = approach(state.ads, aimWanted, (d ? 1 / d.adsTime : 6) * dt);
    const e = smooth(state.ads);
    const scoped = !!(d && d.scope && state.ads > 0.9);

    let fov = BASE_FOV;
    if (d) fov = d.scope ? (scoped ? d.adsFov : lerp(BASE_FOV, 55, e)) : lerp(BASE_FOV, d.adsFov, e);
    const vmFov = d ? lerp(VM_FOV, d.vmAdsFov, e) : VM_FOV;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    if (Math.abs(vmCamera.fov - vmFov) > 0.01) {
      vmCamera.fov = vmFov;
      vmCamera.updateProjectionMatrix();
    }

    // Schießen (Linksklick gedrückt halten = Feuer in der Kadenz der Waffe)
    state.equipT = Math.min(1, state.equipT + dt / 0.35);
    let burst = 0;
    const stanceChanging = Math.abs(state.stance - (state.prone ? 1 : 0)) > 0.02;
    while (w && active && state.trigger && !stanceChanging && state.equipT >= 1 && clock >= state.nextShot && burst < 3) {
      fire(w);
      state.nextShot = (clock - state.nextShot > d.interval ? clock : state.nextShot) + d.interval;
      burst++;
    }
    if (d) state.bloom = Math.max(0, state.bloom - dt * d.maxBloom * 3);

    // Rückstoß klingt ab
    const rec = d ? d.recover : 8;
    state.recoilPitch *= Math.exp(-dt * rec);
    state.recoilYaw *= Math.exp(-dt * rec);

    // Kamera
    let swayP = 0;
    let swayY = 0;
    if (scoped) {
      const amp = (d.adsFov / 20) * proneSteady();
      swayP = Math.sin(clock * 1.3) * 0.0005 * amp;
      swayY = Math.sin(clock * 0.9) * 0.0007 * amp;
    }
    // Hinlegen / Aufstehen (Strg)
    state.stance = approach(state.stance, state.prone ? 1 : 0, dt / PRONE_TIME);
    const st = smooth(state.stance);
    const midway = Math.sin(Math.PI * st); // 1 mitten in der Bewegung
    state.pos.y = world.padTop + lerp(EYE, EYE_PRONE, st);
    camera.position.copy(state.pos);
    camera.position.y -= midway * 0.06;
    camera.rotation.set(
      clamp(state.pitch + state.recoilPitch + swayP, -1.55, 1.55),
      state.yaw + state.recoilYaw + swayY,
      midway * 0.07
    );
    camera.updateMatrixWorld();

    // Was liegt im Blick?
    const look = active ? lookAtWeapon() : null;
    if (look !== state.looking) {
      if (state.looking) state.looking.outline.visible = false;
      if (look) look.outline.visible = true;
      state.looking = look;
    }

    // Waffe in der Hand
    if (w) {
      const v = w.view;
      const g = v.group;
      g.visible = !scoped;
      const bobAmt = (state.moving ? 1 - e * 0.85 : 0.2 * (1 - e * 0.9)) * (state.prone && state.moving ? 1.6 : 1);
      state.bobT += dt * (state.moving ? 8.5 : 1.4);
      const bx = Math.cos(state.bobT * 0.5) * 0.007 * bobAmt;
      const by = -Math.abs(Math.sin(state.bobT * 0.5)) * 0.009 * bobAmt;
      state.swayX *= Math.exp(-dt * 7);
      state.swayY *= Math.exp(-dt * 7);
      const swayK = 1 - e * 0.85;
      const eq = smooth(state.equipT);
      w.kick *= Math.exp(-dt * 12);

      g.position.set(
        lerp(d.hipPos[0], 0, e) + bx + state.swayX * swayK,
        lerp(d.hipPos[1], -v.sightY, e) + by + state.swayY * swayK - (1 - eq) * 0.25 - midway * 0.14,
        lerp(d.hipPos[2], d.adsZ, e) + w.kick * d.kickBack
      );
      g.rotation.set(w.kick * d.kickRot - (1 - eq) * 0.9 - midway * 0.5, state.swayX * 2 * swayK, 0);

      // KR86: Kammerstängel hoch, zurück, vor, runter
      if (v.bolt || v.pump) w.boltT = Math.min(1, w.boltT + dt / (d.interval - 0.05));
      // SG-21: Vorderschaft zurück und wieder vor, dabei fliegt die Hülse raus
      if (v.pump) {
        const p = w.boltT;
        let back = 0;
        if (p > 0.15 && p < 0.4) back = (p - 0.15) / 0.25;
        else if (p >= 0.4 && p < 0.65) back = 1 - (p - 0.4) / 0.25;
        v.pump.position.z = -0.26 + smooth(back) * 0.06;
        if (!w.ejected && p >= 0.4) {
          w.ejected = true;
          ejectShell(w);
        }
        if (p < 1) g.rotation.z = Math.sin(Math.PI * clamp((p - 0.1) / 0.6, 0, 1)) * 0.1 * (1 - e);
      }
      if (v.bolt) {
        const p = w.boltT;
        let rot = 0;
        let back = 0;
        if (p > 0.15 && p < 0.3) rot = (p - 0.15) / 0.15;
        else if (p >= 0.3 && p < 0.5) {
          rot = 1;
          back = (p - 0.3) / 0.2;
        } else if (p >= 0.5 && p < 0.7) {
          rot = 1;
          back = 1 - (p - 0.5) / 0.2;
        } else if (p >= 0.7 && p < 0.85) rot = 1 - (p - 0.7) / 0.15;
        v.bolt.rotation.z = smooth(rot) * 1.2;
        v.bolt.position.z = smooth(back) * 0.085;
        if (!w.ejected && p >= 0.45) {
          w.ejected = true;
          ejectShell(w);
        }
        if (p < 1) g.rotation.z = Math.sin(Math.PI * clamp((p - 0.1) / 0.8, 0, 1)) * 0.22 * (1 - e);
      }
      // Revolver: Trommel dreht sich und der Hahn spannt beim Durchziehen
      if (v.cylinder) {
        const k = state.trigger && active ? clamp((clock - state.lastShot) / d.interval, 0, 1) : 0;
        v.cylinder.rotation.z = (w.shots + k) * (Math.PI / 3);
        v.hammer.rotation.x = 0.25 + 0.65 * k;
      }

      // Licht im Waffen-Blickfeld folgt der Sonne
      tmpV.copy(world.sunDir).applyQuaternion(tmpQuat.copy(camera.quaternion).invert());
      vmSun.position.copy(tmpV);
      v.muzzle.getWorldPosition(vmFlashLight.position);
    }

    // Mündungsfeuer
    if (state.flashT > 0) {
      state.flashT -= dt;
      if (state.flashT <= 0 && w) w.flash.visible = false;
    }
    muzzleLight.intensity *= Math.exp(-dt * 35);
    vmFlashLight.intensity *= Math.exp(-dt * 35);
    camera.getWorldDirection(tmpDir);
    muzzleLight.position.copy(camera.position).addScaledVector(tmpDir, 0.9);

    targets.forEach((t) => t.update(dt));
    fx.update(dt);
    world.update(clock);
    checkRound();
    updateHud(e);

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) ui.toast.hidden = true;
    }
  }
  const tmpQuat = new THREE.Quaternion();

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    clock += dt;
    update(dt);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(vmScene, vmCamera);
  }

  // Kadenz-Liste im Startbildschirm
  (function fillArsenal() {
    const maxRpm = Math.max.apply(null, SR.WEAPON_DEFS.map((d) => d.rpm));
    const list = $('arsenal');
    SR.WEAPON_DEFS.slice()
      .sort((a, b) => b.rpm - a.rpm)
      .forEach((d) => {
        const li = document.createElement('li');
        li.innerHTML =
          '<span class="n">' + d.name + '</span><span class="k">' + d.kind + '</span>' +
          '<span class="bar"><i style="width:' + Math.round((d.rpm / maxRpm) * 100) + '%"></i></span>' +
          '<span class="v">' + d.rpm + '<small> /min</small></span>';
        list.appendChild(li);
      });
  })();

  updateWeaponCard();
  setPaused(true);
  requestAnimationFrame(frame);

  // Für Tests in der Browser-Konsole
  window.__sr = {
    state,
    stats,
    targets,
    weapons,
    camera,
    equip: (i) => equip(weapons[i]),
    putBack,
    fire: () => state.held && fire(state.held),
    resetRound,
    get clock() {
      return clock;
    },
    toggleProne,
    start() {
      state.started = true;
      state.fallback = true;
      setPaused(false);
    },
  };
})();
