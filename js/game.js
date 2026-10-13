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
  // Plätze auf dem Tisch (nur Tischwaffen), gleichmäßig verteilt. Wandwaffen hängen an der Waffenwand.
  const TABLE_DEFS = SR.WEAPON_DEFS.filter((d) => !d.wall);
  const SLOT_X = SR.WEAPON_DEFS.map((d) => (TABLE_DEFS.indexOf(d) - (TABLE_DEFS.length - 1) / 2) * 0.45);
  SR.WEAPON_DEFS.forEach((d) => {
    d.rpm = Math.round(60 / d.interval);
  });
  // Schaden gegen Gegner (pro Treffer, bei Schrot pro Kugel); neue Waffen bringen ihren Wert selbst mit
  const HURT_DEFAULT = { c96: 16, revolver: 42, g36: 24, kr86: 92, birdshot: 11, sg21: 17, phantom: 34 };
  SR.WEAPON_DEFS.forEach((d) => {
    if (d.dmg == null) d.dmg = HURT_DEFAULT[d.id] || 20;
  });

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
    money: $('money'),
    dmgTotal: $('damageTotal'),
    earn: $('earn'),
    wSkin: $('wSkin'),
    hurt: $('hurt'),
    hitDir: $('hitDir'),
    hpBar: $('hpBar'),
    hpNum: $('hpNum'),
    vitals: $('vitals'),
    death: $('death'),
    deathSub: $('deathSub'),
    kills: $('statKills'),
    enemyBars: $('enemyBars'),
    drawBar: $('drawBar'),
    drawFill: $('drawFill'),
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

  // Statische Hindernisse (Boden, Tisch, Scheiben, Automat, Wand): Sichtlinien und Gegner-Kugeln prüfen nur gegen diese.
  const staticShoot = world.shootables.slice();
  targets.forEach((t) => staticShoot.push(...t.parts));
  const wall = SR.buildWall(scene, world.padTop);
  wall.parts.forEach((m) => staticShoot.push(m));
  SR.buildPaths(scene);
  // Alles Treffbare inklusive der lebenden Gegner (wird neu gebaut, wenn sich die Gegner-Liste ändert)
  let shootables = staticShoot;
  let shootVersion = -1;

  // ---------- Waffen auf Tisch und Wand ----------
  const table = world.table;
  const highlightMat = new THREE.LineBasicMaterial({ color: 0xe6ae45, transparent: true, opacity: 0.9 });
  const WALL = SR.WALL;
  const wallDefs = SR.WEAPON_DEFS.filter((d) => d.wall);

  // Drehung beim Aufhängen: Langwaffen stehen mit dem Lauf nach oben, Pistolen liegen waagerecht, die Armbrust mit senkrechten Wurfarmen
  function wallRotation(w) {
    const api = w.table;
    if (w.variant === 'crossbow') return [0, 0, Math.PI / 2];
    if (api.stance === 'bow') return [0, 0, 0];
    const stance = api.stance || (SR.HOLD[w.def.id] && SR.HOLD[w.def.id].stance);
    return stance === 'pistol' ? [0, 0, 0] : [Math.PI / 2, 0, 0];
  }

  // Stellt die Waffe an ihren Platz (Tisch oder Wand) und passt Auswahlkasten und Umriss an.
  function layoutHome(w) {
    const g = w.table.group;
    g.position.set(0, 0, 0);
    const wallRow = !!w.def.wall;
    if (wallRow) g.rotation.set(...wallRotation(w));
    else g.rotation.set(0, 0, Math.PI / 2); // auf die Seite gelegt
    g.updateMatrixWorld(true);
    const bb = SR.visibleBox(g);
    if (wallRow) {
      const slot = wallDefs.indexOf(w.def);
      const pistol = wallRotation(w)[0] === 0 && w.variant !== 'crossbow' && w.table.stance !== 'bow';
      g.position.set(
        WALL.x - 0.03 - bb.max.x,
        (pistol ? WALL.pistolY : WALL.rowY) + world.padTop - (bb.min.y + bb.max.y) / 2,
        WALL.slotZFor(slot, wallDefs.length) - (bb.min.z + bb.max.z) / 2
      );
    } else {
      g.position.set(SLOT_X[w.index] - (bb.min.x + bb.max.x) / 2, table.topY - bb.min.y, table.z - (bb.min.z + bb.max.z) / 2);
    }
    g.updateMatrixWorld(true);
    const box = SR.visibleBox(g);
    const size = box.getSize(new V3());
    const center = box.getCenter(new V3());
    w.hitbox.geometry.dispose();
    w.hitbox.geometry = new THREE.BoxGeometry(Math.max(size.x, 0.12) + 0.06, Math.max(size.y, 0.12) + 0.08, Math.max(size.z, 0.12) + 0.06);
    w.hitbox.position.copy(center);
    w.outline.geometry.dispose();
    w.outline.geometry = new THREE.EdgesGeometry(w.hitbox.geometry);
    w.outline.position.copy(center);
  }

  const weapons = SR.WEAPON_DEFS.map((def, i) => {
    const t = def.build();
    t.group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(t.group);

    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ visible: false }));
    hitbox.userData.slot = i;
    scene.add(hitbox);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(hitbox.geometry), highlightMat);
    outline.visible = false;
    scene.add(outline);

    const nameTex = SR.tex.label(def.short, { w: 256, h: 64 });
    // Geheimwaffe: Schild zeigt „? ? ?“, bis man sie am Automaten gewonnen hat
    const lockedTex = def.secret ? SR.tex.label('? ? ?', { w: 256, h: 64, bg: '#2a1020', fg: '#ff4fa3', border: '#ff4fa3' }) : null;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.09), new THREE.MeshStandardMaterial({ map: nameTex, roughness: 0.9 }));
    if (def.wall) {
      // Schild am Regalbrett unter der Waffe
      label.scale.set(0.9, 0.9, 1);
      label.position.set(WALL.x - 0.182, world.padTop + 0.56, WALL.slotZFor(wallDefs.indexOf(def), wallDefs.length));
      label.rotation.y = -Math.PI / 2;
    } else {
      label.position.set(SLOT_X[i], table.apronY, table.frontZ - 0.012);
    }
    scene.add(label);

    const v = def.build();
    v.group.visible = false;
    weaponRoot.add(v.group);
    const flash = SR.makeMuzzleFlash(def.pellets ? 0.17 : def.id === 'kr86' || def.id === 'g36' || def.laser ? 0.13 : 0.085, def.beamColor);
    if (def.type !== 'bow') v.muzzle.add(flash);

    return { def, index: i, table: t, view: v, hitbox, outline, flash, label, nameTex, lockedTex, variant: null, onTable: true, kick: 0, boltT: 1, ejected: true, shots: 0 };
  });
  weapons.forEach(layoutHome);

  // ---------- Skin-Automat auf dem Platz ----------
  const slotMachine = SR.buildSlotMachine(scene, -2.75, 3.05, 0, 0.6, world.padTop);
  slotMachine.parts.forEach((m) => staticShoot.push(m));

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
    inSlot: false,
    lookSlot: false,
    slotHint: false,
    dead: false,
    deadT: 0,
    hp: 100,
    maxHp: 100,
    lastHurt: -99,
    hurtFlash: 0,
    drawing: false,
    draw: 0,
    drawHold: 0,
    arrowShown: true,
  };
  const stats = { shots: 0, hits: 0, heads: 0, down: 0, kills: 0 };
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
  const isActive = () => state.started && !state.paused && !state.inSlot && !state.dead;

  // ---------- Geld (Taler) und Skins ----------
  // Taler pro Treffer: Kopf 50, Körper zufällig 35–45 (kleiner Vogelschrot anteilig).
  const PAY = { head: 50, bodyMin: 35, bodyMax: 45 };
  const econ = { money: 200, damage: 0, owned: {}, equipped: {}, weapons: {}, usedSlot: false };
  try {
    const saved = JSON.parse(localStorage.getItem('sr-econ') || 'null');
    if (saved && typeof saved.money === 'number') Object.assign(econ, saved);
    econ.weapons = econ.weapons || {};
  } catch (e) {
    /* kein Speicher – neues Spiel */
  }
  let econDirty = false;
  let econSaveT = 0;
  function saveEcon() {
    econDirty = false;
    try {
      localStorage.setItem('sr-econ', JSON.stringify(econ));
    } catch (e) {
      /* egal */
    }
  }
  window.addEventListener('pagehide', saveEcon);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveEcon();
  });
  function earn(n) {
    econ.money += n;
    econDirty = true;
  }
  function spend(n) {
    if (econ.money < n) return false;
    econ.money -= n;
    saveEcon();
    return true;
  }
  const owns = (wid, sid) => !!(econ.owned[wid] && econ.owned[wid][sid]);
  function unlock(wid, sid) {
    (econ.owned[wid] = econ.owned[wid] || {})[sid] = true;
    saveEcon();
  }
  function applyWeaponSkin(w) {
    const sid = econ.equipped[w.def.id] || 'standard';
    w.variant = SR.applySkin(w.table.group, w.def.id, sid, w.table);
    SR.applySkin(w.view.group, w.def.id, sid, w.view);
    layoutHome(w);
  }
  function equipSkin(wid, sid) {
    if (sid !== 'standard' && !owns(wid, sid)) return;
    econ.equipped[wid] = sid;
    saveEcon();
    const w = weapons.find((x) => x.def.id === wid);
    if (w) applyWeaponSkin(w);
    if (w && state.held === w) updateWeaponCard();
  }
  weapons.forEach(applyWeaponSkin);

  // Wie stark ein Körpertreffer für das Umwerfen zählt (Schrot weniger, Phantom-X doppelt)
  const hitValue = (def) => (def.pelletHit != null ? def.pelletHit : def.bodyHits || (def.type === 'bow' ? 2 : 1));

  function payFor(res, def) {
    if (res.type === 'head') return def.headPay || PAY.head;
    const body = PAY.bodyMin + Math.floor(Math.random() * (PAY.bodyMax - PAY.bodyMin + 1));
    return body * Math.min(1, hitValue(def));
  }

  // Geheimwaffe: nur sichtbar und benutzbar, wenn man sie gewonnen hat
  const ownsWeapon = (wid) => !!econ.weapons[wid];
  function setWeaponLocked(w, locked) {
    w.locked = locked;
    w.onTable = !locked && state.held !== w;
    w.table.group.visible = w.onTable;
    w.label.material.map = locked ? w.lockedTex : w.nameTex;
    w.label.material.needsUpdate = true;
  }
  function unlockWeapon(wid) {
    econ.weapons[wid] = true;
    saveEcon();
    const w = weapons.find((x) => x.def.id === wid);
    if (w) setWeaponLocked(w, false);
    state.newSecret = true;
  }
  weapons.forEach((w) => {
    if (w.def.secret) setWeaponLocked(w, !ownsWeapon(w.def.id));
  });

  function popEarn(n) {
    ui.earn.textContent = '+' + n.toLocaleString('de-DE');
    restartAnim(ui.earn, 'show');
  }

  // ---------- Waffenbilder für den Automaten (seitlich gerendert) ----------
  const iconCache = {};
  const ICON_W = 480;
  const ICON_H = 200;
  let iconRT = null;
  let iconScene = null;
  let iconBuf = null;
  function weaponIcon(index, skinId) {
    const key = index + ':' + skinId;
    if (iconCache[key]) return iconCache[key];
    if (!iconScene) {
      iconScene = new THREE.Scene();
      iconScene.environment = world.envMap;
      iconScene.add(new THREE.HemisphereLight(0xffffff, 0x50584a, 0.6));
      const key1 = new THREE.DirectionalLight(0xffffff, 1.0);
      key1.position.set(1, 1.4, 0.4);
      iconScene.add(key1);
      iconRT = new THREE.WebGLRenderTarget(ICON_W, ICON_H);
      iconRT.texture.encoding = THREE.sRGBEncoding;
      iconBuf = new Uint8Array(ICON_W * ICON_H * 4);
    }
    const def = SR.WEAPON_DEFS[index];
    const m = def.build();
    SR.applySkin(m.group, def.id, skinId, m);
    iconScene.add(m.group);
    m.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m.group);
    const size = box.getSize(new V3());
    const c = box.getCenter(new V3());
    const aspect = ICON_W / ICON_H;
    const halfW = Math.max(size.z / 2, (size.y / 2) * aspect) * 1.06;
    const halfH = halfW / aspect;
    const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.01, 10);
    cam.position.set(c.x + 2, c.y, c.z);
    cam.lookAt(c);
    const prevColor = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(iconRT);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(iconScene, cam);
    renderer.readRenderTargetPixels(iconRT, 0, 0, ICON_W, ICON_H, iconBuf);
    renderer.setRenderTarget(null);
    renderer.setClearColor(prevColor, prevAlpha);
    iconScene.remove(m.group);
    m.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    // Pixel umdrehen (WebGL zählt von unten) und verkleinert als Bild speichern
    const big = document.createElement('canvas');
    big.width = ICON_W;
    big.height = ICON_H;
    const bg = big.getContext('2d');
    const img = bg.createImageData(ICON_W, ICON_H);
    const row = ICON_W * 4;
    for (let y = 0; y < ICON_H; y++) img.data.set(iconBuf.subarray((ICON_H - 1 - y) * row, (ICON_H - y) * row), y * row);
    bg.putImageData(img, 0, 0);
    const small = document.createElement('canvas');
    small.width = ICON_W / 2;
    small.height = ICON_H / 2;
    small.getContext('2d').drawImage(big, 0, 0, small.width, small.height);
    iconCache[key] = small.toDataURL('image/png');
    return iconCache[key];
  }

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
    state.drawing = false;
    state.draw = 0;
    state.nextShot = clock + 0.35;
    if (w.view.setDraw) w.view.setDraw(0);
    if (w.view.setArrowVisible) w.view.setArrowVisible(true);
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

  function lookAtSlot() {
    if (state.prone || state.stance > 0.05) return false;
    camera.getWorldDirection(tmpDir);
    ray.set(camera.position, tmpDir);
    ray.near = 0;
    ray.far = REACH;
    return ray.intersectObject(slotMachine.hitbox, false).length > 0;
  }

  // ---------- Skin-Automat bedienen ----------
  const slotUI = SR.createSlotUI({
    money: () => econ.money,
    spend,
    earn(n) {
      earn(n);
      saveEcon();
    },
    owns,
    unlock,
    ownsWeapon,
    unlockWeapon,
    equip: equipSkin,
    equipped: (wid) => econ.equipped[wid] || 'standard',
    icon: weaponIcon,
    close: closeSlot,
  });

  function openSlot() {
    state.inSlot = true;
    state.trigger = false;
    state.aiming = false;
    state.keys = {};
    econ.usedSlot = true;
    slotMachine.pullLever();
    if (document.pointerLockElement) document.exitPointerLock();
    slotUI.open();
  }

  function closeSlot() {
    slotUI.hide();
    state.inSlot = false;
    saveEcon();
    if (state.newSecret) {
      state.newSecret = false;
      toast('Die Geheimwaffe Phantom-X liegt jetzt ganz rechts auf dem Tisch!', 6);
    }
    if (!state.fallback) requestLock();
  }

  // ---------- Spieler: Lebensleiste, Treffer von Gegnern ----------
  const pb = { center: new V3(), a: new V3(), b: new V3(), r: 0.3, moving: false };
  // Der Körper des Spielers als Strecke (Füße–Kopf) mit Radius, für Gegner-Schüsse und -Pfeile
  function playerBody() {
    const prone = state.stance > 0.5;
    const y0 = world.padTop + 0.1;
    const y1 = prone ? world.padTop + 0.55 : state.pos.y + 0.1;
    pb.a.set(state.pos.x, y0 + (prone ? 0 : 0.15), state.pos.z);
    pb.b.set(state.pos.x, y1, state.pos.z);
    pb.center.set(state.pos.x, y0 + (y1 - y0) * (prone ? 0.5 : 0.62), state.pos.z);
    pb.r = prone ? 0.32 : 0.27;
    pb.moving = state.moving;
    return pb;
  }

  function traceStatic(origin, dir, far) {
    ray.set(origin, dir);
    ray.near = 0;
    ray.far = far;
    return ray.intersectObjects(staticShoot, false)[0] || null;
  }

  // links/rechts-Richtung eines Geräuschs (−1 links … 1 rechts)
  function soundPan(pos) {
    camera.updateMatrixWorld();
    tmpV.subVectors(pos, camera.position).normalize();
    tmpRight.setFromMatrixColumn(camera.matrixWorld, 0);
    return clamp(tmpV.dot(tmpRight) * 1.3, -1, 1);
  }

  const projectiles = SR.createProjectiles(scene, { trace: traceArrow, onHit: arrowHit });
  const enemies = SR.createEnemies({
    scene,
    playerBody,
    traceStatic,
    hurtPlayer,
    fx,
    sound: SR.sound,
    pan: soundPan,
    projectiles,
  });

  function currentShootables() {
    if (enemies.version !== shootVersion) {
      shootVersion = enemies.version;
      shootables = staticShoot.concat(enemies.parts);
    }
    return shootables;
  }

  function hurtPlayer(dmg, from) {
    if (state.dead || dmg <= 0) return;
    state.hp = Math.max(0, state.hp - dmg);
    state.lastHurt = clock;
    state.hurtFlash = Math.min(1, state.hurtFlash + 0.3 + dmg / 70);
    state.recoilPitch += (Math.random() - 0.2) * Math.min(0.05, dmg * 0.003);
    state.recoilYaw += (Math.random() - 0.5) * Math.min(0.07, dmg * 0.004);
    SR.sound.hurt();
    if (from) {
      // Richtungsanzeige: Winkel des Angreifers relativ zur Blickrichtung
      const toYaw = Math.atan2(-(from.x - state.pos.x), -(from.z - state.pos.z));
      let rel = toYaw - state.yaw;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      ui.hitDir.style.setProperty('--a', (-rel * 180) / Math.PI + 'deg');
      restartAnim(ui.hitDir, 'show');
    }
    if (state.hp <= 0) playerDown();
  }

  function playerDown() {
    state.dead = true;
    state.deadT = 0;
    state.trigger = false;
    state.aiming = false;
    state.drawing = false;
    state.draw = 0;
    state.keys = {};
    SR.sound.down();
    ui.death.hidden = false;
    ui.deathSub.textContent = 'Du stehst gleich wieder am Schießstand auf.';
  }

  function respawnPlayer() {
    state.dead = false;
    state.hp = state.maxHp;
    state.hurtFlash = 0;
    state.lastHurt = clock;
    state.pos.set(0, world.padTop + EYE, 0.25);
    state.yaw = 0;
    state.pitch = -0.32;
    state.recoilPitch = state.recoilYaw = 0;
    state.prone = false;
    state.stance = 0;
    state.ads = 0;
    enemies.reset(clock);
    projectiles.clear('enemy');
    ui.death.hidden = true;
    toast('Du bist wieder auf den Beinen. Die Gegner sind zurückgesetzt.', 4);
  }

  // ---------- Pfeile und Bolzen ----------
  // Spieler-Pfeile treffen alles Treffbare; Gegner-Pfeile treffen den Spieler oder die Welt.
  function traceArrow(a, p0, dir, len) {
    if (a.owner === 'enemy') {
      const P = playerBody();
      const rc = enemies.rayVsSegment(p0, dir, P.a, P.b);
      const st = traceStatic(p0, dir, len);
      if (rc.dist <= P.r && rc.t <= len && (!st || rc.t < st.distance)) {
        return { point: p0.clone().addScaledVector(dir, rc.t), player: true, attach: false };
      }
      return st;
    }
    ray.set(p0, dir);
    ray.near = 0;
    ray.far = len;
    return ray.intersectObjects(currentShootables(), false)[0] || null;
  }

  function arrowHit(a, hit) {
    if (a.owner === 'enemy') {
      if (hit.player) {
        hurtPlayer(a.dmg, a.data && a.data.enemy ? a.data.enemy.pos : null);
        SR.sound.arrowHit(0);
        a.stuckT = 99; // Pfeil verschwindet
      } else {
        fx.impact(hit.point, hit.face ? hit.face.normal : new V3(0, 1, 0), (hit.object && hit.object.userData.surface) || 'grass', 0.8, true);
      }
      return;
    }
    const shot = { pellets: 1, byTarget: new Map(), byEnemy: new Map(), ping: false, def: a.data.weapon.def };
    handleHit(hit, a.data.weapon, shot);
    reportShot(shot);
    SR.sound.arrowHit(camera.position.distanceTo(hit.point));
  }

  function releaseArrow(w, power) {
    const d = w.def;
    camera.updateMatrixWorld();
    camera.getWorldDirection(aimDir);
    tmpRight.setFromMatrixColumn(camera.matrixWorld, 0);
    tmpUp.setFromMatrixColumn(camera.matrixWorld, 1);
    const e = smooth(state.ads);
    const spread = (lerp(d.hipSpread, d.adsSpread, e) + (state.moving ? 0.01 : 0)) * proneSteady() * (1.25 - power * 0.6);
    jitter(aimDir, spread);
    const speed = (d.arrowSpeed || 90) * (0.4 + 0.6 * power);
    const pos = camera.position.clone().addScaledVector(aimDir, 0.5).addScaledVector(tmpRight, 0.05 * (1 - e)).addScaledVector(tmpUp, -0.06 * (1 - e));
    projectiles.fire({
      pos,
      vel: aimDir.clone().multiplyScalar(speed),
      owner: 'player',
      dmg: d.dmg,
      scale: w.variant === 'crossbow' ? 0.8 : 1,
      data: { weapon: w, power },
    });
    stats.shots++;
    if (round.start == null) round.start = clock;
    state.lastShot = clock;
    state.nextShot = clock + 0.45;
    w.kick = 1;
    w.shots++;
    state.recoilPitch += 0.006;
    SR.sound.bowShot();
    enemies.noise(state.pos, 28);
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
    const shot = { pellets, byTarget: new Map(), byEnemy: new Map(), ping: false, def: d };
    ray.near = 0.1;
    ray.far = 1200;
    for (let i = 0; i < pellets; i++) {
      tmpDir.copy(aimDir);
      if (pellets > 1) jitter(tmpDir, d.pelletSpread);
      ray.set(camera.position, tmpDir);
      const hit = ray.intersectObjects(currentShootables(), false)[0];
      if (hit) handleHit(hit, w, shot);
      if (d.laser) {
        // Energiestrahl von der Mündung (ungefähr) bis zum Einschlag
        const e2 = smooth(state.ads);
        const from = camera.position.clone().addScaledVector(aimDir, 0.6).addScaledVector(tmpRight, 0.11 * (1 - e2)).addScaledVector(tmpUp, -0.1 * (1 - e2) - 0.03);
        const to = hit ? hit.point : camera.position.clone().addScaledVector(tmpDir, 400);
        fx.beam(from, to, d.beamColor);
      }
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

    if (d.laser) SR.sound.laser();
    else SR.sound.shot(d.sound);
    enemies.noise(state.pos, d.laser ? 55 : 85);
    if (w.view.bolt || w.view.pump || w.view.cycle) {
      w.boltT = 0;
      w.ejected = false;
      if (w.view.pump) SR.sound.pump();
      else SR.sound.bolt();
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
    if (ud.enemy) {
      const e = ud.enemy;
      let entry = shot.byEnemy.get(e);
      if (!entry) {
        entry = { e, dmg: 0, head: false, pellets: 0, dist: camera.position.distanceTo(h.point) };
        shot.byEnemy.set(e, entry);
      }
      const dd = w.def;
      const fall = dd.pellets ? clamp(1.15 - entry.dist / 60, 0.35, 1) : 1; // Schrot verliert mit der Entfernung Wucht
      entry.dmg += (dd.dmg || 20) * (ud.part === 'head' ? 2.5 : ud.part === 'limb' ? 0.65 : 1) * fall;
      entry.head = entry.head || ud.part === 'head';
      entry.pellets++;
      fx.impact(h.point, n, 'cloth', scale, true);
      return;
    }
    if (ud.target && (ud.part === 'body' || ud.part === 'head')) {
      const t = ud.target;
      t.addHole(h, w.def.holeR);
      fx.impact(h.point, n, 'target', scale, lite);
      let entry = shot.byTarget.get(t);
      if (!entry) {
        entry = { t, pellets: 0, res: null, dmg: 0 };
        shot.byTarget.set(t, entry);
      }
      entry.pellets++;
      const res = t.hit(ud.part, hitValue(w.def));
      if (res && (!entry.res || RANK[res.type] >= RANK[entry.res.type])) entry.res = res;
      if (res) entry.dmg += payFor(res, w.def);
    } else {
      fx.impact(h.point, n, ud.surface || 'grass', scale, lite);
      if (ud.surface === 'steel' && !shot.ping) {
        shot.ping = true;
        SR.sound.hitBody(h.distance);
      }
    }
  }

  // Nach dem Schuss: Geräusche, Zähler und Treffer-Anzeige (einmal pro Schuss, auch bei Schrot).
  const KILL_BONUS = 100;
  function reportEnemies(shot) {
    shot.byEnemy.forEach((entry) => {
      const res = enemies.damage(entry.e, entry.dmg, entry.head, clock);
      if (!res) return;
      const def = shot.def;
      stats.hits++;
      let pay = entry.head ? def.headPay || PAY.head : PAY.bodyMin + Math.floor(Math.random() * (PAY.bodyMax - PAY.bodyMin + 1));
      let text = (entry.head ? 'Kopfschuss' : 'Treffer') + (entry.pellets > 1 ? ' · ' + entry.pellets + ' Kugeln' : '');
      let kind = entry.head ? 'head' : 'body';
      if (entry.head) stats.heads++;
      if (res.killed) {
        pay += KILL_BONUS;
        stats.kills++;
        text = 'Gegner besiegt! ' + (entry.head ? '(Kopfschuss)' : '');
        kind = 'down';
        SR.sound.win();
      }
      if (entry.head) SR.sound.hitHead(entry.dist);
      else SR.sound.hitBody(entry.dist);
      earn(pay);
      econ.damage += pay;
      popEarn(pay);
      showHit(text + ' · +' + pay + ' Taler', kind);
    });
  }

  function reportShot(shot) {
    reportEnemies(shot);
    let best = null;
    let dmg = 0;
    shot.byTarget.forEach((entry) => {
      dmg += entry.dmg;
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
    const money = Math.round(dmg);
    let extra = shot.pellets > 1 ? ' · ' + best.pellets + (best.pellets === 1 ? ' Kugel' : ' Kugeln') : '';
    if (money > 0) {
      earn(money);
      econ.damage += money;
      popEarn(money);
      extra += ' · +' + money + ' Taler';
    }
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
    const skin = SR.findSkin(w.def.id, econ.equipped[w.def.id]);
    ui.wSkin.hidden = !skin;
    if (skin) {
      ui.wSkin.textContent = 'Skin: ' + skin.name;
      ui.wSkin.style.setProperty('--rar', SR.RARITY[skin.rarity].color);
    }
    ui.wRpm.textContent = w.def.rpm + ' Schuss/min';
    ui.wBar.style.width = Math.round((w.def.rpm / maxRpm) * 100) + '%';
    ui.wAmmo.textContent = '∞';
    ui.weapon.classList.remove('empty');
  }

  // Lebensleiste, Treffer-Anzeige, Spannbalken des Bogens und Lebensbalken über den Gegnern
  const barEls = new Map();
  function updateVitals() {
    const frac = state.hp / state.maxHp;
    setText(ui.hpNum, 'hp', String(Math.ceil(state.hp)));
    const pct = Math.round(frac * 100);
    if (hudCache.hpw !== pct) {
      hudCache.hpw = pct;
      ui.hpBar.style.width = pct + '%';
      ui.hpBar.dataset.level = pct < 30 ? 'low' : pct < 60 ? 'mid' : 'ok';
      ui.vitals.classList.toggle('low', pct < 30);
    }
    const lowPulse = frac < 0.3 ? (0.18 + 0.1 * Math.sin(clock * 6)) * (1 - frac / 0.3) : 0;
    ui.hurt.style.opacity = String(Math.min(0.85, state.hurtFlash * 0.8 + lowPulse));
    setText(ui.kills, 'kills', String(stats.kills));
    ui.drawBar.hidden = !state.drawing;
    if (state.drawing) ui.drawFill.style.width = Math.round(state.draw * 100) + '%';

    // Lebensbalken: über Gegnern, die gerade getroffen wurden oder im Fadenkreuz sind
    camera.getWorldDirection(tmpDir);
    enemies.list.forEach((en) => {
      let el = barEls.get(en);
      if (!el) {
        el = document.createElement('div');
        el.className = 'ebar';
        el.innerHTML = '<span></span><div><i></i></div>';
        el.firstChild.textContent = en.def.short;
        ui.enemyBars.appendChild(el);
        barEls.set(en, el);
      }
      let show = false;
      if (en.state !== 'dead' && isActive()) {
        tmpV.set(en.pos.x, 2.12, en.pos.z).sub(camera.position);
        const dist = tmpV.length();
        tmpV.divideScalar(dist);
        const cosA = tmpV.dot(tmpDir);
        if (cosA > 0.2 && dist < 110) {
          show = en.hurtT < 5 || (cosA > 0.9985 && dist < 90);
          if (show) {
            tmpV.set(en.pos.x, 2.12, en.pos.z).project(camera);
            el.style.transform = 'translate(' + ((tmpV.x * 0.5 + 0.5) * window.innerWidth).toFixed(1) + 'px,' + ((-tmpV.y * 0.5 + 0.5) * window.innerHeight).toFixed(1) + 'px)';
            el.lastChild.firstChild.style.width = Math.round((en.hp / en.maxHp) * 100) + '%';
          }
        }
      }
      if (el.hidden === show) el.hidden = !show;
    });
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
    setText(ui.money, 'money', econ.money.toLocaleString('de-DE'));
    setText(ui.dmgTotal, 'dmg', econ.damage.toLocaleString('de-DE'));
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
    } else if (state.lookSlot) {
      p = '<kbd>E</kbd> Skin-Automat benutzen <span>· ' + SR.SPIN_COST + ' Taler pro Dreh</span>';
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
      setPaused(true);
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
    } else if (state.started && !state.fallback && !state.inSlot) {
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
    if (state.inSlot) {
      if ((e.code === 'Escape' || e.code === 'KeyE') && !slotUI.spinning) {
        e.preventDefault();
        closeSlot();
      }
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    if (!isActive()) return;
    // Strg+Taste soll im Spiel keine Browser-Kürzel auslösen (z. B. Strg+S, Strg+D)
    if (e.ctrlKey) e.preventDefault();
    state.keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') toggleProne();
    else if (e.code === 'KeyE') {
      const lw = lookAtWeapon();
      if (lw) equip(lw);
      else if (lookAtSlot()) openSlot();
    }
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
    if (Math.hypot(x - slotMachine.x, z - slotMachine.z) < slotMachine.radius + 0.3) return true;
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

    // Lebensleiste: langsam nachwachsen, wenn man eine Weile nicht getroffen wurde; nach dem Fallen wieder aufstehen
    if (state.dead) {
      state.deadT += dt;
      if (state.deadT > 4.2) respawnPlayer();
    } else if (clock - state.lastHurt > 6 && state.hp < state.maxHp && state.started && !state.paused) {
      state.hp = Math.min(state.maxHp, state.hp + 7 * dt);
    }
    state.hurtFlash = Math.max(0, state.hurtFlash - dt * 1.6);

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

    // Bogen / Armbrust: Linksklick gedrückt halten = spannen, loslassen = schießen
    if (w && d.type === 'bow') {
      const v = w.view;
      const canDraw = active && state.equipT >= 1 && !stanceChanging;
      if (state.trigger && canDraw && !state.drawing && clock >= state.nextShot) {
        state.drawing = true;
        state.draw = 0;
        state.drawHold = 0;
        SR.sound.bowDraw();
        if (v.setArrowVisible) v.setArrowVisible(true);
      }
      if (state.drawing) {
        state.draw = Math.min(1, state.draw + dt / (d.drawTime || 0.8));
        if (state.draw >= 1) state.drawHold += dt;
        if (!state.trigger || !canDraw) {
          state.drawing = false;
          if (canDraw && state.draw >= 0.3) {
            releaseArrow(w, state.draw);
            state.draw = 0;
            if (v.setArrowVisible) v.setArrowVisible(false); // Pfeil ist weg, bis neu aufgelegt wird
          }
        }
      } else {
        state.draw = Math.max(0, state.draw - dt * 5);
        if (v.setArrowVisible && clock >= state.nextShot) v.setArrowVisible(true);
      }
      if (v.setDraw) v.setDraw(state.draw);
    } else {
      state.drawing = false;
      state.draw = 0;
    }

    while (w && d.type !== 'bow' && active && state.trigger && !stanceChanging && state.equipT >= 1 && clock >= state.nextShot && burst < 3) {
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
    if (state.drawing && state.draw >= 1) {
      // Arm zittert, wenn man den Bogen lange gespannt hält
      const tr = Math.min(1, state.drawHold / 2.5) * proneSteady();
      swayP += Math.sin(clock * 9) * 0.0016 * tr;
      swayY += Math.sin(clock * 7.3) * 0.002 * tr;
    }
    // Hinlegen / Aufstehen (Strg)
    state.stance = approach(state.stance, state.prone ? 1 : 0, dt / PRONE_TIME);
    const st = smooth(state.stance);
    const midway = Math.sin(Math.PI * st); // 1 mitten in der Bewegung
    state.pos.y = world.padTop + lerp(EYE, EYE_PRONE, st);
    camera.position.copy(state.pos);
    camera.position.y -= midway * 0.06;
    const fall = state.dead ? smooth(Math.min(1, state.deadT / 0.9)) : 0; // Spieler kippt um
    camera.position.y -= fall * Math.max(0, state.pos.y - world.padTop - 0.22);
    camera.rotation.set(
      clamp(state.pitch + state.recoilPitch + swayP, -1.55, 1.55),
      state.yaw + state.recoilYaw + swayY,
      midway * 0.07 + fall * 1.1
    );
    camera.updateMatrixWorld();

    // Was liegt im Blick?
    const look = active ? lookAtWeapon() : null;
    if (look !== state.looking) {
      if (state.looking) state.looking.outline.visible = false;
      if (look) look.outline.visible = true;
      state.looking = look;
    }
    state.lookSlot = active && !look ? lookAtSlot() : false;

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
      if (v.bolt || v.pump || v.cycle) w.boltT = Math.min(1, w.boltT + dt / (d.interval - 0.05));
      // Waffen mit eigener Durchlade-Animation (z. B. Unterhebelrepetierer)
      if (v.cycle) {
        v.cycle(w.boltT);
        if (!w.ejected && w.boltT >= 0.4) {
          w.ejected = true;
          if (d.shell && v.eject) ejectShell(w);
        }
        if (w.boltT < 1) g.rotation.z = Math.sin(Math.PI * clamp((w.boltT - 0.1) / 0.7, 0, 1)) * 0.12 * (1 - e);
      }
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
    if (state.started && !state.paused && !state.inSlot && !state.dead) {
      enemies.update(dt, clock);
      projectiles.update(dt);
    }
    fx.update(dt);
    world.update(clock);
    slotMachine.update(clock, dt);
    checkRound();
    econSaveT += dt;
    if (econDirty && econSaveT > 2) {
      econSaveT = 0;
      saveEcon();
    }
    if (!state.slotHint && !econ.usedSlot && econ.money >= SR.SPIN_COST && isActive() && stats.hits > 0) {
      state.slotHint = true;
      toast('Du hast ' + econ.money + ' Taler! Hinten links auf dem Platz steht der Skin-Automat.', 5);
    }
    updateHud(e);
    updateVitals();

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
      .sort((a, b) => (a.secret ? 1 : 0) - (b.secret ? 1 : 0) || b.rpm - a.rpm)
      .forEach((d) => {
        const li = document.createElement('li');
        if (d.secret) {
          li.className = 'secret';
          li.innerHTML =
            '<span class="n">???</span><span class="k">Geheimwaffe · nur am Skin-Automaten (' + SR.fmtChance(SR.secretWeaponChance()) + ')</span>' +
            '<span class="bar"><i style="width:0"></i></span><span class="v">?</span>';
        } else {
          li.innerHTML =
            '<span class="n">' + d.name + '</span><span class="k">' + d.kind + '</span>' +
            '<span class="bar"><i style="width:' + Math.round((d.rpm / maxRpm) * 100) + '%"></i></span>' +
            '<span class="v">' + d.rpm + '<small> /min</small></span>';
        }
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
    econ,
    openSlot,
    closeSlot,
    slotUI,
    equipSkin,
    weaponIcon,
    unlockWeapon,
    enemies,
    projectiles,
    hurtPlayer,
    respawnPlayer,
    layoutHome,
    start() {
      state.started = true;
      state.fallback = true;
      setPaused(false);
    },
  };
})();
