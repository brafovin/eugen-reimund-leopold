// Die vier Waffen: Werte (Kadenz, Streuung, Rückstoß …) und 3D-Modelle aus Grundkörpern.
// Modell-Koordinaten: Lauf zeigt nach -Z, oben ist +Y, Maßstab in Metern.
(function () {
  'use strict';
  const SR = (window.SR = window.SR || {});

  let M = null;
  function mats() {
    if (M) return M;
    const walnut = SR.tex.wood([118, 66, 34], 4, 128);
    walnut.repeat.set(3, 3);
    const walnutDark = SR.tex.wood([80, 44, 22], 6, 128);
    const beech = SR.tex.wood([160, 102, 56], 8, 256);
    beech.repeat.set(4, 4);
    M = {
      steel: new THREE.MeshStandardMaterial({ color: 0x30343b, metalness: 0.85, roughness: 0.36 }),
      steelDark: new THREE.MeshStandardMaterial({ color: 0x1a1c20, metalness: 0.8, roughness: 0.48 }),
      steelBright: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.95, roughness: 0.25 }),
      black: new THREE.MeshBasicMaterial({ color: 0x050505 }),
      walnut: new THREE.MeshStandardMaterial({ map: walnut, roughness: 0.5 }),
      walnutDark: new THREE.MeshStandardMaterial({ map: walnutDark, roughness: 0.6 }),
      beech: new THREE.MeshStandardMaterial({ map: beech, roughness: 0.48 }),
      polymer: new THREE.MeshStandardMaterial({ color: 0x26282b, roughness: 0.72, metalness: 0.05 }),
      polymerDark: new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.8, metalness: 0.05 }),
      polymerDS: new THREE.MeshStandardMaterial({ color: 0x1d1e20, roughness: 0.8, metalness: 0.05, side: THREE.DoubleSide }),
      magazine: new THREE.MeshStandardMaterial({ color: 0x4a3e30, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.78 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xcaa047, metalness: 1, roughness: 0.28 }),
      lens: new THREE.MeshStandardMaterial({ color: 0x3d6aa8, metalness: 1, roughness: 0.05, transparent: true, opacity: 0.6 }),
      lensDark: new THREE.MeshStandardMaterial({ color: 0x0b1018, metalness: 1, roughness: 0.1 }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.95 }),
    };
    return M;
  }

  // ---- kleine Bau-Helfer ----
  function add(parent, m, x, y, z) {
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function box(w, h, d, mat, x, y, z, parent) {
    return add(parent, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z);
  }
  // Zylinder entlang Z; rFront zeigt nach vorne (-Z)
  function cylZ(rFront, rBack, len, mat, x, y, z, parent, seg, open) {
    const geo = new THREE.CylinderGeometry(rFront, rBack, len, seg || 16, 1, !!open);
    geo.rotateX(-Math.PI / 2);
    return add(parent, new THREE.Mesh(geo, mat), x, y, z);
  }
  function cylY(rTop, rBot, len, mat, x, y, z, parent, seg) {
    return add(parent, new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, seg || 16), mat), x, y, z);
  }
  function cylX(r, len, mat, x, y, z, parent, seg) {
    const geo = new THREE.CylinderGeometry(r, r, len, seg || 12);
    geo.rotateZ(Math.PI / 2);
    return add(parent, new THREE.Mesh(geo, mat), x, y, z);
  }
  function ringZ(r, tube, mat, x, y, z, parent) {
    return add(parent, new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 28), mat), x, y, z);
  }
  // Abzugsbügel: Halbkreis unten in der YZ-Ebene
  function guard(r, tube, mat, y, z, parent) {
    const geo = new THREE.TorusGeometry(r, tube, 6, 18, Math.PI);
    geo.rotateZ(Math.PI);
    geo.rotateY(Math.PI / 2);
    return add(parent, new THREE.Mesh(geo, mat), 0, y, z);
  }
  // Seitenprofil (u = nach vorne, v = nach oben) als extrudierter Körper der Breite width
  function profile(points, width, mat, bevel, parent) {
    const s = new THREE.Shape();
    s.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
    const b = bevel || 0;
    const depth = width - 2 * b;
    const geo = new THREE.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: b > 0,
      bevelThickness: b,
      bevelSize: b,
      bevelSegments: 2,
      curveSegments: 4,
    });
    geo.translate(0, 0, -depth / 2);
    geo.rotateY(Math.PI / 2);
    return add(parent, new THREE.Mesh(geo, mat), 0, 0, 0);
  }
  function point(parent, x, y, z) {
    const o = new THREE.Object3D();
    return add(parent, o, x, y, z);
  }

  // ---- Mauser C96 ----
  function buildC96() {
    const m = mats();
    const g = new THREE.Group();
    box(0.026, 0.036, 0.165, m.steel, 0, 0.068, -0.0175, g); // Gehäuse
    box(0.0275, 0.018, 0.09, m.steelDark, 0, 0.066, -0.03, g); // Fräsungen an der Seite
    cylZ(0.0082, 0.0098, 0.145, m.steel, 0, 0.074, -0.1725, g); // Lauf
    cylZ(0.0092, 0.0092, 0.006, m.steelDark, 0, 0.074, -0.242, g);
    cylZ(0.0034, 0.0034, 0.002, m.black, 0, 0.074, -0.2455, g); // Mündung
    box(0.027, 0.052, 0.054, m.steel, 0, 0.025, -0.071, g); // Magazinkasten vor dem Abzug
    box(0.029, 0.005, 0.058, m.steelDark, 0, -0.0015, -0.071, g);
    guard(0.017, 0.0026, m.steel, 0.05, -0.026, g);
    const trig = box(0.005, 0.018, 0.005, m.steelBright, 0, 0.041, -0.028, g);
    trig.rotation.x = 0.25;
    box(0.024, 0.014, 0.04, m.steel, 0, 0.046, 0.045, g); // Griffstück-Rahmen

    // Besenstiel-Griff mit Rillen
    const grip = new THREE.Group();
    grip.position.set(0, 0.002, 0.042);
    grip.rotation.x = -0.32;
    g.add(grip);
    cylY(0.0155, 0.018, 0.1, m.walnut, 0, 0, 0, grip, 18).scale.x = 0.85;
    for (let i = 0; i < 9; i++) {
      const y = -0.04 + i * 0.01;
      const r = 0.0155 + ((0.05 - y) / 0.1) * 0.0025 + 0.0003;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0011, 4, 22), m.walnutDark);
      ring.rotation.x = Math.PI / 2;
      ring.scale.set(0.85, 1, 1);
      add(grip, ring, 0, y, 0);
    }
    const pom = add(grip, new THREE.Mesh(new THREE.SphereGeometry(0.0182, 16, 10), m.walnut), 0, -0.05, 0);
    pom.scale.set(0.85, 0.5, 1);
    const lan = add(grip, new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0012, 5, 12), m.steel), 0, -0.058, 0.012);
    lan.rotation.y = Math.PI / 2;

    // Hahn, Verschluss, Visier
    const ham = box(0.008, 0.018, 0.008, m.steelDark, 0, 0.082, 0.07, g);
    ham.rotation.x = 0.35;
    ringZ(0.005, 0.0018, m.steelDark, 0, 0.089, 0.076, g).rotation.y = Math.PI / 2;
    box(0.02, 0.008, 0.035, m.steelBright, 0, 0.09, 0.045, g);
    box(0.014, 0.006, 0.03, m.steel, 0, 0.089, -0.06, g); // Tangentenvisier-Sockel
    box(0.0035, 0.006, 0.006, m.steel, -0.0045, 0.094, -0.05, g); // Kimme
    box(0.0035, 0.006, 0.006, m.steel, 0.0045, 0.094, -0.05, g);
    box(0.0024, 0.016, 0.008, m.steel, 0, 0.089, -0.232, g); // Korn

    return {
      group: g,
      muzzle: point(g, 0, 0.074, -0.25),
      eject: point(g, 0.006, 0.095, 0.03),
      sightY: 0.097,
    };
  }

  // ---- Double-Action-Revolver ----
  function buildRevolver() {
    const m = mats();
    const g = new THREE.Group();
    cylZ(0.0085, 0.0085, 0.11, m.steel, 0, 0.058, -0.105, g); // Lauf
    cylZ(0.0035, 0.0035, 0.002, m.black, 0, 0.058, -0.1605, g);
    box(0.013, 0.013, 0.1, m.steel, 0, 0.0475, -0.105, g); // Ausstoßerstangen-Mantel
    box(0.007, 0.006, 0.11, m.steel, 0, 0.067, -0.105, g); // Schiene
    box(0.003, 0.014, 0.012, m.steel, 0, 0.072, -0.152, g); // Korn
    box(0.022, 0.009, 0.056, m.steel, 0, 0.0705, -0.022, g); // Rahmen oben
    box(0.024, 0.04, 0.008, m.steel, 0, 0.048, -0.046, g);
    box(0.026, 0.016, 0.06, m.steel, 0, 0.02, -0.018, g);
    box(0.026, 0.06, 0.016, m.steel, 0, 0.045, 0.012, g); // Stoßboden
    box(0.003, 0.004, 0.01, m.steel, -0.004, 0.077, 0.0, g); // Kimme
    box(0.003, 0.004, 0.01, m.steel, 0.004, 0.077, 0.0, g);

    // Trommel mit 6 Kammern – dreht sich bei jedem Schuss
    const cyl = new THREE.Group();
    cyl.position.set(0, 0.046, -0.022);
    g.add(cyl);
    cylZ(0.019, 0.019, 0.04, m.steel, 0, 0, 0, cyl, 24);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + Math.PI / 6;
      const f = box(0.0045, 0.004, 0.028, m.steelDark, Math.cos(a) * 0.0182, Math.sin(a) * 0.0182, 0, cyl);
      f.rotation.z = a;
      const b = (i * Math.PI) / 3 + Math.PI / 2;
      cylZ(0.0046, 0.0046, 0.002, m.black, Math.cos(b) * 0.0115, Math.sin(b) * 0.0115, -0.0201, cyl, 10);
      cylZ(0.0032, 0.0032, 0.003, m.brass, Math.cos(b) * 0.0115, Math.sin(b) * 0.0115, -0.0195, cyl, 10);
    }
    cylZ(0.004, 0.004, 0.004, m.steelBright, 0, 0, -0.021, cyl, 10);

    // Hahn
    const hammer = new THREE.Group();
    hammer.position.set(0, 0.058, 0.022);
    hammer.rotation.x = 0.25;
    g.add(hammer);
    box(0.007, 0.024, 0.01, m.steelDark, 0, 0.006, 0, hammer);
    box(0.009, 0.004, 0.014, m.steelDark, 0, 0.018, 0.006, hammer).rotation.x = 0.3;

    guard(0.016, 0.0028, m.steel, 0.012, -0.012, g);
    box(0.005, 0.016, 0.005, m.steelBright, 0, 0.003, -0.014, g).rotation.x = 0.3;

    const grip = new THREE.Group();
    grip.position.set(0, -0.03, 0.03);
    grip.rotation.x = -0.42;
    g.add(grip);
    cylY(0.0175, 0.0205, 0.085, m.walnut, 0, 0, 0, grip, 20).scale.x = 0.78;
    const cap = add(grip, new THREE.Mesh(new THREE.SphereGeometry(0.0205, 16, 8), m.walnut), 0, -0.0425, 0);
    cap.scale.set(0.78, 0.35, 1);
    cylX(0.005, 0.034, m.brass, 0, 0.018, 0, grip, 14); // Medaillons
    box(0.006, 0.08, 0.008, m.steel, 0, 0.004, 0.017, grip); // Griffrücken

    return {
      group: g,
      muzzle: point(g, 0, 0.058, -0.166),
      cylinder: cyl,
      hammer,
      sightY: 0.079,
    };
  }

  // ---- G36 ----
  function buildG36() {
    const m = mats();
    const g = new THREE.Group();
    box(0.05, 0.06, 0.36, m.polymer, 0, 0.03, -0.06, g); // Gehäuse
    box(0.044, 0.02, 0.36, m.polymer, 0, 0.07, -0.06, g);
    box(0.056, 0.06, 0.21, m.polymerDark, 0, 0.035, -0.345, g); // Handschutz
    for (let i = 0; i < 5; i++) box(0.058, 0.008, 0.022, m.black, 0, 0.042, -0.27 - i * 0.036, g);
    box(0.03, 0.03, 0.02, m.steelDark, 0, 0.04, -0.455, g);
    cylZ(0.0085, 0.0085, 0.13, m.steel, 0, 0.035, -0.515, g); // Lauf
    cylZ(0.012, 0.012, 0.045, m.steelDark, 0, 0.035, -0.6025, g, 12); // Mündungsfeuerdämpfer
    cylZ(0.006, 0.006, 0.002, m.black, 0, 0.035, -0.6255, g, 10);

    // Tragegriff mit Zieloptik
    box(0.006, 0.05, 0.03, m.polymer, -0.014, 0.105, -0.19, g);
    box(0.006, 0.05, 0.03, m.polymer, 0.014, 0.105, -0.19, g);
    box(0.034, 0.018, 0.29, m.polymer, 0, 0.139, -0.06, g);
    box(0.016, 0.014, 0.03, m.polymerDark, 0, 0.154, -0.12, g); // Rotpunkt-Gehäuse oben
    cylZ(0.021, 0.021, 0.085, m.polymerDS, 0, 0.105, 0.0425, g, 28, true); // Optik-Rohr (offen)
    box(0.02, 0.012, 0.07, m.polymer, 0, 0.127, 0.0425, g);
    box(0.02, 0.01, 0.07, m.polymer, 0, 0.083, 0.0425, g);
    ringZ(0.021, 0.0035, m.rubber, 0, 0.105, 0.086, g);
    ringZ(0.021, 0.0025, m.polymer, 0, 0.105, 0.0, g);
    const lens = add(g, new THREE.Mesh(new THREE.CircleGeometry(0.02, 24), m.lens), 0, 0.105, 0.0);
    lens.material = m.lens.clone();
    lens.material.opacity = 0.18;
    lens.material.depthWrite = false;
    box(0.008, 0.01, 0.03, m.polymerDark, 0.024, 0.07, -0.12, g); // Spannhebel

    // Pistolengriff, Abzug, Magazin
    const grip = new THREE.Group();
    grip.position.set(0, -0.045, 0.07);
    grip.rotation.x = -0.32;
    g.add(grip);
    box(0.03, 0.1, 0.042, m.polymer, 0, 0, 0, grip);
    box(0.014, 0.006, 0.075, m.polymer, 0, -0.032, 0.022, g);
    box(0.014, 0.034, 0.008, m.polymer, 0, -0.016, -0.014, g);
    box(0.005, 0.02, 0.005, m.steelDark, 0, -0.012, 0.018, g).rotation.x = 0.3;
    box(0.054, 0.02, 0.09, m.polymer, 0, -0.006, -0.09, g); // Magazinschacht
    profile(
      [
        [0.05, 0.0],
        [0.128, 0.0],
        [0.15, -0.09],
        [0.19, -0.2],
        [0.115, -0.215],
        [0.085, -0.11],
      ],
      0.028,
      m.magazine,
      0.002,
      g
    );

    // Klappschaft
    box(0.05, 0.075, 0.025, m.polymer, 0, 0.025, 0.13, g);
    box(0.036, 0.022, 0.27, m.polymer, 0, 0.056, 0.255, g);
    box(0.03, 0.018, 0.28, m.polymer, 0, -0.028, 0.255, g).rotation.x = 0.2;
    box(0.042, 0.145, 0.025, m.polymer, 0, 0.0, 0.4, g);
    box(0.044, 0.15, 0.008, m.rubber, 0, 0.0, 0.416, g);

    return {
      group: g,
      muzzle: point(g, 0, 0.035, -0.63),
      eject: point(g, 0.028, 0.055, -0.02),
      sightY: 0.105,
    };
  }

  // ---- KR86 (Repetierbüchse mit Zielfernrohr) ----
  function buildKR86() {
    const m = mats();
    const g = new THREE.Group();
    profile(
      [
        [-0.4, -0.125],
        [-0.405, 0.006],
        [-0.17, 0.022],
        [-0.085, 0.012],
        [-0.035, 0.03],
        [0.56, 0.03],
        [0.59, 0.02],
        [0.59, 0.002],
        [0.32, -0.014],
        [0.09, -0.028],
        [0.05, -0.046],
        [-0.035, -0.046],
        [-0.065, -0.036],
        [-0.105, -0.066],
        [-0.16, -0.078],
      ],
      0.042,
      m.beech,
      0.005,
      g
    );
    box(0.05, 0.14, 0.006, m.steelDark, 0, -0.06, 0.412, g).rotation.x = -0.02; // Schaftkappe
    cylZ(0.0075, 0.0105, 0.77, m.steel, 0, 0.042, -0.405, g); // Lauf
    cylZ(0.0034, 0.0034, 0.002, m.black, 0, 0.042, -0.7905, g, 10);
    cylZ(0.0125, 0.0135, 0.28, m.beech, 0, 0.042, -0.34, g); // Handschutz
    [-0.3, -0.5].forEach((z) => {
      const band = ringZ(0.024, 0.0035, m.steel, 0, 0.018, z, g);
      band.scale.y = 1.5;
    });
    box(0.03, 0.04, 0.03, m.steel, 0, 0.022, -0.585, g); // Nasenkappe
    box(0.012, 0.022, 0.02, m.steelDark, 0, 0.056, -0.765, g); // Kornsattel

    // Verschlussgehäuse und Kammerstängel (bewegt sich beim Repetieren)
    cylZ(0.0145, 0.0145, 0.19, m.steel, 0, 0.046, -0.025, g, 18);
    cylZ(0.0165, 0.0165, 0.035, m.steel, 0, 0.046, -0.1, g, 18);
    const bolt = new THREE.Group();
    bolt.position.set(0, 0.046, 0);
    g.add(bolt);
    cylZ(0.0095, 0.0095, 0.1, m.steelBright, 0, 0, 0.05, bolt);
    cylZ(0.011, 0.011, 0.03, m.steel, 0, 0, 0.105, bolt);
    box(0.004, 0.012, 0.008, m.steel, 0, 0.012, 0.112, bolt); // Sicherungsflügel
    const handle = new THREE.Group();
    handle.position.set(0, 0, 0.065);
    handle.rotation.z = -0.55;
    bolt.add(handle);
    cylX(0.0035, 0.05, m.steelBright, 0.025, 0, 0, handle, 10);
    add(handle, new THREE.Mesh(new THREE.SphereGeometry(0.0085, 14, 10), m.steelBright), 0.052, 0, 0);

    guard(0.019, 0.003, m.steel, -0.044, 0.0, g);
    box(0.024, 0.004, 0.035, m.steel, 0, -0.048, -0.035, g); // Bodenblech
    box(0.004, 0.018, 0.005, m.steelBright, 0, -0.052, 0.004, g).rotation.x = 0.3;

    // Zielfernrohr
    [-0.075, 0.035].forEach((z) => {
      box(0.012, 0.035, 0.016, m.steelDark, 0, 0.075, z, g);
      ringZ(0.0135, 0.003, m.steelDark, 0, 0.105, z, g);
    });
    cylZ(0.0125, 0.0125, 0.25, m.steelDark, 0, 0.105, -0.04, g, 24);
    cylZ(0.022, 0.0125, 0.06, m.steelDark, 0, 0.105, -0.195, g, 24);
    cylZ(0.022, 0.022, 0.035, m.steelDark, 0, 0.105, -0.2425, g, 24);
    const front = add(g, new THREE.Mesh(new THREE.CircleGeometry(0.019, 24), m.lens), 0, 0.105, -0.2605);
    front.rotation.y = Math.PI;
    cylZ(0.0125, 0.017, 0.03, m.steelDark, 0, 0.105, 0.1, g, 24);
    cylZ(0.017, 0.017, 0.04, m.steelDark, 0, 0.105, 0.135, g, 24);
    ringZ(0.017, 0.003, m.rubber, 0, 0.105, 0.155, g);
    add(g, new THREE.Mesh(new THREE.CircleGeometry(0.015, 24), m.lensDark), 0, 0.105, 0.1555);
    cylY(0.009, 0.009, 0.02, m.steelDark, 0, 0.125, -0.03, g);
    cylX(0.009, 0.02, m.steelDark, 0.02, 0.105, -0.03, g);

    return {
      group: g,
      muzzle: point(g, 0, 0.042, -0.8),
      eject: point(g, 0.02, 0.06, 0.03),
      bolt,
      sightY: 0.105,
    };
  }

  // Kadenz: C96 am schnellsten, dann Revolver, dann G36, KR86 am langsamsten.
  SR.WEAPON_DEFS = [
    {
      id: 'c96',
      name: 'Mauser C96',
      short: 'C96',
      kind: 'Selbstladepistole',
      interval: 0.065,
      hipPos: [0.15, -0.15, -0.46],
      adsZ: -0.42,
      adsFov: 58,
      vmAdsFov: 46,
      adsTime: 0.16,
      hipSpread: 0.022,
      adsSpread: 0.0045,
      bloom: 0.0035,
      maxBloom: 0.03,
      recoil: 0.011,
      recoilYaw: 0.006,
      recover: 7,
      kickBack: 0.03,
      kickRot: 0.09,
      sound: { crack: 3200, body: 2600, decay: 0.14, thump: 170, gain: 0.5, echo: 0.3 },
      shell: { r: 0.0042, len: 0.02, up: 1.6, side: 0.4 },
      holeR: 0.009,
      build: buildC96,
    },
    {
      id: 'revolver',
      name: 'Double-Action-Revolver',
      short: 'Revolver',
      kind: 'Revolver · 6 Kammern',
      interval: 0.15,
      hipPos: [0.15, -0.145, -0.44],
      adsZ: -0.42,
      adsFov: 56,
      vmAdsFov: 46,
      adsTime: 0.16,
      hipSpread: 0.018,
      adsSpread: 0.003,
      bloom: 0.006,
      maxBloom: 0.03,
      recoil: 0.035,
      recoilYaw: 0.01,
      recover: 8,
      kickBack: 0.05,
      kickRot: 0.32,
      sound: { crack: 2400, body: 1500, decay: 0.32, thump: 110, gain: 0.85, echo: 0.6 },
      shell: null,
      holeR: 0.01,
      build: buildRevolver,
    },
    {
      id: 'g36',
      name: 'G36',
      short: 'G36',
      kind: 'Sturmgewehr mit Zieloptik',
      interval: 0.21,
      hipPos: [0.14, -0.2, -0.3],
      adsZ: -0.2,
      adsFov: 26,
      vmAdsFov: 40,
      adsTime: 0.22,
      scope: 'ring',
      hipSpread: 0.016,
      adsSpread: 0.0012,
      bloom: 0.003,
      maxBloom: 0.02,
      recoil: 0.014,
      recoilYaw: 0.006,
      recover: 9,
      kickBack: 0.035,
      kickRot: 0.05,
      sound: { crack: 3600, body: 2200, decay: 0.22, thump: 130, gain: 0.7, echo: 0.5 },
      shell: { r: 0.0045, len: 0.03, up: 0.8, side: 1.4 },
      holeR: 0.007,
      build: buildG36,
    },
    {
      id: 'kr86',
      name: 'KR86',
      short: 'KR86',
      kind: 'Repetierer mit Zielfernrohr',
      interval: 1.15,
      hipPos: [0.14, -0.2, -0.34],
      adsZ: -0.32,
      adsFov: 12,
      vmAdsFov: 40,
      adsTime: 0.3,
      scope: 'zf',
      hipSpread: 0.03,
      adsSpread: 0,
      bloom: 0,
      maxBloom: 0,
      recoil: 0.06,
      recoilYaw: 0.012,
      recover: 5,
      kickBack: 0.07,
      kickRot: 0.12,
      sound: { crack: 2600, body: 1150, decay: 0.55, thump: 80, gain: 1.0, echo: 0.9 },
      shell: { r: 0.005, len: 0.045, up: 1.0, side: 1.2, delay: 0.45 },
      holeR: 0.007,
      build: buildKR86,
    },
  ];
  SR.WEAPON_DEFS.forEach((d) => {
    d.rpm = Math.round(60 / d.interval);
  });

  // Mündungsfeuer (wird an die Mündung gehängt)
  let flashTex = null;
  SR.makeMuzzleFlash = function (size) {
    if (!flashTex) flashTex = SR.tex.flash();
    const grp = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      map: flashTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    grp.add(front);
    for (let i = 0; i < 2; i++) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.7, size * 1.8), mat);
      side.rotation.order = 'ZYX';
      side.rotation.x = Math.PI / 2;
      side.rotation.z = (i * Math.PI) / 2;
      side.position.z = -size * 0.7;
      grp.add(side);
    }
    grp.visible = false;
    grp.renderOrder = 10;
    return grp;
  };
})();
