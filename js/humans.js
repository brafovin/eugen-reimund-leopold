// Menschen-Modell für die Gegner: Körper aus abgerundeten Formen, Kleidung je nach Waffe, Laufanimation,
// Arme per Zwei-Knochen-IK an der Waffe, Fall-Animation. Der Mensch schaut nach -Z (wie die Waffenmodelle).
(function () {
  'use strict';
  const SR = (window.SR = window.SR || {});
  const V3 = THREE.Vector3;
  const UP = new V3(0, 1, 0);

  // Haltepunkte der Waffen (Modellkoordinaten): grip = Schusshand, fore = Stützhand, butt = Schulteranlage
  SR.HOLD = {
    c96: { grip: [0, 0.01, 0.045], fore: null, butt: null, stance: 'pistol' },
    revolver: { grip: [0, -0.02, 0.035], fore: null, butt: null, stance: 'pistol' },
    g36: { grip: [0, -0.04, 0.072], fore: [0, 0.0, -0.32], butt: [0, 0.01, 0.41], stance: 'rifle' },
    kr86: { grip: [0, -0.02, 0.1], fore: [0, 0.01, -0.34], butt: [0, -0.06, 0.41], stance: 'rifle' },
    birdshot: { grip: [0, 0.01, 0.09], fore: [0, 0.005, -0.2], butt: [0, -0.06, 0.43], stance: 'rifle' },
    sg21: { grip: [0, -0.06, 0.12], fore: [0, 0.0, -0.26], butt: [0, -0.016, 0.375], stance: 'rifle' },
  };

  // ---- Kleidung ----
  const OUTFITS = {
    gangster: { skin: 0xdcae8c, top: 0x2c2b33, shirt: 0xe8e3d4, legs: 0x202026, boots: 0x18120f, hat: 'fedora', hatColor: 0x27252c, tie: 0x9b1c1c },
    cowboy: { skin: 0xc58b64, top: 0x7b4b27, shirt: 0xb3402c, legs: 0x3f5877, boots: 0x4b2d1a, hat: 'cowboy', hatColor: 0x8d6b3a, scarf: 0xb3202a },
    soldier: { skin: 0xd3a07c, top: 'flecktarn', shirt: 'flecktarn', legs: 'flecktarn', boots: 0x1d1a15, hat: 'helmet', hatColor: 0x56603a, vest: 0x2f3524 },
    sniper: { skin: 0xc9966f, top: 'waldtarn', shirt: 'waldtarn', legs: 'waldtarn', boots: 0x2a2418, hat: 'boonie', hatColor: 0x4d5a33, mask: 0x3b4630 },
    hunter: { skin: 0xd8a582, top: 0x5b4a30, shirt: 0xd9741a, legs: 0x39432d, boots: 0x3d2c1a, hat: 'cap', hatColor: 0x39432d, vest: 0xe2701a },
    lumberjack: { skin: 0xd09878, top: 'plaid', shirt: 'plaid', legs: 0x2f4864, boots: 0x3b2a1c, hat: 'beanie', hatColor: 0xa2231d, beard: 0x4b2d1a },
    archer: { skin: 0xd5a07a, top: 0x4a6b3a, shirt: 0x4a6b3a, legs: 0x5a4630, boots: 0x3b2a1c, hat: 'hood', hatColor: 0x3d5a30, quiver: true },
    bandit: { skin: 0xc58b64, top: 0x26262b, shirt: 0x34343c, legs: 0x24242a, boots: 0x15110e, hat: 'bandana', hatColor: 0x8d1f1f },
    rancher: { skin: 0xd09878, top: 0x6b5a3e, shirt: 0x9aa7b3, legs: 0x4b5c70, boots: 0x4a3322, hat: 'cowboy', hatColor: 0x5b4429, scarf: 0x3d5a8a },
  };
  SR.OUTFITS = Object.keys(OUTFITS);

  // ---- gemeinsame Geometrien und Materialien ----
  const GEO = {};
  const geo = (k, make) => GEO[k] || (GEO[k] = make());
  const MATS = {};
  const TEXS = {};
  function fabric(spec, rough) {
    const k = typeof spec === 'string' ? spec : spec + ':' + rough;
    if (MATS[k]) return MATS[k];
    let m;
    if (typeof spec === 'string') {
      if (!TEXS[spec]) {
        if (spec === 'flecktarn') TEXS[spec] = SR.tex.flecktarn();
        else if (spec === 'waldtarn') TEXS[spec] = SR.tex.camo(['#4b5a33', '#2c3a22', '#6d6a42', '#1f1f17'], 9, { count: 70, minR: 6, maxR: 18 });
        else TEXS[spec] = SR.tex.plaid(['#a3201b', '#1a1a1a', '#d33b2c']);
        TEXS[spec].repeat.set(1.2, 1.2);
      }
      m = new THREE.MeshStandardMaterial({ map: TEXS[spec], roughness: 0.9 });
    } else {
      m = new THREE.MeshStandardMaterial({ color: spec, roughness: rough == null ? 0.88 : rough });
    }
    MATS[k] = m;
    return m;
  }
  const BLACK = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.5 });
  const WHITE = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 });
  const LEATHER = new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.7 });

  // ---- Zwei-Knochen-IK ----
  const _d = new V3();
  const _dir = new V3();
  const _perp = new V3();
  const _q = new THREE.Quaternion();
  function solveArm(S, T, a, b, pole, elbow, hand) {
    _d.subVectors(T, S);
    let d = _d.length();
    const maxd = a + b - 0.003;
    if (d > maxd) {
      _d.multiplyScalar(maxd / d);
      d = maxd;
    }
    if (d < Math.abs(a - b) + 0.02) {
      d = Math.abs(a - b) + 0.02;
      if (_d.lengthSq() < 1e-8) _d.set(0, 0, -1);
      _d.normalize().multiplyScalar(d);
    }
    _dir.copy(_d).normalize();
    const x = (a * a - b * b + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, a * a - x * x));
    _perp.copy(pole).addScaledVector(_dir, -pole.dot(_dir));
    if (_perp.lengthSq() < 1e-6) _perp.set(0, -1, 0);
    _perp.normalize();
    elbow.copy(S).addScaledVector(_dir, x).addScaledVector(_perp, h);
    hand.copy(S).add(_d);
  }
  const _m = new V3();
  function span(mesh, A, B) {
    mesh.position.addVectors(A, B).multiplyScalar(0.5);
    _m.subVectors(B, A).normalize();
    mesh.quaternion.setFromUnitVectors(UP, _m);
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);

  SR.buildHuman = function (opts) {
    const def = opts.def;
    const O = OUTFITS[opts.outfit] || OUTFITS.gangster;
    const built = def.build();
    const hold = built.grip ? { grip: built.grip, fore: built.fore || null, butt: built.butt || null, stance: built.stance || 'pistol' } : SR.HOLD[def.id];
    const isBow = hold.stance === 'bow';

    const root = new THREE.Group(); // Position und Blickrichtung (setzt die KI)
    const body = new THREE.Group(); // fällt beim Tod um
    root.add(body);
    const hitParts = [];
    const shadowParts = [];
    const skinM = fabric(O.skin, 0.7);
    const topM = fabric(O.top);
    const shirtM = fabric(O.shirt);
    const legM = fabric(O.legs);
    const bootM = fabric(O.boots, 0.6);

    function mesh(parent, g, m, x, y, z, part) {
      const o = new THREE.Mesh(g, m);
      o.position.set(x || 0, y || 0, z || 0);
      o.castShadow = true;
      if (part) {
        o.userData.part = part;
        hitParts.push(o);
      }
      parent.add(o);
      return o;
    }
    const rbox = (w, h, d, r) => geo('rb' + [w, h, d, r], () => SR.mk.roundedBoxGeo(w, h, d, r));
    const caps = (r, len) => geo('cap' + r + ':' + len, () => new THREE.CapsuleGeometry(r, len, 4, 10));
    const sph = (r, ws, hs) => geo('sph' + r, () => new THREE.SphereGeometry(r, ws || 14, hs || 10));

    // --- Beine ---
    const legs = [-1, 1].map((side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.095, 0.96, 0);
      body.add(hip);
      mesh(hip, caps(0.07, 0.31), legM, 0, -0.22, 0, 'limb');
      const knee = new THREE.Group();
      knee.position.set(0, -0.44, 0);
      hip.add(knee);
      mesh(knee, sph(0.058), legM, 0, 0, 0);
      mesh(knee, caps(0.054, 0.325), legM, 0, -0.215, 0, 'limb');
      const foot = mesh(knee, rbox(0.105, 0.09, 0.28, 0.028), bootM, 0, -0.475, -0.05, 'limb');
      return { hip, knee, foot };
    });

    // --- Becken, Brust ---
    mesh(body, rbox(0.35, 0.17, 0.21, 0.04), legM, 0, 0.97, 0, 'body');
    const belt = mesh(body, rbox(0.365, 0.045, 0.222, 0.015), LEATHER, 0, 1.03, 0);
    belt.userData.part = null;
    const chest = new THREE.Group();
    chest.position.set(0, 1.03, 0);
    body.add(chest);
    mesh(chest, rbox(0.38, 0.46, 0.215, 0.06), topM, 0, 0.22, 0, 'body');
    if (O.shirt !== O.top && !(typeof O.top === 'string')) {
      // Hemd schaut unter der Jacke hervor
      mesh(chest, rbox(0.14, 0.36, 0.02, 0.01), shirtM, 0, 0.26, -0.108);
    }
    if (O.vest) mesh(chest, rbox(0.4, 0.36, 0.23, 0.05), fabric(O.vest), 0, 0.22, 0);
    if (O.tie) mesh(chest, rbox(0.04, 0.26, 0.012, 0.005), fabric(O.tie), 0, 0.28, -0.118);
    if (O.scarf) mesh(chest, new THREE.TorusGeometry(0.065, 0.026, 8, 16), fabric(O.scarf), 0, 0.46, -0.01).rotation.x = Math.PI / 2;
    if (opts.outfit === 'soldier') mesh(chest, rbox(0.3, 0.34, 0.1, 0.03), fabric(O.vest), 0, 0.24, 0.15); // Rucksack
    if (O.quiver) {
      const q = mesh(chest, new THREE.CylinderGeometry(0.05, 0.045, 0.55, 12), LEATHER, 0.1, 0.3, 0.17);
      q.rotation.z = -0.25;
      for (let i = 0; i < 4; i++) mesh(q, new THREE.CylinderGeometry(0.004, 0.004, 0.18, 6), fabric(0xcaa86a), (i - 1.5) * 0.018, 0.32, 0);
    }

    // --- Hals und Kopf ---
    mesh(chest, new THREE.CylinderGeometry(0.045, 0.05, 0.1, 10), skinM, 0, 0.5, 0);
    const head = new THREE.Group();
    head.position.set(0, 0.62, 0);
    chest.add(head);
    const skull = mesh(head, sph(0.105, 18, 14), skinM, 0, 0, 0, 'head');
    skull.scale.set(0.95, 1.12, 1);
    const eyeM = new THREE.MeshStandardMaterial({ color: 0x15110f, roughness: 0.4 });
    [-1, 1].forEach((s) => {
      const e = mesh(head, sph(0.012, 8, 6), eyeM, s * 0.038, 0.018, -0.097);
      e.castShadow = false;
      const brow = mesh(head, rbox(0.045, 0.01, 0.01, 0.004), fabric(0x3a2a1c), s * 0.038, 0.043, -0.099);
      brow.castShadow = false;
    });
    mesh(head, sph(0.019, 8, 6), skinM, 0, -0.012, -0.107).castShadow = false;
    mesh(head, rbox(0.04, 0.008, 0.01, 0.003), fabric(0x7a3b30), 0, -0.05, -0.098).castShadow = false;
    [-1, 1].forEach((s) => mesh(head, sph(0.02, 8, 6), skinM, s * 0.097, 0, 0.0));
    if (O.beard) mesh(head, rbox(0.12, 0.075, 0.07, 0.03), fabric(O.beard), 0, -0.07, -0.062);

    // Hüte und Helme
    const hatM = fabric(O.hatColor);
    const hatTop = 0.085;
    if (O.hat === 'fedora') {
      mesh(head, new THREE.CylinderGeometry(0.095, 0.1, 0.1, 16), hatM, 0, hatTop + 0.035, 0);
      mesh(head, new THREE.CylinderGeometry(0.17, 0.17, 0.012, 20), hatM, 0, hatTop - 0.012, 0);
      mesh(head, new THREE.CylinderGeometry(0.1, 0.1, 0.022, 16), fabric(0x111114), 0, hatTop + 0.0, 0);
    } else if (O.hat === 'cowboy') {
      mesh(head, new THREE.CylinderGeometry(0.075, 0.095, 0.11, 16), hatM, 0, hatTop + 0.04, 0);
      const brim = mesh(head, new THREE.CylinderGeometry(0.2, 0.2, 0.01, 22), hatM, 0, hatTop - 0.012, 0);
      brim.scale.set(1, 1, 1.12);
    } else if (O.hat === 'helmet') {
      const h = mesh(head, new THREE.SphereGeometry(0.125, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hatM, 0, 0.012, 0.005);
      h.scale.set(0.97, 1.0, 1.05);
      mesh(head, new THREE.CylinderGeometry(0.11, 0.115, 0.014, 18), hatM, 0, 0.03, -0.03).scale.set(1, 1, 1.15);
    } else if (O.hat === 'boonie') {
      mesh(head, new THREE.CylinderGeometry(0.16, 0.16, 0.008, 20), hatM, 0, hatTop - 0.005, 0);
      mesh(head, new THREE.CylinderGeometry(0.095, 0.108, 0.07, 16), hatM, 0, hatTop + 0.028, 0);
      mesh(head, rbox(0.17, 0.075, 0.12, 0.03), fabric(O.mask), 0, -0.055, -0.04); // Gesichtstuch
    } else if (O.hat === 'cap') {
      const c = mesh(head, new THREE.SphereGeometry(0.112, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hatM, 0, 0.03, 0);
      c.scale.set(0.97, 0.95, 1.02);
      mesh(head, rbox(0.15, 0.01, 0.1, 0.004), hatM, 0, 0.042, -0.14);
    } else if (O.hat === 'beanie') {
      const b = mesh(head, sph(0.115, 14, 10), hatM, 0, 0.045, 0.005);
      b.scale.set(0.97, 0.78, 1.02);
      mesh(head, new THREE.TorusGeometry(0.1, 0.014, 8, 16), hatM, 0, 0.034, 0).rotation.x = Math.PI / 2;
      mesh(head, sph(0.03, 8, 6), hatM, 0, 0.12, 0);
    } else if (O.hat === 'hood') {
      const hd = mesh(head, sph(0.128, 16, 12), hatM, 0, 0.012, 0.025);
      hd.scale.set(1, 1.08, 1.05);
      mesh(chest, new THREE.CylinderGeometry(0.1, 0.13, 0.1, 12), hatM, 0, 0.5, 0.01);
    } else if (O.hat === 'bandana') {
      mesh(head, new THREE.CylinderGeometry(0.108, 0.108, 0.04, 16), hatM, 0, 0.065, 0.0).scale.set(0.97, 1, 1.04);
      mesh(head, rbox(0.19, 0.075, 0.13, 0.03), hatM, 0, -0.06, -0.035); // Tuch vor dem Gesicht
    }

    // --- Arme (IK) ---
    const ARM_A = 0.27;
    const ARM_B = 0.26;
    const arms = [-1, 1].map((side) => {
      const shoulder = new V3(side * 0.215, 0.4, 0.0);
      mesh(chest, sph(0.058), topM, shoulder.x, shoulder.y, shoulder.z);
      const up = mesh(chest, caps(0.047, 0.176), topM, 0, 0, 0, 'limb');
      const lo = mesh(chest, caps(0.041, 0.178), typeof O.top === 'string' ? topM : shirtM, 0, 0, 0, 'limb');
      const hand = mesh(chest, sph(0.043), O.hat === 'helmet' || opts.outfit === 'sniper' ? fabric(0x2a2a22) : skinM, 0, 0, 0, 'limb');
      return { side, shoulder, up, lo, hand, elbow: new V3(), hpos: new V3(), target: new V3(), pole: new V3(side * 0.6, -1, 0.35) };
    });

    // --- Waffe ---
    const weapon = built.group;
    weapon.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
    chest.add(weapon);
    const wq = new THREE.Quaternion();
    const wo = new V3();
    const tmp = new V3();
    const tmp2 = new V3();
    const euler = new THREE.Euler();

    // Stützhand an Pistolen: neben dem Griff
    const gripV = new V3().fromArray(hold.grip);
    const foreV = hold.fore ? new V3().fromArray(hold.fore) : new V3(-0.032, -0.012, 0.004).add(gripV);
    const buttV = hold.butt ? new V3().fromArray(hold.butt) : null;

    let phase = Math.random() * 6.28;
    let breath = Math.random() * 6.28;
    const state = { speed: 0, aim: 0, pitch: 0, kick: 0, draw: 0, dead: 0, flinch: 0 };

    function pose() {
      const a = smooth(state.aim);
      euler.set(lerp(hold.stance === 'pistol' ? -0.55 : -0.9, state.pitch, a) - state.dead * 0.5, 0, 0, 'XYZ');
      wq.setFromEuler(euler);
      if (isBow) {
        // linke Hand hält den Bogen, rechte zieht die Sehne
        tmp.set(lerp(-0.12, -0.1, a), lerp(0.1, 0.43, a), lerp(-0.2, -0.5, a));
        wo.copy(tmp).sub(tmp2.copy(gripV).applyQuaternion(wq));
        wo.z += state.kick * 0.02;
        weapon.position.copy(wo);
        weapon.quaternion.copy(wq);
        if (built.setDraw) built.setDraw(state.draw);
        arms[0].target.copy(tmp);
        weapon.updateMatrix();
        const nockLocal = built.nock ? built.nock.position : new V3(0, 0.05, 0.12);
        arms[1].target.copy(nockLocal).applyMatrix4(weapon.matrix);
        if (state.aim < 0.5) arms[1].target.set(0.17, 0.14, -0.08);
        return;
      }
      if (hold.stance === 'pistol' || !buttV) {
        tmp.set(lerp(0.13, 0.085, a), lerp(0.2, 0.46, a), lerp(-0.3, -0.5, a));
        tmp.z += state.kick * 0.035;
        wo.copy(tmp).sub(tmp2.copy(gripV).applyQuaternion(wq));
        weapon.position.copy(wo);
        weapon.quaternion.copy(wq);
        arms[1].target.copy(tmp);
        arms[0].target.copy(foreV).applyQuaternion(wq).add(wo);
      } else {
        tmp.set(lerp(0.17, 0.155, a), lerp(0.28, 0.41, a), lerp(-0.1, -0.075, a));
        tmp.z += state.kick * 0.045;
        wo.copy(tmp).sub(tmp2.copy(buttV).applyQuaternion(wq));
        weapon.position.copy(wo);
        weapon.quaternion.copy(wq);
        arms[1].target.copy(gripV).applyQuaternion(wq).add(wo);
        arms[0].target.copy(foreV).applyQuaternion(wq).add(wo);
      }
    }

    function update(dt) {
      const s = state;
      breath += dt * 1.6;
      const moving = Math.min(1, s.speed / 1.3);
      phase += dt * s.speed * 4.2;
      const swing = Math.sin(phase) * 0.55 * moving;
      const swing2 = Math.sin(phase + Math.PI) * 0.55 * moving;
      const bend = (p) => 0.85 * Math.max(0, Math.cos(p)) * moving;
      legs[0].hip.rotation.x = swing;
      legs[1].hip.rotation.x = swing2;
      legs[0].knee.rotation.x = -bend(phase);
      legs[1].knee.rotation.x = -bend(phase + Math.PI);
      const dead = smooth(s.dead);
      if (dead > 0) {
        legs[0].hip.rotation.x = lerp(legs[0].hip.rotation.x, 0.2, dead);
        legs[1].hip.rotation.x = lerp(legs[1].hip.rotation.x, -0.15, dead);
        legs[1].knee.rotation.x = lerp(legs[1].knee.rotation.x, -0.5, dead);
      }
      chest.position.y = 1.03 + Math.abs(Math.sin(phase)) * 0.018 * moving + Math.sin(breath) * 0.003;
      chest.rotation.y = lerp(0, 0.18, smooth(s.aim)) + Math.sin(phase) * 0.06 * moving;
      chest.rotation.x = s.flinch * 0.25 - dead * 0.1;
      pose();
      weapon.updateMatrixWorld(false);
      // Arme per IK
      arms.forEach((arm) => {
        solveArm(arm.shoulder, arm.target, ARM_A, ARM_B, arm.pole, arm.elbow, arm.hpos);
        span(arm.up, arm.shoulder, arm.elbow);
        span(arm.lo, arm.elbow, arm.hpos);
        arm.hand.position.copy(arm.hpos);
      });
      // Fall: um die Füße nach hinten kippen
      body.rotation.x = dead * (Math.PI / 2);
      body.position.y = dead * 0.1;
    }

    const wmuzzle = built.muzzle;
    return {
      root,
      body,
      head,
      chest,
      hitParts,
      weapon,
      built,
      def,
      state,
      update,
      muzzleWorld(out) {
        return wmuzzle.getWorldPosition(out);
      },
      headWorld(out) {
        return head.getWorldPosition(out);
      },
    };
  };
})();
