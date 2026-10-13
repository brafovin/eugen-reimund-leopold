// Weitere Waffen: Jagdbogen (mit Armbrust-Variante), P-9, UZ-9, Büffeljäger, Handkanone .50 und Sägewerk MG.
// Modell-Koordinaten wie in weapons.js: Lauf/Schussrichtung -Z, oben +Y, Maßstab in Metern.
// Alle Waffen hängen an der Waffenwand (wall: true) und werden hier an SR.WEAPON_DEFS angehängt.
(function () {
  'use strict';
  const SR = (window.SR = window.SR || {});
  const { mats, add, box, cylZ, cylY, cylX, ringZ, point, roundedBoxGeo } = SR.mk;
  const PI = Math.PI;
  const V3 = THREE.Vector3;

  // ---------------------------------------------------------------
  // Zusätzliche Materialien (Rollen für Skins: siehe skins.js)
  // ---------------------------------------------------------------
  let X = null;
  function mx() {
    if (X) return X;
    const base = mats();
    const role = (mat, r) => {
      mat.userData.role = r;
      return mat;
    };
    X = Object.assign({}, base, {
      leather: role(new THREE.MeshStandardMaterial({ color: 0x5a3822, roughness: 0.82, metalness: 0 }), 'leather'),
      leatherDark: role(new THREE.MeshStandardMaterial({ color: 0x35210f, roughness: 0.85, metalness: 0 }), 'leather'),
      string: role(new THREE.MeshStandardMaterial({ color: 0xe9e0c8, roughness: 0.9, metalness: 0 }), 'string'),
      serving: role(new THREE.MeshStandardMaterial({ color: 0x9c2a22, roughness: 0.8, metalness: 0 }), 'string'),
      fletch: role(new THREE.MeshStandardMaterial({ color: 0xc8352b, roughness: 0.75, side: THREE.DoubleSide }), 'fletch'),
      fletchCock: role(new THREE.MeshStandardMaterial({ color: 0xf0e9d5, roughness: 0.75, side: THREE.DoubleSide }), 'fletch'),
      shaft: role(new THREE.MeshStandardMaterial({ color: 0xcfa56a, roughness: 0.5, metalness: 0 }), 'wood'),
      nockPlastic: new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.45, metalness: 0 }),
      copper: new THREE.MeshStandardMaterial({ color: 0xb4693a, roughness: 0.35, metalness: 0.9 }),
      bladeSteel: role(new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.95, roughness: 0.25, side: THREE.DoubleSide }), 'metalBright'),
      dotWhite: new THREE.MeshBasicMaterial({ color: 0xf2f2e6 }),
      dotGreen: new THREE.MeshBasicMaterial({ color: 0x9cff7a }),
      dotOrange: new THREE.MeshBasicMaterial({ color: 0xff8a1f }),
    });
    const ct = checkerTex('#80502c', '#2c170b', 8);
    ct.repeat.set(2.2, 4.8);
    X.checkWood = role(new THREE.MeshStandardMaterial({ map: ct, roughness: 0.5 }), 'wood');
    return X;
  }

  // ---------------------------------------------------------------
  // Bau-Helfer
  // ---------------------------------------------------------------
  function rbox(w, h, d, r, mat, x, y, z, parent) {
    return add(parent, new THREE.Mesh(roundedBoxGeo(w, h, d, r), mat), x, y, z);
  }
  function ball(r, mat, x, y, z, parent, sx, sy, sz) {
    const s = add(parent, new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat), x, y, z);
    if (sx != null) s.scale.set(sx, sy, sz);
    return s;
  }
  // Drehteil entlang Z: pts = [[Radius, z], ...] (Punkte werden von hinten nach vorne sortiert)
  function turned(pts, mat, x, y, z, parent, seg) {
    const sorted = pts.slice().sort((a, b) => b[1] - a[1]);
    const geo = new THREE.LatheGeometry(
      sorted.map((p) => new THREE.Vector2(p[0], -p[1])),
      seg || 20
    );
    geo.rotateX(-PI / 2);
    return add(parent, new THREE.Mesh(geo, mat), x, y, z);
  }
  // Kegelstumpf/Zylinder zwischen zwei Punkten (rB am Ende b)
  const _yUp = new V3(0, 1, 0);
  const _dir = new V3();
  function between(a, b, rA, rB, mat, parent, seg) {
    _dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rB, rA, len, seg || 8, 1), mat);
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    m.quaternion.setFromUnitVectors(_yUp, _dir.normalize());
    parent.add(m);
    return m;
  }
  // Röhre entlang einer Kurve
  function tubeAlong(pts, r, mat, parent, o) {
    o = o || {};
    const curve = new THREE.CatmullRomCurve3(
      pts.map((p) => new V3(p[0], p[1], p[2])),
      !!o.closed,
      'centripetal'
    );
    const geo = new THREE.TubeGeometry(curve, o.segs || pts.length * 8, r, o.radial || 8, !!o.closed);
    return add(parent, new THREE.Mesh(geo, mat), 0, 0, 0);
  }
  // Ecken eines Polygons verrunden. Punkte [a, b, r?]; r = 0 lässt die Ecke scharf.
  function fillet(pts, r0, segs) {
    segs = segs || 4;
    const n = pts.length;
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const a = pts[(i + n - 1) % n];
      const b = pts[(i + 1) % n];
      const r = p.length > 2 && p[2] != null ? p[2] : r0;
      if (!r) {
        out.push([p[0], p[1]]);
        continue;
      }
      const d1 = Math.hypot(a[0] - p[0], a[1] - p[1]);
      const d2 = Math.hypot(b[0] - p[0], b[1] - p[1]);
      const t = Math.min(r, d1 * 0.5, d2 * 0.5);
      const ax = p[0] + ((a[0] - p[0]) / d1) * t;
      const ay = p[1] + ((a[1] - p[1]) / d1) * t;
      const bx = p[0] + ((b[0] - p[0]) / d2) * t;
      const by = p[1] + ((b[1] - p[1]) / d2) * t;
      for (let k = 0; k <= segs; k++) {
        const u = k / segs;
        const w0 = (1 - u) * (1 - u);
        const w1 = 2 * u * (1 - u);
        const w2 = u * u;
        out.push([w0 * ax + w1 * p[0] + w2 * bx, w0 * ay + w1 * p[1] + w2 * by]);
      }
    }
    return out;
  }
  // Seitenprofil in Modellkoordinaten: Punkte [z, y, r?], extrudiert über die Breite width (in X).
  // o: { r: Standard-Rundung, bevel, holes: [[[z,y,r?],...]], x: Verschiebung in X, segs }
  function side(pts, width, mat, parent, o) {
    o = o || {};
    const b = o.bevel != null ? o.bevel : 0.0016;
    const mk = (arr, rr) =>
      fillet(
        arr.map((p) => [-p[0], p[1], p[2]]),
        rr,
        o.segs || 4
      ).map((p) => new THREE.Vector2(p[0], p[1]));
    const shape = new THREE.Shape(mk(pts, o.r || 0));
    (o.holes || []).forEach((h) => shape.holes.push(new THREE.Path(mk(h, o.hr != null ? o.hr : o.r || 0))));
    const depth = Math.max(0.0004, width - 2 * b);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: b > 0,
      bevelThickness: b,
      bevelSize: b,
      bevelOffset: -b,
      bevelSegments: 2,
      curveSegments: 3,
    });
    geo.translate(0, 0, -depth / 2);
    geo.rotateY(PI / 2);
    return add(parent, new THREE.Mesh(geo, mat), o.x || 0, 0, 0);
  }
  // Schraubenkopf mit Schlitz; dir = +1 rechte Seite (+X), -1 linke Seite
  function screw(parent, x, y, z, r, dir, ang, mat) {
    const m = mx();
    const h = cylX(r, r * 0.6, mat || m.steelBright, x, y, z, parent, 10);
    const s = box(r * 0.3, r * 1.7, r * 0.3, m.black, x + dir * r * 0.3, y, z, parent);
    s.rotation.x = ang || 0;
    return h;
  }
  // Reihe dünner Rillen/Rippen (quer zur Z-Achse) auf einer Seitenfläche
  function ribsZ(parent, mat, x, y, h, z0, dz, n, w, d) {
    for (let i = 0; i < n; i++) box(w, h, d, mat, x, y, z0 + i * dz, parent);
  }
  // Noppenfeld (Griffbeschichtung): versetzte Reihen kleiner Erhebungen auf einer Seitenfläche
  function stipple(parent, mat, x, y0, z0, rows, cols, dy, dz, r) {
    for (let i = 0; i < rows; i++) {
      for (let k = 0; k < cols; k++) {
        cylX(r, r * 0.55, mat, x, y0 - i * dy, z0 + k * dz + (i % 2) * dz * 0.5, parent, 7);
      }
    }
  }
  // Rautenmuster (Griffschalen) als Canvas-Textur
  function checkerTex(base, line, cells) {
    const S = 128;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    // feine Maserung
    const rnd = SR.rng ? SR.rng(77) : Math.random;
    for (let i = 0; i < 260; i++) {
      g.fillStyle = 'rgba(0,0,0,' + (0.02 + rnd() * 0.05) + ')';
      g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 3, 1);
    }
    const step = S / cells;
    g.strokeStyle = line;
    g.lineWidth = 2;
    for (let i = -cells; i <= cells * 2; i++) {
      g.beginPath();
      g.moveTo(i * step, 0);
      g.lineTo(i * step + S, S);
      g.stroke();
      g.beginPath();
      g.moveTo(i * step, 0);
      g.lineTo(i * step - S, S);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = SR.maxAniso || 4;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // Statische Teile eines Modells zu wenigen Meshes (je Material eins) zusammenfassen: spart Draw-Calls.
  // Gruppen/Meshes mit userData.dynamic = true (bewegte Teile) bleiben unberührt.
  function bake(root) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const m4 = new THREE.Matrix4();
    const n3 = new THREE.Matrix3();
    const v = new V3();
    const buckets = new Map();
    const doomed = [];
    root.traverse((o) => {
      if (!o.isMesh || o.userData.dynamic) return;
      for (let p = o.parent; p && p !== root; p = p.parent) if (p.userData.dynamic) return;
      const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      if (!geo.attributes.normal) geo.computeVertexNormals();
      let b = buckets.get(o.material);
      if (!b) {
        b = { pos: [], nor: [], uv: [] };
        buckets.set(o.material, b);
      }
      m4.multiplyMatrices(inv, o.matrixWorld);
      n3.getNormalMatrix(m4);
      const flip = m4.determinant() < 0;
      const pa = geo.attributes.position;
      const na = geo.attributes.normal;
      const ua = geo.attributes.uv;
      const order = [0, 1, 2];
      for (let i = 0; i < pa.count; i += 3) {
        for (let k = 0; k < 3; k++) {
          const j = i + (flip ? [0, 2, 1][k] : order[k]);
          v.fromBufferAttribute(pa, j).applyMatrix4(m4);
          b.pos.push(v.x, v.y, v.z);
          v.fromBufferAttribute(na, j).applyMatrix3(n3).normalize();
          b.nor.push(v.x, v.y, v.z);
          if (ua) b.uv.push(ua.getX(j), ua.getY(j));
          else b.uv.push(0, 0);
        }
      }
      doomed.push(o);
    });
    doomed.forEach((o) => {
      o.parent.remove(o);
      o.geometry.dispose();
    });
    buckets.forEach((b, mat) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      root.add(new THREE.Mesh(geo, mat));
    });
  }

  // ---------------------------------------------------------------
  // P-9 (Selbstladepistole, Kunststoffrahmen)
  // ---------------------------------------------------------------
  function buildP9() {
    const m = mx();
    const g = new THREE.Group();
    const SW = 0.0262; // Schlittenbreite

    // Schlitten mit abgeschrägter Front
    side(
      [
        [0.072, 0.0, 0],
        [0.072, 0.0282, 0.004],
        [0.068, 0.031, 0.0025],
        [-0.086, 0.031, 0.0025],
        [-0.098, 0.0268, 0.004],
        [-0.098, 0.0, 0],
      ],
      SW,
      m.steel,
      g,
      { bevel: 0.0019 }
    );
    // Schlittenrücken leicht gewölbt (Oberseite)
    cylZ(0.0108, 0.0108, 0.152, m.steel, 0, 0.0205, -0.0125, g, 18).scale.set(1, 0.38, 1);
    // Griffrillen hinten und vorn (beidseitig)
    [-1, 1].forEach((s) => {
      ribsZ(g, m.steelDark, s * (SW / 2 + 0.0001), 0.0155, 0.0195, 0.046, 0.0035, 7, 0.0004, 0.0016);
      ribsZ(g, m.steelDark, s * (SW / 2 + 0.0001), 0.0155, 0.0195, -0.079, 0.0035, 4, 0.0004, 0.0016);
    });
    // Auswurffenster rechts, mit Patronenlager und Auszieher
    box(0.0007, 0.0165, 0.05, m.black, SW / 2 + 0.0001, 0.0178, 0.003, g);
    rbox(0.0009, 0.0062, 0.026, 0.0004, m.steel, SW / 2 + 0.0003, 0.0128, 0.0105, g);
    rbox(0.0009, 0.0036, 0.016, 0.0004, m.steelBright, SW / 2 + 0.0004, 0.0155, 0.0115, g);
    box(0.0013, 0.0034, 0.0075, m.brass, SW / 2 + 0.0002, 0.0258, 0.0275, g); // Zeigerstift: Patrone im Lager
    // Beschriftung (graviert) links und rechts
    box(0.0004, 0.0032, 0.034, m.steel, SW / 2 + 0.00005, 0.0075, -0.052, g);
    box(0.0004, 0.0032, 0.034, m.steel, -SW / 2 - 0.00005, 0.0075, -0.052, g);

    // Mündung: Lauf ragt etwas aus dem Schlitten, Federführung darunter
    cylZ(0.0054, 0.0054, 0.006, m.steelBright, 0, 0.0158, -0.0985, g, 18);
    cylZ(0.0036, 0.0036, 0.0008, m.black, 0, 0.0158, -0.1018, g, 14);
    ringZ(0.0062, 0.0011, m.steelDark, 0, 0.0158, -0.0982, g);
    cylZ(0.0028, 0.0028, 0.005, m.steelBright, 0, 0.0052, -0.0958, g, 10);

    // Dreipunkt-Visier: Kimme hinten (Rinne), Korn vorn, je mit weißem Punkt
    const sh = 0.0361;
    box(0.0128, 0.0016, 0.0085, m.steelDark, 0, 0.0318, 0.0585, g);
    [-1, 1].forEach((s) => {
      box(0.0046, 0.0052, 0.0085, m.steelDark, s * 0.0041, 0.0335, 0.0585, g);
      cylZ(0.00095, 0.00095, 0.0004, m.dotWhite, s * 0.0041, 0.0345, 0.0629, g, 10);
    });
    box(0.0029, 0.0054, 0.0052, m.steelDark, 0, 0.0337, -0.0845, g);
    cylZ(0.00105, 0.00105, 0.0004, m.dotWhite, 0, 0.0343, -0.0818, g, 10);
    box(0.0058, 0.0016, 0.012, m.steelDark, 0, 0.0318, -0.0845, g); // Sockel

    // Rahmen: Schienenpartie vorn, Mittelstück unter dem Schlitten, Abzugsbügel
    rbox(0.0252, 0.0148, 0.047, 0.003, m.polymer, 0, -0.0066, -0.0695, g);
    rbox(0.0252, 0.0148, 0.108, 0.003, m.polymer, 0, -0.0066, 0.0035, g);
    for (let i = 0; i < 2; i++) box(0.0236, 0.0012, 0.0045, m.black, 0, -0.0138, -0.082 + i * 0.012, g); // Zubehörnuten
    side(
      [
        [-0.0475, -0.0125, 0],
        [-0.0475, -0.0305, 0.007],
        [-0.0415, -0.04, 0.007],
        [0.0085, -0.04, 0.004],
        [0.0085, -0.0125, 0],
      ],
      0.0238,
      m.polymer,
      g,
      {
        bevel: 0.0014,
        holes: [
          [
            [-0.0435, -0.0125, 0],
            [-0.0435, -0.0295, 0.005],
            [-0.0385, -0.0366, 0.005],
            [0.0045, -0.0366, 0.0025],
            [0.0045, -0.0125, 0],
          ],
        ],
      }
    );
    // Abzug
    const trig = box(0.0042, 0.0195, 0.0046, m.polymerDark, 0, -0.0235, 0.0005, g);
    trig.rotation.x = 0.3;
    box(0.0014, 0.012, 0.002, m.steelBright, 0, -0.0215, -0.0022, g).rotation.x = 0.3; // Abzugszunge
    // Schlittenfang links und rechts, Haltestift, Magazinhalter
    [-1, 1].forEach((s) => {
      const x = s * 0.0135;
      box(0.0026, 0.0042, 0.034, m.steelDark, x, -0.0035, 0.0125, g).rotation.x = -0.05;
      cylX(0.0028, 0.0028, m.steelBright, s * 0.0127, -0.0046, -0.0145, g, 12);
      cylX(0.0024, 0.0018, m.steelDark, s * 0.0133, -0.0145, 0.0155, g, 12);
    });
    box(0.0004, 0.0032, 0.04, m.steel, 0.0126, -0.0085, -0.0615, g); // Typenschild

    // Griff (Winkel nach hinten) mit Riffelung
    const grip = new THREE.Group();
    grip.position.set(0, -0.0135, 0.0285);
    grip.rotation.x = -0.3;
    g.add(grip);
    rbox(0.0298, 0.112, 0.038, 0.0055, m.polymer, 0, -0.056, 0, grip);
    rbox(0.0262, 0.098, 0.0345, 0.004, m.polymerDark, 0, -0.058, 0.0005, grip); // Kern zwischen den Seiten
    // Fingerrillen vorn, Rillen am Rückenriemen
    for (let i = 0; i < 3; i++) {
      rbox(0.0286, 0.0052, 0.0046, 0.0022, m.polymer, 0, -0.03 - i * 0.0185, -0.0198, grip);
      rbox(0.0252, 0.0016, 0.0016, 0.0006, m.black, 0, -0.0395 - i * 0.0185, -0.0192, grip);
    }
    for (let i = 0; i < 9; i++) {
      box(0.0262, 0.0014, 0.0012, m.polymerDark, 0, -0.026 - i * 0.0085, 0.0192, grip);
    }
    // Griffseiten: Raster aus kleinen Erhebungen
    [-1, 1].forEach((s) => {
      for (let r = 0; r < 12; r++) {
        for (let c = 0; c < 5; c++) {
          const dz = -0.0125 + c * 0.0062 + (r % 2) * 0.0031;
          if (dz > 0.0165) continue;
          cylX(0.0014, 0.0008, m.polymerDark, s * 0.01492, -0.022 - r * 0.0066, dz, grip, 7);
        }
      }
    });
    // Magazinboden und Fangring
    rbox(0.0306, 0.0105, 0.0415, 0.0035, m.polymerDark, 0, -0.1155, 0.002, grip);
    rbox(0.0284, 0.0016, 0.0372, 0.0008, m.steel, 0, -0.1105, 0.001, grip);
    const lan = add(grip, new THREE.Mesh(new THREE.TorusGeometry(0.0042, 0.0012, 6, 14), m.steelDark), 0, -0.108, 0.0215);
    lan.rotation.y = PI / 2;
    // Schrauben in den Griffschalen
    [-1, 1].forEach((s) => screw(g, s * 0.0133, 0.0015, 0.0555, 0.0023, s, 0.4));

    bake(g);
    return {
      group: g,
      muzzle: point(g, 0, 0.0158, -0.104),
      eject: point(g, 0.014, 0.019, 0.004),
      sightY: sh - 0.0006,
      grip: [0, -0.04, 0.062],
      fore: null,
      butt: null,
      stance: 'pistol',
    };
  }

  // ---------------------------------------------------------------
  // UZ-9 (Maschinenpistole, Blechgehäuse, ausgeklappte Drahtschulterstütze)
  // ---------------------------------------------------------------
  function buildUZ9() {
    const m = mx();
    const g = new THREE.Group();
    const bore = 0.034;

    // Gehäuse aus gepresstem Blech mit Sicken
    rbox(0.05, 0.06, 0.262, 0.0075, m.steel, 0, 0.03, -0.045, g);
    [-1, 1].forEach((s) => {
      [0.0125, 0.0485].forEach((y) => {
        const bead = cylZ(0.0019, 0.0019, 0.205, m.steelDark, s * 0.025, y, -0.06, g, 8);
        bead.scale.x = 0.6;
      });
      // Schrauben am hinteren Ende
      screw(g, s * 0.0252, 0.044, 0.073, 0.0024, s, 0.6);
      screw(g, s * 0.0252, 0.018, 0.073, 0.0024, s, 1.4);
      screw(g, s * 0.0252, 0.044, -0.158, 0.0024, s, 0.2);
    });
    // Oberdeckel mit Längsrillen
    rbox(0.043, 0.0068, 0.205, 0.0032, m.steelDark, 0, 0.0627, -0.0405, g);
    [-1, 1].forEach((s) => box(0.0016, 0.0008, 0.18, m.steel, s * 0.0125, 0.0664, -0.04, g));
    box(0.006, 0.0006, 0.125, m.black, 0, 0.0664, -0.03, g); // Schlitz des Spannschiebers
    // Hinterer Verschlussdeckel mit Federkappe
    rbox(0.048, 0.056, 0.011, 0.004, m.steelDark, 0, 0.03, 0.0895, g);
    cylZ(0.0125, 0.0125, 0.008, m.steel, 0, 0.03, 0.098, g, 20);
    cylZ(0.0075, 0.0075, 0.003, m.steelBright, 0, 0.03, 0.1035, g, 14);
    box(0.0014, 0.012, 0.002, m.black, 0, 0.03, 0.105, g);

    // Spannschieber (Rückholknauf) oben
    rbox(0.014, 0.005, 0.02, 0.002, m.steel, 0, 0.0675, -0.034, g);
    ball(0.0092, m.steelBright, 0, 0.0675, -0.034, g, 1, 0.55, 1.15);
    ringZ(0.0069, 0.0009, m.steelDark, 0, 0.0715, -0.034, g).rotation.x = PI / 2;

    // Auswurffenster rechts, Sicherungs- und Feuerwahlhebel links
    box(0.0007, 0.0185, 0.052, m.black, 0.0252, 0.041, -0.016, g);
    rbox(0.0009, 0.0062, 0.028, 0.0004, m.steel, 0.0255, 0.0345, -0.0135, g);
    rbox(0.0009, 0.0034, 0.017, 0.0004, m.steelBright, 0.0256, 0.0372, -0.0125, g);
    const sel = new THREE.Group();
    sel.position.set(-0.0258, 0.0125, 0.02);
    g.add(sel);
    cylX(0.0052, 0.0034, m.steelBright, 0, 0, 0, sel, 12);
    const lever = box(0.0028, 0.0042, 0.0225, m.steelDark, -0.0016, 0, -0.008, sel);
    lever.rotation.x = 0.25;

    // Visier: Klappkimme hinten, Korn mit Schutzohren vorn
    const hy = 0.0665; // Oberkante Deckel
    rbox(0.0215, 0.0035, 0.0185, 0.0012, m.steelDark, 0, hy + 0.0018, 0.064, g);
    [-1, 1].forEach((s) => {
      rbox(0.0068, 0.0108, 0.0042, 0.0013, m.steelDark, s * 0.0062, hy + 0.0088, 0.0655, g);
      cylZ(0.0009, 0.0009, 0.0004, m.dotWhite, s * 0.0062, hy + 0.0116, 0.0678, g, 10);
      cylX(0.0016, 0.004, m.steelBright, s * 0.0102, hy + 0.0022, 0.0625, g, 8);
    });
    box(0.0206, 0.0016, 0.0095, m.steelDark, 0, hy + 0.0007, 0.051, g).rotation.x = 0.0; // zweite (umgelegte) Kimme
    // vorderer Mündungsblock (Laufmutter) und Korn
    cylZ(0.0188, 0.0188, 0.034, m.steelDark, 0, bore, -0.1915, g, 22);
    ringZ(0.0189, 0.0017, m.steel, 0, bore, -0.178, g);
    ringZ(0.0189, 0.0017, m.steel, 0, bore, -0.207, g);
    const baseTop = bore + 0.0188;
    rbox(0.0268, 0.0086, 0.024, 0.002, m.steelDark, 0, baseTop + 0.0008, -0.1915, g);
    [-1, 1].forEach((s) => rbox(0.0032, 0.0196, 0.0105, 0.0012, m.steelDark, s * 0.0096, baseTop + 0.0153, -0.1915, g));
    rbox(0.0026, 0.0168, 0.0042, 0.001, m.steelDark, 0, baseTop + 0.0135, -0.1915, g);
    box(0.0014, 0.0032, 0.0004, m.dotOrange, 0, baseTop + 0.0206, -0.1892, g);

    // Lauf und Mündungsfeuerdämpfer
    cylZ(0.0087, 0.0087, 0.1, m.steel, 0, bore, -0.255, g, 16);
    cylZ(0.0108, 0.0108, 0.042, m.steelDark, 0, bore, -0.2935, g, 18);
    ringZ(0.0109, 0.0013, m.steelBright, 0, bore, -0.3135, g);
    ringZ(0.0109, 0.0013, m.steelBright, 0, bore, -0.275, g);
    for (let i = 0; i < 3; i++) {
      box(0.0055, 0.0012, 0.0052, m.black, 0, bore + 0.0105, -0.284 - i * 0.0095, g);
      box(0.0012, 0.0055, 0.0052, m.black, 0.0105, bore, -0.284 - i * 0.0095, g);
      box(0.0012, 0.0055, 0.0052, m.black, -0.0105, bore, -0.284 - i * 0.0095, g);
    }
    cylZ(0.0044, 0.0044, 0.002, m.black, 0, bore, -0.3148, g, 12);

    // Vordergriff (Griffstück unter dem Gehäuse)
    rbox(0.04, 0.034, 0.078, 0.01, m.polymer, 0, -0.016, -0.128, g);
    for (let i = 0; i < 7; i++) {
      [-1, 1].forEach((s) => box(0.0007, 0.024, 0.0026, m.polymerDark, s * 0.0203, -0.016, -0.156 + i * 0.0105, g));
    }
    rbox(0.034, 0.005, 0.082, 0.002, m.steelDark, 0, 0.0005, -0.128, g);

    // Abzugsbügel (Blech) und Abzug
    side(
      [
        [-0.068, 0.002, 0],
        [-0.068, -0.026, 0.01],
        [-0.05, -0.0425, 0.01],
        [-0.01, -0.0425, 0.006],
        [-0.0, -0.032, 0.004],
        [0.0, 0.002, 0],
      ],
      0.0085,
      m.steelDark,
      g,
      {
        bevel: 0.0013,
        holes: [
          [
            [-0.0625, 0.002, 0],
            [-0.0625, -0.0245, 0.007],
            [-0.0475, -0.0365, 0.007],
            [-0.0125, -0.0365, 0.004],
            [-0.0065, -0.028, 0.003],
            [-0.0065, 0.002, 0],
          ],
        ],
      }
    );
    const trig = box(0.0042, 0.019, 0.0048, m.steelBright, 0, -0.0185, -0.021, g);
    trig.rotation.x = 0.28;

    // Pistolengriff mit Magazin
    const grip = new THREE.Group();
    grip.position.set(0, 0.0, 0.024);
    grip.rotation.x = -0.1;
    g.add(grip);
    rbox(0.034, 0.092, 0.04, 0.007, m.polymer, 0, -0.042, 0, grip);
    for (let i = 0; i < 6; i++) {
      box(0.0302, 0.0013, 0.0012, m.polymerDark, 0, -0.012 - i * 0.0115, 0.0203, grip);
      box(0.0302, 0.0013, 0.0012, m.polymerDark, 0, -0.012 - i * 0.0115, -0.0203, grip);
    }
    [-1, 1].forEach((s) => {
      stipple(grip, m.polymerDark, s * 0.01715, -0.022, -0.0105, 8, 3, 0.0085, 0.0098, 0.0015);
      screw(grip, s * 0.0173, -0.007, 0.0, 0.0025, s, 0.5);
    });
    rbox(0.0195, 0.055, 0.0075, 0.003, m.steel, 0, -0.032, 0.0225, grip); // Griffsicherung
    // Magazin
    rbox(0.0272, 0.128, 0.0365, 0.0035, m.steelDark, 0, -0.145, 0.0005, grip);
    for (let i = 0; i < 7; i++) {
      [-1, 1].forEach((s) => box(0.0007, 0.0012, 0.0325, m.steel, s * 0.01375, -0.1 - i * 0.0155, 0.0005, grip));
    }
    rbox(0.0312, 0.008, 0.043, 0.0032, m.polymerDark, 0, -0.2115, 0.0015, grip);
    cylX(0.0034, 0.0042, m.steelBright, -0.0176, -0.0775, -0.012, grip, 10); // Magazinhalter

    // Drahtschulterstütze (ausgeklappt)
    [-1, 1].forEach((s) => {
      cylX(0.0036, 0.0075, m.steelBright, s * 0.0262, 0.018, 0.0835, g, 10); // Gelenkbolzen
      tubeAlong(
        [
          [s * 0.0222, 0.018, 0.0835],
          [s * 0.0235, 0.0178, 0.12],
          [s * 0.0235, 0.0155, 0.26],
          [s * 0.0235, 0.022, 0.37],
          [s * 0.0225, 0.03, 0.396],
        ],
        0.0035,
        m.steel,
        g,
        { segs: 30, radial: 8 }
      );
    });
    tubeAlong([[-0.0225, 0.03, 0.394], [-0.0252, 0.052, 0.397], [0.0252, 0.052, 0.397], [0.0225, 0.03, 0.394]], 0.0036, m.steel, g, { segs: 24, radial: 8 });
    tubeAlong(
      [
        [-0.0232, 0.0155, 0.19],
        [0, 0.0185, 0.19],
        [0.0232, 0.0155, 0.19],
      ],
      0.0028,
      m.steel,
      g,
      { segs: 8, radial: 6 }
    );
    rbox(0.052, 0.112, 0.0075, 0.004, m.steel, 0, 0.0, 0.4, g);
    rbox(0.05, 0.1, 0.0045, 0.002, m.rubber, 0, 0.0, 0.4053, g);
    box(0.046, 0.0014, 0.0015, m.steelBright, 0, 0.0545, 0.3955, g);

    bake(g);
    return {
      group: g,
      muzzle: point(g, 0, bore, -0.318),
      eject: point(g, 0.027, 0.045, -0.002),
      sightY: 0.0745,
      grip: [0, -0.04, 0.025],
      fore: [0, -0.016, -0.128],
      butt: [0, 0.0, 0.408],
      stance: 'smg',
    };
  }

  // ---------------------------------------------------------------
  // Büffeljäger (Unterhebelrepetierer im Western-Stil, Messinggehäuse)
  // ---------------------------------------------------------------
  // Achtkant-Lauf (flache Facetten, Fläche nach oben)
  function octZ(rFront, rBack, len, mat, x, y, z, parent) {
    let geo = new THREE.CylinderGeometry(rFront, rBack, len, 8, 1);
    geo.rotateY(PI / 8);
    geo.rotateX(-PI / 2);
    geo = geo.toNonIndexed();
    geo.computeVertexNormals();
    return add(parent, new THREE.Mesh(geo, mat), x, y, z);
  }
  const smoothstep = (t) => {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  };

  function buildLever() {
    const m = mx();
    const g = new THREE.Group();
    const bore = 0.036;

    // Lauf (achteckig, nach vorn dünner), Mündung, Röhrenmagazin
    octZ(0.0105, 0.0138, 0.545, m.steel, 0, bore, -0.3775, g);
    octZ(0.0112, 0.0112, 0.012, m.steelDark, 0, bore, -0.636, g);
    cylZ(0.0044, 0.0044, 0.0008, m.black, 0, bore, -0.6425, g, 12);
    cylZ(0.0078, 0.0078, 0.49, m.steelDark, 0, 0.0128, -0.36, g, 14);
    cylZ(0.0084, 0.0084, 0.006, m.steelBright, 0, 0.0128, -0.607, g, 14); // Magazinkappe
    ringZ(0.0079, 0.001, m.steelBright, 0, 0.0128, -0.611, g);
    // Vorderschaft aus Nussbaum mit Messingkappe
    rbox(0.034, 0.041, 0.292, 0.012, m.walnut, 0, 0.0158, -0.261, g);
    rbox(0.0365, 0.045, 0.0075, 0.0035, m.brass, 0, 0.0155, -0.4105, g);
    rbox(0.0345, 0.0042, 0.285, 0.0015, m.walnutDark, 0, 0.0345, -0.261, g); // Schattenfuge zum Lauf
    // Laufringe mit Riemenöse
    [-0.56, -0.345].forEach((z) => {
      rbox(0.032, 0.043, 0.011, 0.004, m.steel, 0, 0.0245, z, g);
      rbox(0.0328, 0.008, 0.0112, 0.002, m.steelDark, 0, 0.0445, z, g);
    });
    const loop = add(g, new THREE.Mesh(new THREE.TorusGeometry(0.0062, 0.0013, 6, 14), m.steelDark), 0, -0.0005, -0.345);
    loop.rotation.y = PI / 2;
    // Korn: Schwalbenschwanzfuß, Blatt, Messingperle
    rbox(0.0085, 0.0034, 0.013, 0.001, m.steelDark, 0, 0.0508, -0.6, g);
    rbox(0.0034, 0.0138, 0.0055, 0.0012, m.steelDark, 0, 0.0577, -0.6, g);
    ball(0.0022, m.brass, 0, 0.0652, -0.5985, g);
    // Leiterkimme auf dem Lauf
    const rsz = -0.19;
    rbox(0.0165, 0.0035, 0.044, 0.0012, m.steelDark, 0, 0.0512, rsz, g);
    [-1, 1].forEach((s) => {
      rbox(0.0024, 0.0225, 0.0065, 0.001, m.steelDark, s * 0.0075, 0.0617, rsz, g);
      rbox(0.0042, 0.0074, 0.0056, 0.0012, m.steelBright, s * 0.0036, 0.0668, rsz, g);
    });
    rbox(0.0165, 0.0018, 0.0058, 0.0008, m.steelBright, 0, 0.0603, rsz, g); // Kimmenleiste
    box(0.0148, 0.0024, 0.0262, m.steel, 0, 0.0538, rsz - 0.0045, g).rotation.x = 0.12; // Blattfeder
    cylX(0.0016, 0.0178, m.steelBright, 0, 0.0524, rsz + 0.019, g, 8);

    // Verschlussgehäuse (Messing) mit Zierkreisen, Ladeklappe, Schrauben
    rbox(0.034, 0.064, 0.206, 0.0075, m.brass, 0, 0.02, -0.0125, g);
    rbox(0.0366, 0.012, 0.19, 0.004, m.brass, 0, -0.008, -0.0125, g);
    [-1, 1].forEach((s) => {
      const x = s * 0.0171;
      [0.013, 0.0085].forEach((r) => {
        const c = add(g, new THREE.Mesh(new THREE.TorusGeometry(r, 0.0005, 5, 28), m.steelDark), x, 0.0235, 0.025);
        c.rotation.y = PI / 2;
      });
      screw(g, x, 0.046, -0.095, 0.0026, s, 0.4, m.steelDark);
      screw(g, x, 0.0, -0.095, 0.0026, s, 1.1, m.steelDark);
      screw(g, x, 0.046, 0.075, 0.0026, s, 0.9, m.steelDark);
      screw(g, x, 0.002, 0.075, 0.0026, s, 0.1, m.steelDark);
      screw(g, x, 0.022, 0.025, 0.0036, s, 0.7, m.steelBright);
    });
    // Ladeklappe rechts, Karabinerring links
    rbox(0.0026, 0.024, 0.034, 0.0022, m.steelDark, 0.0173, 0.016, -0.055, g);
    cylX(0.0022, 0.003, m.steelBright, 0.0188, 0.026, -0.0445, g, 8);
    box(0.0008, 0.0025, 0.022, m.black, 0.0187, 0.005, -0.055, g);
    rbox(0.0045, 0.009, 0.006, 0.0015, m.steelDark, -0.0187, 0.034, 0.043, g);
    const ring = add(g, new THREE.Mesh(new THREE.TorusGeometry(0.0125, 0.0014, 6, 20), m.steelDark), -0.0205, 0.017, 0.043);
    ring.rotation.y = PI / 2;
    // Deckel mit Auswurföffnung (gleitet beim Durchladen nach hinten)
    const slide = new THREE.Group();
    g.add(slide);
    rbox(0.0262, 0.0042, 0.108, 0.0016, m.steel, 0, 0.0535, -0.04, slide);
    box(0.0044, 0.0007, 0.098, m.steelDark, 0, 0.0558, -0.04, slide);
    rbox(0.0088, 0.006, 0.01, 0.0018, m.steelBright, 0, 0.0555, 0.0235, slide);
    box(0.012, 0.0014, 0.02, m.black, 0, 0.0522, -0.0015, g); // Öffnung (hinter dem Deckel sichtbar)
    // Hinterschaft-Zunge (Tang) und Hahn
    rbox(0.0104, 0.0046, 0.07, 0.0016, m.steel, 0, 0.0475, 0.126, g);
    cylY(0.0034, 0.0034, 0.0016, m.steelBright, 0, 0.0508, 0.145, g, 10);
    box(0.0007, 0.0006, 0.005, m.black, 0, 0.0518, 0.145, g);
    const hammer = new THREE.Group();
    hammer.position.set(0, 0.03, 0.088);
    g.add(hammer);
    side(
      [
        [-0.007, -0.004, 0.003],
        [-0.0035, 0.012, 0.004],
        [0.001, 0.026, 0.004],
        [0.012, 0.0285, 0.0035],
        [0.0215, 0.0235, 0.003],
        [0.0215, 0.0195, 0.0015],
        [0.0125, 0.0215, 0.0035],
        [0.0075, 0.011, 0.004],
        [0.006, -0.006, 0.004],
      ].map((q) => [q[0] * 1.2, q[1] * 1.2, q[2] * 1.2]),
      0.0088,
      m.steelBright,
      hammer,
      { bevel: 0.0012, segs: 3 }
    );
    for (let i = 0; i < 5; i++) box(0.009, 0.0016, 0.0016, m.steel, 0, 0.0285 - i * 0.0014, 0.0152 + i * 0.0024, hammer).rotation.x = -0.9;
    cylX(0.0046, 0.0125, m.steelBright, 0, 0, 0, hammer, 10);

    // Unterhebel (Schlaufe), schwingt beim Durchladen nach unten
    const lever = new THREE.Group();
    lever.position.set(0, -0.0125, 0.068);
    g.add(lever);
    side(
      [
        [0.0, 0.0, 0.002],
        [-0.196, 0.0, 0.002],
        [-0.214, -0.012, 0.008],
        [-0.218, -0.046, 0.022],
        [-0.192, -0.074, 0.03],
        [-0.12, -0.0845, 0.035],
        [-0.03, -0.0845, 0.04],
        [0.018, -0.056, 0.03],
        [0.022, -0.016, 0.012],
      ],
      0.0098,
      m.steel,
      lever,
      {
        bevel: 0.0017,
        segs: 5,
        holes: [
          [
            [-0.012, -0.0125, 0.004],
            [-0.2, -0.0125, 0.004],
            [-0.206, -0.033, 0.012],
            [-0.186, -0.0635, 0.022],
            [-0.12, -0.0725, 0.026],
            [-0.036, -0.0725, 0.03],
            [0.004, -0.05, 0.02],
            [0.008, -0.025, 0.006],
          ],
        ],
      }
    );
    box(0.0108, 0.01, 0.022, m.steelDark, 0, 0.0, -0.205, lever); // Verriegelung vorn
    cylX(0.0033, 0.0128, m.steelBright, 0, -0.002, 0.0, lever, 10); // Gelenkbolzen
    rbox(0.0126, 0.0075, 0.03, 0.002, m.brass, 0, -0.0815, -0.08, lever); // Messingbeschlag am Griffbogen

    // Abzug (bleibt im Bügel stehen)
    const trig = box(0.0045, 0.02, 0.0048, m.steelBright, 0, -0.0215, 0.03, g);
    trig.rotation.x = 0.35;

    // Schaft aus Nussbaum mit Messingschaftkappe
    side(
      [
        [0.085, 0.049, 0.003],
        [0.2, 0.034, 0.02],
        [0.31, 0.026, 0.03],
        [0.414, 0.016, 0.004],
        [0.434, -0.074, 0.004],
        [0.412, -0.0765, 0.004],
        [0.33, -0.052, 0.05],
        [0.25, -0.026, 0.04],
        [0.17, -0.014, 0.025],
        [0.12, -0.014, 0.02],
        [0.085, 0.0, 0.003],
      ],
      0.0345,
      m.walnut,
      g,
      { bevel: 0.0042, segs: 5 }
    );
    box(0.0395, 0.106, 0.0058, m.brass, 0, -0.024, 0.4265, g).rotation.x = -0.2;
    const hornTop = rbox(0.0395, 0.007, 0.0094, 0.003, m.brass, 0, 0.0285, 0.4175, g);
    hornTop.rotation.x = -0.2;
    rbox(0.0395, 0.007, 0.0094, 0.003, m.brass, 0, -0.077, 0.4335, g).rotation.x = -0.2;
    // Riemenösen
    const ss = add(g, new THREE.Mesh(new THREE.TorusGeometry(0.0055, 0.0012, 6, 12), m.steelDark), 0, -0.062, 0.405);
    ss.rotation.y = PI / 2;

    // Durchladen: p = 0..1 (Hebel zwischen ca. 0,15 und 0,7 nach unten und wieder zurück)
    const COCKED = 0.5;
    const FALLEN = -0.32;
    function cycle(p) {
      let s = 0;
      if (p > 0.15 && p < 0.42) s = smoothstep((p - 0.15) / 0.27);
      else if (p >= 0.42 && p <= 0.7) s = 1 - smoothstep((p - 0.42) / 0.28);
      lever.rotation.x = -0.66 * s;
      slide.position.z = 0.06 * s;
      let h = COCKED;
      if (p < 0.05) h = COCKED + (FALLEN - COCKED) * smoothstep(p / 0.05);
      else if (p < 0.2) h = FALLEN;
      else if (p < 0.42) h = FALLEN + (COCKED - FALLEN) * smoothstep((p - 0.2) / 0.22);
      hammer.rotation.x = h;
    }
    cycle(0);

    lever.userData.dynamic = true;
    hammer.userData.dynamic = true;
    slide.userData.dynamic = true;
    bake(g);
    return {
      group: g,
      muzzle: point(g, 0, bore, -0.648),
      eject: point(g, 0.012, 0.056, -0.012),
      sightY: 0.0655,
      grip: [0, 0.0, 0.14],
      fore: [0, 0.0, -0.27],
      butt: [0, -0.01, 0.43],
      stance: 'rifle',
      cycle,
    };
  }

  // ---------------------------------------------------------------
  // Handkanone .50 (schwere Großkaliber-Pistole)
  // ---------------------------------------------------------------
  function buildHand50() {
    const m = mx();
    const g = new THREE.Group();
    const top = 0.0485;

    // Laufmantel (vorn, schmaler) und Schlitten (hinten, breiter)
    side(
      [
        [-0.044, 0.0, 0],
        [-0.044, top, 0],
        [-0.146, top, 0.005],
        [-0.15, 0.044, 0.003],
        [-0.15, 0.0, 0],
      ],
      0.0302,
      m.steel,
      g,
      { bevel: 0.003 }
    );
    side(
      [
        [0.103, 0.0, 0],
        [0.103, 0.0445, 0.005],
        [0.1, top, 0.0035],
        [-0.045, top, 0.002],
        [-0.045, 0.0, 0],
      ],
      0.0358,
      m.steel,
      g,
      { bevel: 0.0026 }
    );
    // Lauf (dick) ragt aus dem Mantel, Kompensator-Schlitze
    cylZ(0.0142, 0.0142, 0.016, m.steelDark, 0, 0.0222, -0.153, g, 24);
    cylZ(0.0083, 0.0083, 0.002, m.black, 0, 0.0222, -0.1612, g, 18);
    ringZ(0.0132, 0.0016, m.steelBright, 0, 0.0222, -0.1608, g);
    [-0.1425, -0.135].forEach((z) => box(0.0125, 0.0012, 0.0045, m.black, 0, top + 0.0001, z, g));
    [-1, 1].forEach((s) => {
      for (let i = 0; i < 5; i++) box(0.0012, 0.021, 0.0042, m.black, s * 0.0152, 0.0245, -0.142 + i * 0.0085, g);
      // Schlittenrillen hinten und vorn
      ribsZ(g, m.steelDark, s * 0.0180, 0.0228, 0.037, 0.073, 0.0033, 8, 0.0006, 0.0017);
      ribsZ(g, m.steelDark, s * 0.0180, 0.0228, 0.037, -0.036, 0.0033, 5, 0.0006, 0.0017);
    });
    // Auswurffenster rechts
    box(0.0007, 0.0295, 0.056, m.black, 0.018, 0.0255, 0.0245, g);
    box(0.0008, 0.011, 0.034, m.steelBright, 0.0176, 0.0125, 0.0285, g);
    box(0.0013, 0.0042, 0.008, m.brass, 0.0181, 0.0385, 0.0525, g);
    // Gravur / Kennzeichnung
    box(0.0005, 0.0045, 0.05, m.steelBright, 0.0153, 0.0105, -0.095, g);
    box(0.0005, 0.0045, 0.05, m.steelBright, -0.0153, 0.0105, -0.095, g);
    // Sicherungshebel beidseitig
    [-1, 1].forEach((s) => {
      cylX(0.0052, 0.004, m.steelDark, s * 0.0198, 0.0345, 0.083, g, 14);
      const lv = box(0.003, 0.0048, 0.019, m.steelBright, s * 0.0214, 0.0345, 0.0745, g);
      lv.rotation.x = -0.35 * s;
      screw(g, s * 0.018, 0.0085, 0.088, 0.0025, s, 0.6, m.steelBright);
    });

    // Picatinny-Schiene mit Querschlitzen
    box(0.0148, 0.0032, 0.178, m.steelDark, 0, top + 0.0016, -0.0275, g);
    for (let i = 0; i < 18; i++) {
      box(0.0206, 0.0035, 0.0049, m.steelDark, 0, top + 0.0048, -0.1085 + i * 0.0095, g);
    }
    // Kimme (hinten) und Korn (vorn), Dreipunkt-Punkte
    [-1, 1].forEach((s) => {
      rbox(0.0062, 0.0145, 0.0092, 0.0013, m.steelDark, s * 0.0051, top + 0.0072, 0.0945, g);
      cylZ(0.001, 0.001, 0.0004, m.dotWhite, s * 0.0051, top + 0.011, 0.0994, g, 10);
    });
    rbox(0.0164, 0.005, 0.0092, 0.0012, m.steelDark, 0, top + 0.0025, 0.0945, g);
    rbox(0.0044, 0.0145, 0.0085, 0.0014, m.steelDark, 0, top + 0.0072, -0.1235, g);
    rbox(0.012, 0.004, 0.0125, 0.0012, m.steelDark, 0, top + 0.0017, -0.1235, g);
    cylZ(0.0011, 0.0011, 0.0004, m.dotWhite, 0, top + 0.011, -0.1190, g, 10);

    // Rahmen unter dem Schlitten, Abzugsbügel
    rbox(0.0345, 0.0185, 0.216, 0.0045, m.steelDark, 0, -0.0085, -0.017, g);
    for (let i = 0; i < 3; i++) box(0.0285, 0.0012, 0.0038, m.black, 0, -0.0178, -0.115 + i * 0.0085, g);
    side(
      [
        [-0.066, -0.014, 0],
        [-0.066, -0.052, 0.014],
        [-0.056, -0.072, 0.01],
        [0.004, -0.072, 0.008],
        [0.004, -0.014, 0],
      ],
      0.0258,
      m.steelDark,
      g,
      {
        bevel: 0.0017,
        holes: [
          [
            [-0.058, -0.014, 0],
            [-0.058, -0.0505, 0.01],
            [-0.0525, -0.064, 0.007],
            [-0.004, -0.064, 0.005],
            [-0.004, -0.014, 0],
          ],
        ],
      }
    );
    const trig = rbox(0.0085, 0.024, 0.0058, 0.0025, m.steelBright, 0, -0.033, -0.009, g);
    trig.rotation.x = 0.3;
    cylX(0.0036, 0.037, m.steelBright, 0, -0.0215, -0.0605, g, 8); // Haltestift Bügel
    // Schlittenfang, Magazinhalter
    [-1, 1].forEach((s) => {
      rbox(0.0034, 0.0052, 0.04, 0.0017, m.steelBright, s * 0.0182, -0.0035, 0.027, g).rotation.x = -0.04;
      cylX(0.0052, 0.0034, m.steelBright, s * 0.0182, -0.032, 0.0475, g, 14);
    });

    // Griff mit Holzschalen
    const grip = new THREE.Group();
    grip.position.set(0, -0.0165, 0.0525);
    grip.rotation.x = -0.27;
    g.add(grip);
    rbox(0.0338, 0.128, 0.046, 0.0045, m.steelDark, 0, -0.064, 0, grip);
    rbox(0.0148, 0.122, 0.0062, 0.002, m.steel, 0, -0.063, 0.0235, grip); // Griffrücken
    rbox(0.0148, 0.116, 0.0058, 0.002, m.steel, 0, -0.062, -0.0238, grip); // Vorderriemen
    for (let i = 0; i < 8; i++) {
      box(0.0151, 0.0013, 0.0014, m.steelDark, 0, -0.016 - i * 0.0125, 0.0268, grip);
      box(0.0151, 0.0013, 0.0014, m.steelDark, 0, -0.026 - i * 0.0125, -0.0268, grip);
    }
    [-1, 1].forEach((s) => {
      rbox(0.0052, 0.116, 0.0405, 0.0024, m.checkWood, s * 0.0194, -0.0605, -0.0002, grip);
      screw(grip, s * 0.0224, -0.016, -0.0125, 0.0028, s, 0.3, m.steelBright);
      screw(grip, s * 0.0224, -0.1, 0.0125, 0.0028, s, 1.0, m.steelBright);
    });
    rbox(0.0372, 0.0125, 0.0522, 0.0042, m.steel, 0, -0.1325, 0.0, grip); // Magazinboden
    box(0.0286, 0.002, 0.044, m.steelBright, 0, -0.1385, 0.0, grip);
    const lan = add(grip, new THREE.Mesh(new THREE.TorusGeometry(0.0048, 0.0014, 6, 14), m.steelDark), 0, -0.126, 0.0295);
    lan.rotation.y = PI / 2;

    bake(g);
    return {
      group: g,
      muzzle: point(g, 0, 0.0222, -0.166),
      eject: point(g, 0.019, 0.03, 0.03),
      sightY: top + 0.0125,
      grip: [0, -0.07, 0.075],
      fore: null,
      butt: null,
      stance: 'pistol',
    };
  }

  // ---------------------------------------------------------------
  // Sägewerk MG (leichtes Maschinengewehr mit Kühlmantel und Gurtkasten)
  // ---------------------------------------------------------------
  function buildMG() {
    const m = mx();
    const g = new THREE.Group();
    const bore = 0.04;
    const R = 0.0262; // Radius des Kühlmantels

    // Gehäuse und Deckel
    rbox(0.058, 0.074, 0.3, 0.012, m.steelDark, 0, 0.04, 0.01, g);
    rbox(0.0505, 0.012, 0.178, 0.005, m.steel, 0, 0.0825, -0.03, g);
    cylX(0.0045, 0.0525, m.steelBright, 0, 0.0795, -0.123, g, 10); // Deckelscharnier
    rbox(0.018, 0.01, 0.013, 0.003, m.steelBright, 0, 0.0835, 0.06, g); // Deckelriegel
    box(0.034, 0.0008, 0.12, m.steelDark, 0, 0.0889, -0.04, g);
    ribsZ(g, m.steelDark, 0, 0.0889, 0.0008, -0.1, 0.012, 9, 0.034, 0.0022);
    // Seitliche Lüftungsschlitze, Zierlinien und Schrauben
    [-1, 1].forEach((s) => {
      const x = s * 0.0291;
      for (let i = 0; i < 4; i++) box(0.0008, 0.011, 0.024, m.black, x, 0.026, 0.07 + i * 0.0225, g);
      box(0.0006, 0.0025, 0.2, m.steel, x, 0.071, 0.0, g);
      box(0.0006, 0.0025, 0.2, m.steel, x, 0.01, 0.0, g);
      screw(g, x, 0.062, -0.125, 0.0027, s, 0.5);
      screw(g, x, 0.018, -0.125, 0.0027, s, 1.2);
      screw(g, x, 0.062, 0.145, 0.0027, s, 0.3);
      screw(g, x, 0.018, 0.145, 0.0027, s, 0.9);
    });
    // Rechts: Spannschlitz und Rückholgriff (Knauf seitlich)
    box(0.0008, 0.007, 0.16, m.black, 0.0291, 0.052, 0.0, g);
    box(0.0008, 0.034, 0.05, m.black, 0.0291, 0.026, 0.0, g); // Auswurffenster
    cylX(0.0052, 0.044, m.steelBright, 0.0505, 0.052, -0.012, g, 10);
    ball(0.0125, m.steelDark, 0.0735, 0.052, -0.012, g, 0.7, 1, 1);
    cylX(0.0076, 0.006, m.steel, 0.0335, 0.052, -0.012, g, 12);
    // Hintere Visierung: Klappvisier mit Schieber
    rbox(0.026, 0.0125, 0.03, 0.003, m.steelDark, 0, 0.0835, 0.118, g);
    [-1, 1].forEach((s) => {
      rbox(0.006, 0.0165, 0.0065, 0.0014, m.steelDark, s * 0.0083, 0.0975, 0.1195, g);
      cylZ(0.0011, 0.0011, 0.0004, m.dotWhite, s * 0.0083, 0.1025, 0.1232, g, 10);
    });
    rbox(0.0235, 0.0065, 0.0065, 0.0016, m.steelBright, 0, 0.0925, 0.1195, g);
    cylX(0.0056, 0.008, m.steelDark, 0.0165, 0.086, 0.118, g, 10);
    box(0.0006, 0.002, 0.026, m.steelBright, 0, 0.0898, 0.134, g);

    // Kühlmantel mit Lüftungslöchern
    turned(
      [
        [0.0305, -0.14],
        [0.0292, -0.162],
        [R, -0.19],
        [R, -0.568],
        [0.0276, -0.572],
        [0.0276, -0.6],
        [0.0125, -0.6],
      ],
      m.steel,
      0,
      bore,
      0,
      g,
      28
    );
    ringZ(0.0268, 0.0017, m.steelDark, 0, bore, -0.168, g);
    cylZ(0.0285, 0.0285, 0.026, m.steelDark, 0, bore, -0.585, g, 24);
    const qz = new V3(0, 0, 1);
    for (let row = 0; row < 8; row++) {
      for (let k = 0; k < 8; k++) {
        const a = (k * PI) / 4 + (row % 2) * (PI / 8);
        const nx = Math.sin(a);
        const ny = Math.cos(a);
        if (ny < -0.6) continue; // unten sitzt das Zweibein
        const disc = new THREE.Mesh(new THREE.CircleGeometry(0.0046, 10), m.black);
        disc.position.set(nx * (R + 0.0003), bore + ny * (R + 0.0003), -0.215 - row * 0.043);
        disc.quaternion.setFromUnitVectors(qz, new V3(nx, ny, 0));
        g.add(disc);
      }
    }
    // Lauf und Mündungsfeuerdämpfer (Kegel)
    turned(
      [
        [0.0125, -0.6],
        [0.0158, -0.618],
        [0.0183, -0.648],
        [0.0186, -0.672],
        [0.0132, -0.679],
      ],
      m.steelDark,
      0,
      bore,
      0,
      g,
      24
    );
    cylZ(0.0098, 0.0098, 0.0016, m.black, 0, bore, -0.6795, g, 16);
    ringZ(0.0186, 0.0016, m.steel, 0, bore, -0.6625, g);
    // Korn mit Schutzohren
    rbox(0.0225, 0.0085, 0.0265, 0.002, m.steelDark, 0, 0.0715, -0.572, g);
    [-1, 1].forEach((s) => rbox(0.0032, 0.0285, 0.0125, 0.0013, m.steelDark, s * 0.0088, 0.0845, -0.572, g));
    rbox(0.0026, 0.0258, 0.0042, 0.001, m.steelDark, 0, 0.0845, -0.572, g);
    box(0.0014, 0.0034, 0.0004, m.dotOrange, 0, 0.0977, -0.5698, g);
    // Tragegriff über dem Mantel (liegt unter der Visierlinie)
    [-0.385, -0.255].forEach((z) => {
      rbox(0.014, 0.024, 0.012, 0.003, m.steelDark, 0, 0.0765, z, g);
      rbox(0.05, 0.012, 0.014, 0.004, m.steelDark, 0, 0.0555, z, g);
    });
    cylZ(0.0075, 0.0075, 0.158, m.leatherDark, 0, 0.0885, -0.32, g, 12);
    ribsZ(g, m.black, 0, 0.0885, 0.0156, -0.388, 0.0105, 13, 0.0152, 0.0012);

    // Zweibein (eingeklappt, Beine laufen nach hinten unter den Mantel)
    rbox(0.044, 0.012, 0.034, 0.003, m.steelDark, 0, 0.0125, -0.5, g);
    cylX(0.0042, 0.05, m.steelBright, 0, 0.007, -0.5, g, 10);
    [-1, 1].forEach((s) => {
      between([s * 0.0225, 0.0075, -0.5], [s * 0.03, 0.0035, -0.31], 0.0056, 0.0052, m.steel, g, 10);
      between([s * 0.0225, 0.0075, -0.5], [s * 0.0225, 0.0075, -0.5], 0.0056, 0.0056, m.steel, g, 4);
      rbox(0.0105, 0.012, 0.03, 0.0045, m.rubber, s * 0.03, 0.0022, -0.3, g);
      cylX(0.0044, 0.009, m.steelBright, s * 0.0255, 0.0055, -0.47, g, 10);
      rbox(0.008, 0.012, 0.022, 0.003, m.steelDark, s * 0.0215, 0.011, -0.4, g);
    });
    tubeAlong([[-0.0285, 0.0042, -0.34], [0, 0.0062, -0.34], [0.0285, 0.0042, -0.34]], 0.0024, m.steelBright, g, { segs: 12, radial: 6 });
    box(0.03, 0.004, 0.012, m.steelDark, 0, 0.0035, -0.405, g); // Haltefeder

    // Pistolengriff mit Abzug
    side(
      [
        [-0.07, 0.004, 0],
        [-0.07, -0.02, 0.01],
        [-0.052, -0.04, 0.012],
        [-0.012, -0.04, 0.006],
        [-0.004, -0.028, 0.004],
        [-0.004, 0.004, 0],
      ],
      0.009,
      m.steelDark,
      g,
      {
        bevel: 0.0013,
        holes: [
          [
            [-0.0645, 0.004, 0],
            [-0.0645, -0.0185, 0.007],
            [-0.0495, -0.0335, 0.008],
            [-0.0145, -0.0335, 0.004],
            [-0.0095, -0.0255, 0.003],
            [-0.0095, 0.004, 0],
          ],
        ],
      }
    );
    box(0.0044, 0.019, 0.0048, m.steelBright, 0, -0.0145, -0.025, g).rotation.x = 0.3;
    const grip = new THREE.Group();
    grip.position.set(0, 0.004, 0.105);
    grip.rotation.x = -0.33;
    g.add(grip);
    rbox(0.031, 0.108, 0.042, 0.008, m.polymerDark, 0, -0.054, 0, grip);
    for (let i = 0; i < 7; i++) {
      box(0.0274, 0.0014, 0.0013, m.black, 0, -0.016 - i * 0.0135, 0.0212, grip);
      box(0.0274, 0.0014, 0.0013, m.black, 0, -0.016 - i * 0.0135, -0.0212, grip);
    }
    [-1, 1].forEach((s) => screw(grip, s * 0.0158, -0.012, 0.0, 0.0028, s, 0.4));
    rbox(0.034, 0.008, 0.046, 0.003, m.steelDark, 0, -0.109, 0, grip);
    cylX(0.0045, 0.0045, m.steelBright, 0.0225, -0.004, -0.014, g, 10); // Feuerwahlhebel
    box(0.0028, 0.0048, 0.016, m.steelDark, 0.0244, -0.004, -0.014, g).rotation.x = -0.3;

    // Gurtkasten links mit sichtbarem Patronengurt
    const bx = -0.0605;
    rbox(0.062, 0.118, 0.152, 0.009, m.steelDark, bx, -0.0215, -0.036, g);
    rbox(0.066, 0.006, 0.158, 0.003, m.steel, bx, 0.0385, -0.036, g);
    rbox(0.012, 0.034, 0.05, 0.004, m.steel, -0.032, 0.026, -0.036, g); // Halter am Gehäuse
    for (let i = 0; i < 3; i++) {
      box(0.0008, 0.0065, 0.138, m.steel, bx - 0.0314, -0.042 + i * 0.026, -0.036, g);
      box(0.054, 0.0065, 0.0008, m.steel, bx, -0.042 + i * 0.026, 0.0405, g);
      box(0.054, 0.0065, 0.0008, m.steel, bx, -0.042 + i * 0.026, -0.1125, g);
    }
    [-1, 1].forEach((s) => {
      rbox(0.016, 0.014, 0.01, 0.003, m.steelBright, bx, 0.016, -0.036 + s * 0.0805, g); // Verschlüsse
      screw(g, bx - 0.0314, 0.03, -0.036 + s * 0.06, 0.0028, -1, 0.7);
      screw(g, bx - 0.0314, -0.08, -0.036 + s * 0.06, 0.0028, -1, 1.2);
    });
    // Gurt: Patronen (Messing, Kupfergeschoss) mit Gliedern, bogenförmig vom Kasten zum Zuführer
    const belt = [
      [-0.058, 0.0345],
      [-0.0595, 0.0465],
      [-0.0545, 0.0615],
      [-0.0435, 0.0725],
      [-0.0335, 0.0785],
      [-0.0255, 0.0795],
    ];
    const bcurve = new THREE.CatmullRomCurve3(belt.map((p) => new V3(p[0], p[1], 0)));
    const bz = -0.043;
    for (let i = 0; i < 8; i++) {
      const pt = bcurve.getPointAt(i / 7);
      const grp = new THREE.Group();
      grp.position.set(pt.x, pt.y, bz);
      g.add(grp);
      cylZ(0.0057, 0.0066, 0.04, m.brass, 0, 0, 0.005, grp, 12);
      cylZ(0.0012, 0.0055, 0.0185, m.copper, 0, 0, -0.0245, grp, 12);
      ringZ(0.0066, 0.0013, m.steelBright, 0, 0, -0.008, grp);
      ringZ(0.0068, 0.0013, m.steelBright, 0, 0, 0.0155, grp);
      if (i < 7) {
        const nx = bcurve.getPointAt((i + 1) / 7);
        const ang = Math.atan2(nx.y - pt.y, nx.x - pt.x);
        [-0.008, 0.0155].forEach((dz) => {
          const lk = box(0.0034, 0.0024, 0.0035, m.steel, (pt.x + nx.x) / 2, (pt.y + nx.y) / 2, bz + dz, g);
          lk.rotation.z = ang;
        });
      }
    }
    // leere Gurtglieder rechts am Gehäuse
    for (let i = 0; i < 4; i++) {
      const lk = add(g, new THREE.Mesh(new THREE.TorusGeometry(0.0062, 0.0013, 6, 12), m.steelBright), 0.0328 + i * 0.0035, 0.072 - i * 0.012, -0.043 + (i % 2) * 0.01);
      lk.rotation.y = 0.2 * i;
    }

    // Holzschulterstütze mit Pufferrohr
    cylZ(0.0215, 0.0215, 0.062, m.steelDark, 0, 0.043, 0.19, g, 18);
    ringZ(0.0218, 0.0016, m.steel, 0, 0.043, 0.2, g);
    side(
      [
        [0.205, 0.07, 0.004],
        [0.3, 0.068, 0.02],
        [0.505, 0.058, 0.012],
        [0.527, 0.05, 0.004],
        [0.532, -0.082, 0.006],
        [0.505, -0.088, 0.006],
        [0.4, -0.05, 0.06],
        [0.31, -0.022, 0.04],
        [0.235, -0.01, 0.03],
        [0.205, 0.0, 0.004],
      ],
      0.05,
      m.walnut,
      g,
      { bevel: 0.007, segs: 5 }
    );
    rbox(0.056, 0.138, 0.0095, 0.004, m.rubber, 0, -0.0165, 0.5345, g).rotation.x = -0.04;
    box(0.044, 0.003, 0.012, m.steelDark, 0, 0.0545, 0.52, g);
    const sw = add(g, new THREE.Mesh(new THREE.TorusGeometry(0.0062, 0.0014, 6, 14), m.steelDark), 0, -0.052, 0.46);
    sw.rotation.y = PI / 2;
    screw(g, 0.0252, 0.012, 0.37, 0.0028, 1, 0.6);
    screw(g, -0.0252, 0.012, 0.37, 0.0028, -1, 0.2);

    bake(g);
    return {
      group: g,
      muzzle: point(g, 0, bore, -0.683),
      eject: point(g, 0.03, 0.028, 0.0),
      sightY: 0.1004,
      grip: [0, -0.05, 0.113],
      fore: [0, 0.0, -0.31],
      butt: [0, -0.012, 0.53],
      stance: 'rifle',
    };
  }

  // ---------------------------------------------------------------
  // Jagdbogen (Recurve) und Armbrust-Variante
  // ---------------------------------------------------------------
  // Biegsamer Wurfarm: Querschnitt wandert entlang einer ebenen Mittellinie und biegt sich beim Auszug.
  // o: { O (nach außen), Q (zum Schützen), origin, pts [[o, q], ...], w0, w1, t0, t1, K (Zusatzkrümmung), mat }
  function makeLimb(o) {
    const N = o.stations || 28;
    const sp = new THREE.SplineCurve(o.pts.map((p) => new THREE.Vector2(p[0], p[1])));
    const c = sp.getSpacedPoints(N);
    const ds = [];
    const al = [];
    for (let i = 0; i < N; i++) {
      const dx = c[i + 1].x - c[i].x;
      const dy = c[i + 1].y - c[i].y;
      ds.push(Math.hypot(dx, dy));
      al.push(Math.atan2(dy, dx));
    }
    const Wd = new V3().crossVectors(o.O, o.Q).normalize();
    const RING = [
      [0.8, 1],
      [-0.8, 1],
      [-1, 0.5],
      [-1, -0.5],
      [-0.8, -1],
      [0.8, -1],
      [1, -0.5],
      [1, 0.5],
    ];
    const K = RING.length;
    const pos = new Float32Array((N + 1) * K * 3);
    const uv = new Float32Array((N + 1) * K * 2);
    for (let i = 0; i <= N; i++) {
      for (let k = 0; k < K; k++) {
        uv[(i * K + k) * 2] = (i / N) * 2.2;
        uv[(i * K + k) * 2 + 1] = k / K;
      }
    }
    const idx = [];
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < K; k++) {
        const a = i * K + k;
        const b = i * K + ((k + 1) % K);
        const cc = (i + 1) * K + k;
        const d = (i + 1) * K + ((k + 1) % K);
        idx.push(a, b, cc, b, d, cc);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, o.mat);
    mesh.userData.dynamic = true;
    mesh.frustumCulled = false;
    const st = { tip: new V3(), T: new V3(), N: new V3(), Wd, quat: new THREE.Quaternion() };
    const basis = new THREE.Matrix4();
    const aa = new Array(N);
    function update(p) {
      let x = c[0].x;
      let y = c[0].y;
      const P = [[x, y]];
      for (let i = 0; i < N; i++) {
        const a = al[i] + (p * o.K * (i + 0.5)) / N;
        aa[i] = a;
        x += ds[i] * Math.cos(a);
        y += ds[i] * Math.sin(a);
        P.push([x, y]);
      }
      for (let i = 0; i <= N; i++) {
        const a = i === 0 ? aa[0] : i === N ? aa[N - 1] : (aa[i - 1] + aa[i]) / 2;
        const s = i / N;
        const w = o.w0 + (o.w1 - o.w0) * Math.pow(s, 1.1);
        const t = o.t0 + (o.t1 - o.t0) * s;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        // Mittelpunkt, Normale (zum Schützen) und Breitenrichtung
        const cx = o.origin.x + o.O.x * P[i][0] + o.Q.x * P[i][1];
        const cy = o.origin.y + o.O.y * P[i][0] + o.Q.y * P[i][1];
        const cz = o.origin.z + o.O.z * P[i][0] + o.Q.z * P[i][1];
        const nx = -o.O.x * sa + o.Q.x * ca;
        const ny = -o.O.y * sa + o.Q.y * ca;
        const nz = -o.O.z * sa + o.Q.z * ca;
        for (let k = 0; k < K; k++) {
          const wk = (RING[k][0] * w) / 2;
          const tk = (RING[k][1] * t) / 2;
          const j = (i * K + k) * 3;
          pos[j] = cx + Wd.x * wk + nx * tk;
          pos[j + 1] = cy + Wd.y * wk + ny * tk;
          pos[j + 2] = cz + Wd.z * wk + nz * tk;
        }
        if (i === N) {
          st.tip.set(cx, cy, cz);
          st.T.set(o.O.x * ca + o.Q.x * sa, o.O.y * ca + o.Q.y * sa, o.O.z * ca + o.Q.z * sa);
          st.N.set(nx, ny, nz);
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
      basis.makeBasis(Wd, st.T, st.N);
      st.quat.setFromRotationMatrix(basis);
    }
    update(0);
    return { mesh, update, st };
  }
  // zylinderförmiger Strich zwischen zwei Punkten (für Sehnen); Länge über scale.y
  function strand(r, mat, parent) {
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 5, 1), mat);
    me.userData.dynamic = true;
    me.frustumCulled = false;
    parent.add(me);
    return me;
  }
  function setStrand(me, a, b) {
    _dir.copy(b).sub(a);
    const len = _dir.length();
    me.position.copy(a).add(b).multiplyScalar(0.5);
    me.scale.set(1, len, 1);
    me.quaternion.setFromUnitVectors(_yUp, _dir.multiplyScalar(1 / len));
  }
  // Feder (flaches Blatt, Kante an der Schaftachse); Länge in -Z
  function vane(len, hgt, mat, parent, ang, z0) {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(0, hgt * 0.4);
    sh.quadraticCurveTo(len * 0.1, hgt * 1.05, len * 0.38, hgt);
    sh.quadraticCurveTo(len * 0.8, hgt * 0.86, len, hgt * 0.38);
    sh.lineTo(len, 0);
    sh.lineTo(0, 0);
    const geo = new THREE.ShapeGeometry(sh, 6);
    geo.rotateY(PI / 2);
    const grp = new THREE.Group();
    grp.rotation.z = ang;
    grp.position.z = z0;
    grp.add(new THREE.Mesh(geo, mat));
    parent.add(grp);
    return grp;
  }
  // Pfeil bzw. Bolzen: Ursprung an der Nockenkerbe, Spitze zeigt nach -Z
  function makeArrow(o) {
    const m = mx();
    const a = new THREE.Group();
    const r = o.r;
    cylZ(r * 1.35, r * 1.02, 0.016, m.nockPlastic, 0, 0, 0.006, a, 10);
    box(0.0012, r * 2.4, 0.004, m.black, 0, 0, 0.0125, a);
    cylZ(r, r, o.len, m.shaft, 0, 0, -o.len / 2 + 0.0, a, 10);
    // Federn: zwei farbige und eine helle Leitfeder
    const f0 = o.fz != null ? o.fz : -0.012;
    vane(o.vl, o.vh, m.fletchCock, a, PI / 2, f0);
    vane(o.vl, o.vh, m.fletch, a, PI / 2 + (PI * 2) / 3, f0);
    vane(o.vl, o.vh, m.fletch, a, PI / 2 - (PI * 2) / 3, f0);
    // Umwicklungen hinter den Federn
    ringZ(r + 0.0004, 0.0007, m.serving, 0, 0, f0 - o.vl - 0.006, a);
    ringZ(r + 0.0004, 0.0007, m.brass, 0, 0, f0 - o.vl - 0.011, a);
    ringZ(r + 0.0004, 0.0007, m.serving, 0, 0, f0 + 0.005, a);
    if (o.broad) {
      // Jagdspitze: Fassung, Kegel und drei Klingen
      cylZ(r * 1.28, r * 1.28, 0.014, m.steelBright, 0, 0, -o.len - 0.004, a, 12);
      cylZ(0.0004, r * 1.2, 0.04, m.steelBright, 0, 0, -o.len - 0.031, a, 12);
      for (let i = 0; i < 3; i++) {
        const sh = new THREE.Shape();
        sh.moveTo(0.0, 0);
        sh.lineTo(0.006, r * 1.2);
        sh.lineTo(0.0, r * 3.1);
        sh.lineTo(0.034, r * 1.2);
        sh.lineTo(0.034, 0);
        const geo = new THREE.ShapeGeometry(sh, 2);
        geo.rotateY(PI / 2);
        geo.translate(0, 0, -o.len - 0.0095);
        const bl = new THREE.Mesh(geo, m.bladeSteel);
        bl.rotation.z = (i * PI * 2) / 3 + PI / 6;
        a.add(bl);
      }
    } else {
      cylZ(0.0004, r * 1.3, 0.03, m.steelBright, 0, 0, -o.len - 0.016, a, 4);
      cylZ(r * 1.3, r * 1.3, 0.006, m.steelBright, 0, 0, -o.len + 0.0, a, 12);
    }
    a.userData.tipZ = o.broad ? -(o.len + 0.051) : -(o.len + 0.031);
    return a;
  }

  function buildBow() {
    const m = mx();
    const g = new THREE.Group();
    const B = new THREE.Group(); // Recurvebogen
    const C = new THREE.Group(); // Armbrust

    const ARROW_Y = 0.056; // Höhe von Pfeil und Armbrust-Bolzen
    const BOW_SIGHT = ARROW_Y + 0.016; // Blicklinie liegt knapp über dem Pfeil
    const DRAW_Z = 0.43; // Nocke bei vollem Auszug

    // ===== Recurvebogen: Griffstück (Riser) =====
    const spl = (ctrl) => {
      const pts = new THREE.SplineCurve(ctrl.map((p) => new THREE.Vector2(p[0], p[1]))).getPoints(120);
      return (y) => {
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          if ((y - a.x) * (y - b.x) <= 0) return a.y + ((b.y - a.y) * (y - a.x)) / (b.x - a.x || 1);
        }
        return pts[pts.length - 1].y;
      };
    };
    const zBack = spl([[-0.19, 0.01], [-0.15, 0.016], [-0.1, 0.023], [-0.05, 0.031], [0.0, 0.028], [0.04, 0.02], [0.075, 0.014], [0.12, 0.016], [0.16, 0.017], [0.19, 0.01]]);
    const zFront = spl([[-0.19, -0.026], [-0.15, -0.04], [-0.1, -0.034], [-0.05, -0.022], [0.0, -0.025], [0.04, -0.034], [0.075, -0.045], [0.12, -0.046], [0.16, -0.031], [0.19, -0.02]]);
    const section = (y0, y1, inset) => {
      const pts = [];
      const n = Math.max(2, Math.round((y1 - y0) / 0.012));
      const k = inset || 0;
      for (let i = 0; i <= n; i++) {
        const y = y0 + ((y1 - y0) * i) / n;
        pts.push([zBack(y) - k, y]);
      }
      for (let i = n; i >= 0; i--) {
        const y = y0 + ((y1 - y0) * i) / n;
        pts.push([zFront(y) + k, y]);
      }
      return pts;
    };
    side(section(-0.19, -0.088), 0.032, m.walnut, B, { bevel: 0.0042 });
    side(section(-0.09, 0.024, 0.0075), 0.02, m.walnut, B, { bevel: 0.002 }); // Kern unter der Lederumwicklung
    side(section(0.022, 0.14), 0.013, m.walnut, B, { bevel: 0.0028, x: 0.0125 }); // Fenster: Wand nur rechts, Pfeil läuft bei x = 0
    side(section(0.14, 0.19), 0.032, m.walnut, B, { bevel: 0.0042 });
    // Limbaufnahmen (Metall) mit Bolzen
    [-1, 1].forEach((s) => {
      side(
        [
          [-0.0215, s * 0.15, 0.004],
          [0.0185, s * 0.15, 0.004],
          [0.0135, s * 0.196, 0.004],
          [-0.0175, s * 0.196, 0.004],
        ],
        0.0475,
        m.steel,
        B,
        { bevel: 0.0035 }
      );
      rbox(0.0495, 0.006, 0.032, 0.002, m.steelBright, 0, s * 0.1975, -0.0015, B);
      cylZ(0.0074, 0.0074, 0.004, m.steelBright, 0, s * 0.172, 0.0173, B, 14);
      box(0.0014, 0.012, 0.0012, m.black, 0, s * 0.172, 0.0195, B).rotation.z = 0.5;
      cylZ(0.0074, 0.0074, 0.004, m.steelBright, 0, s * 0.172, -0.0233, B, 14);
      [-1, 1].forEach((t) => screw(B, t * 0.0242, s * 0.176, -0.003, 0.0026, t, 0.6 + s));
    });
    // Sichtfenster: Auflage, Anschlagstift, Pfeilruhe
    rbox(0.0155, 0.0032, 0.038, 0.0014, m.steelDark, 0.00425, ARROW_Y - 0.0058, -0.015, B);
    rbox(0.0016, 0.0058, 0.026, 0.0007, m.steelBright, -0.0033, ARROW_Y - 0.0034, -0.016, B);
    cylX(0.0036, 0.0045, m.brass, 0.0083, ARROW_Y + 0.001, -0.004, B, 12);
    cylX(0.0016, 0.0035, m.steelBright, 0.0058, ARROW_Y + 0.001, -0.004, B, 8);
    const orn = add(B, new THREE.Mesh(new THREE.TorusGeometry(0.0105, 0.0007, 5, 24), m.brass), 0.0194, 0.09, -0.016);
    orn.rotation.y = PI / 2;
    cylX(0.0036, 0.0008, m.brass, 0.0196, 0.09, -0.016, B, 12);
    screw(B, 0.0192, 0.095, -0.03, 0.0026, 1, 0.3);
    screw(B, 0.0192, 0.04, -0.03, 0.0026, 1, 1.0);
    screw(B, 0.0192, 0.095, 0.0, 0.0026, 1, 0.8);
    // Lederumwicklung
    const leatherGrip = new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          [0.0166, -0.09],
          [0.018, -0.082],
          [0.0188, -0.06],
          [0.0192, -0.03],
          [0.0188, -0.005],
          [0.0178, 0.012],
          [0.0166, 0.022],
        ].map((p) => new THREE.Vector2(p[0], p[1])),
        22
      ),
      m.leather
    );
    leatherGrip.scale.set(1, 1, 1.38);
    B.add(leatherGrip);
    leatherGrip.position.z = 0.003;
    const helix = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const y = -0.087 + t * 0.106;
      const ang = t * PI * 2 * 7;
      const rr = 0.0194 + 0.0003 - Math.abs(t - 0.45) * 0.004;
      helix.push([rr * Math.cos(ang), y, 0.003 + rr * 1.38 * Math.sin(ang)]);
    }
    tubeAlong(helix, 0.0009, m.leatherDark, B, { segs: 240, radial: 4 });
    [-0.091, 0.0235].forEach((y) => {
      const band = add(B, new THREE.Mesh(new THREE.TorusGeometry(0.0182, 0.0017, 6, 24), m.brass), 0, y, 0.003);
      band.rotation.x = PI / 2;
      band.scale.set(1, 1.38, 1);
    });
    // Stabilisator-Gewinde vorn
    cylZ(0.0046, 0.0046, 0.012, m.steelBright, 0.0125, 0.075, zFront(0.075) - 0.003, B, 10);

    // ===== Wurfarme, Spitzen, Sehne =====
    const limbPts = [
      [0.15, 0.0],
      [0.24, 0.006],
      [0.34, 0.027],
      [0.43, 0.059],
      [0.51, 0.093],
      [0.565, 0.112],
      [0.6, 0.118],
      [0.625, 0.114],
      [0.64, 0.104],
    ];
    const mkBowLimb = (s) =>
      makeLimb({
        O: new V3(0, s, 0),
        Q: new V3(0, 0, 1),
        origin: new V3(0, 0, 0),
        pts: limbPts,
        w0: 0.043,
        w1: 0.021,
        t0: 0.0125,
        t1: 0.0068,
        K: 0.42,
        mat: m.walnutDark,
      });
    const bowLimbs = [mkBowLimb(1), mkBowLimb(-1)];
    const bowTips = bowLimbs.map((L) => {
      B.add(L.mesh);
      const tg = new THREE.Group();
      tg.userData.dynamic = true;
      B.add(tg);
      rbox(0.0215, 0.032, 0.0128, 0.0045, m.steelDark, 0, -0.0055, 0.0, tg);
      rbox(0.009, 0.011, 0.0145, 0.003, m.steelDark, 0, 0.0035, 0.0105, tg); // Sehnenhaken
      box(0.011, 0.0016, 0.003, m.steelBright, 0, 0.009, 0.0165, tg);
      cylX(0.0036, 0.0235, m.steelBright, 0, -0.0125, 0.0, tg, 10);
      return tg;
    });
    const bowStr = { a: strand(0.001, m.string, B), b: strand(0.001, m.string, B) };
    const servA = strand(0.0016, m.serving, B);
    const servB = strand(0.0016, m.serving, B);
    const crimps = [0, 1].map(() => {
      const cr = new THREE.Mesh(new THREE.SphereGeometry(0.0033, 8, 6), m.brass);
      cr.userData.dynamic = true;
      B.add(cr);
      return cr;
    });
    const puffs = [0.32, 0.72].map(() => {
      const pf = new THREE.Mesh(new THREE.SphereGeometry(0.0072, 8, 6), m.rubber);
      pf.scale.set(1, 1.6, 1);
      pf.userData.dynamic = true;
      B.add(pf);
      return pf;
    });
    const bowArrow = makeArrow({ r: 0.0041, len: 0.74, vl: 0.098, vh: 0.0125, broad: true });
    bowArrow.userData.dynamic = true;
    B.add(bowArrow);

    // ===== Armbrust =====
    const XB_Y = 0.0568; // Bolzenachse
    const XB_DZ = 0.09; // Armbrust sitzt weiter hinten: Schaftkappe bleibt beim Zielen hinter der Kamera
    C.position.z = XB_DZ;
    const stock = [
      [-0.34, 0.04, 0],
      [0.2, 0.04, 0],
      [0.3, 0.043, 0.03],
      [0.43, 0.037, 0.02],
      [0.5, 0.03, 0.008],
      [0.508, 0.025, 0.004],
      [0.512, -0.074, 0.006],
      [0.46, -0.08, 0.02],
      [0.395, -0.05, 0.03],
      [0.33, -0.028, 0.03],
      [0.295, -0.02, 0.01],
      [0.262, -0.02, 0.012],
      [0.256, -0.122, 0.012],
      [0.212, -0.125, 0.012],
      [0.188, -0.05, 0.02],
      [0.178, -0.012, 0.01],
      [0.1, -0.012, 0.01],
      [-0.1, -0.012, 0.02],
      [-0.25, -0.004, 0.02],
      [-0.34, 0.004, 0.004],
    ];
    side(stock, 0.0425, m.walnut, C, { bevel: 0.006, segs: 5, r: 0.004 });
    // Metallschiene (Flugnut) mit Seitenleisten
    rbox(0.03, 0.0125, 0.54, 0.002, m.steel, 0, 0.0462, -0.07, C);
    [-1, 1].forEach((s) => {
      rbox(0.0046, 0.0046, 0.52, 0.0018, m.steelBright, s * 0.0105, 0.0535, -0.07, C);
      box(0.0006, 0.0028, 0.5, m.steelDark, s * 0.0152, 0.0455, -0.07, C);
    });
    rbox(0.026, 0.0042, 0.01, 0.0015, m.brass, 0, 0.0502, -0.34, C);
    rbox(0.026, 0.0042, 0.01, 0.0015, m.brass, 0, 0.0502, 0.205, C);
    for (let i = 0; i < 7; i++) box(0.03, 0.0012, 0.0016, m.steelDark, 0, 0.0529, -0.28 + i * 0.075, C);
    // Bügel-Beschläge (Prod-Sattel) mit Schrauben
    rbox(0.09, 0.05, 0.072, 0.008, m.steel, 0, 0.027, -0.3, C);
    [-1, 1].forEach((s) => {
      rbox(0.026, 0.034, 0.062, 0.006, m.steelDark, s * 0.056, 0.0568, -0.3, C);
      rbox(0.01, 0.034, 0.07, 0.004, m.brass, s * 0.075, 0.0568, -0.3, C);
      for (let i = 0; i < 2; i++) screw(C, s * 0.0585, 0.0568, -0.3 + (i - 0.5) * 0.034, 0.0042, s, 0.6 + i, m.steelBright);
      screw(C, s * 0.0452, 0.026, -0.3, 0.0034, s, 0.4);
    });
    // Steigbügel vorn (Ring quer zur Schussrichtung) mit Streben
    const stir = add(C, new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.0062, 8, 30), m.steel), 0, -0.012, -0.398);
    stir.scale.set(1, 1.1, 1);
    [-1, 1].forEach((s) => {
      between([s * 0.022, 0.012, -0.334], [s * 0.04, 0.0245, -0.396], 0.0052, 0.0048, m.steel, C, 8);
    });
    between([0, 0.03, -0.334], [0, 0.0445, -0.397], 0.0062, 0.0056, m.steelDark, C, 10);
    rbox(0.018, 0.014, 0.012, 0.003, m.brass, 0, 0.0442, -0.3975, C);
    // Abzugsbügel, Abzug, Schlossplatten
    side(
      [
        [0.058, -0.012, 0],
        [0.058, -0.045, 0.012],
        [0.074, -0.062, 0.014],
        [0.16, -0.062, 0.014],
        [0.178, -0.04, 0.012],
        [0.178, -0.012, 0],
      ],
      0.01,
      m.steel,
      C,
      {
        bevel: 0.0014,
        holes: [
          [
            [0.0645, -0.012, 0],
            [0.0645, -0.0435, 0.01],
            [0.0765, -0.0555, 0.012],
            [0.1565, -0.0555, 0.012],
            [0.1715, -0.0385, 0.01],
            [0.1715, -0.012, 0],
          ],
        ],
      }
    );
    const trig = rbox(0.0062, 0.026, 0.006, 0.0025, m.steelBright, 0, -0.0305, 0.13, C);
    trig.rotation.x = -0.18;
    [-1, 1].forEach((s) => {
      rbox(0.0042, 0.04, 0.115, 0.004, m.steelDark, s * 0.0213, 0.017, 0.12, C); // Schlossplatte
      rbox(0.0034, 0.012, 0.03, 0.003, m.brass, s * 0.0233, 0.026, 0.145, C); // Hahn
      screw(C, s * 0.0238, 0.004, 0.075, 0.0033, s, 0.5);
      screw(C, s * 0.0238, 0.034, 0.075, 0.0033, s, 1.2);
      screw(C, s * 0.0238, 0.004, 0.165, 0.0033, s, 0.1);
      screw(C, s * 0.0238, 0.034, 0.165, 0.0033, s, 0.9);
      // Zierstreifen im Schaft
      box(0.0006, 0.0035, 0.44, m.brass, s * 0.0213, 0.034, -0.12, C);
    });
    // Griff: gerautete Holzschalen, Messingkappe, Daumenauflage
    [-1, 1].forEach((s) => {
      const panel = rbox(0.0034, 0.088, 0.058, 0.002, m.checkWood, s * 0.0222, -0.076, 0.2285, C);
      panel.rotation.x = -0.05;
      screw(C, s * 0.0242, -0.05, 0.21, 0.0027, s, 0.3, m.brass);
      screw(C, s * 0.0242, -0.108, 0.245, 0.0027, s, 1.0, m.brass);
    });
    rbox(0.0405, 0.009, 0.064, 0.0035, m.brass, 0, -0.1265, 0.2335, C);
    // Nuss (Sehnenhalter) mit Schnapper
    cylX(0.0095, 0.0152, m.steelBright, 0, 0.0514, 0.1, C, 16);
    box(0.0024, 0.007, 0.0128, m.black, 0, 0.0548, 0.095, C);
    [-1, 1].forEach((s) => rbox(0.0042, 0.0125, 0.026, 0.0015, m.steelDark, s * 0.0102, 0.059, 0.1, C));
    // Visier: Kimme hinten auf Sockel, Korn vorn
    const XB_SIGHT = 0.0748;
    rbox(0.024, 0.0055, 0.034, 0.0018, m.steel, 0, 0.0495, 0.285, C);
    [-1, 1].forEach((s) => {
      rbox(0.0062, 0.0275, 0.0062, 0.0014, m.steelDark, s * 0.0072, 0.0636, 0.285, C);
      cylZ(0.001, 0.001, 0.0004, m.dotWhite, s * 0.0072, 0.0745, 0.2885, C, 10);
    });
    rbox(0.0228, 0.0056, 0.0062, 0.0014, m.steelBright, 0, 0.0546, 0.285, C);
    cylX(0.0048, 0.0075, m.brass, 0.0155, 0.0545, 0.297, C, 12);
    [-1, 1].forEach((s) => {
      rbox(0.0082, 0.004, 0.022, 0.0014, m.steelDark, s * 0.0125, 0.054, -0.3, C);
      rbox(0.0042, 0.0165, 0.0058, 0.0014, m.steelDark, s * 0.0125, 0.06025, -0.3, C);
    });
    rbox(0.03, 0.0035, 0.006, 0.0012, m.steelDark, 0, 0.0668, -0.3, C); // Brücke über dem Bolzen
    rbox(0.0032, 0.0075, 0.005, 0.0012, m.steelDark, 0, 0.0715, -0.3, C);
    ball(0.0016, m.brass, 0, 0.0745, -0.2975, C);
    // Schaftkappe, Brusteisen, Riemenösen
    const bp = rbox(0.0455, 0.13, 0.0095, 0.004, m.brass, 0, -0.03, 0.5115, C);
    bp.rotation.x = -0.04;
    rbox(0.0475, 0.01, 0.012, 0.0035, m.steelBright, 0, 0.0405, 0.5085, C);
    rbox(0.0475, 0.01, 0.014, 0.0035, m.steelBright, 0, -0.099, 0.512, C);
    const sling = add(C, new THREE.Mesh(new THREE.TorusGeometry(0.0072, 0.0015, 6, 14), m.steelDark), 0, -0.1, 0.52);
    sling.rotation.y = PI / 2;
    const sling2 = add(C, new THREE.Mesh(new THREE.TorusGeometry(0.0072, 0.0015, 6, 14), m.steelDark), 0, -0.014, -0.17);
    sling2.rotation.y = PI / 2;
    [0.3, 0.38, 0.46].forEach((z, i) => screw(C, 0.0215, 0.026 - i * 0.002, z, 0.0026, 1, 0.3 * i));
    // Prod: breite Wurfarme quer (X), Spitzen biegen zum Schützen
    const prodPts = [
      [0.045, 0.0],
      [0.09, 0.002],
      [0.14, 0.012],
      [0.19, 0.03],
      [0.24, 0.058],
      [0.28, 0.085],
      [0.303, 0.098],
    ];
    const mkProd = (s) =>
      makeLimb({
        O: new V3(s, 0, 0),
        Q: new V3(0, 0, 1),
        origin: new V3(0, XB_Y, -0.3),
        pts: prodPts,
        w0: 0.032,
        w1: 0.019,
        t0: 0.017,
        t1: 0.009,
        K: 0.3,
        mat: m.steel,
        stations: 30,
      });
    const prodL = [mkProd(1), mkProd(-1)];
    const prodTips = prodL.map((L) => {
      C.add(L.mesh);
      const tg = new THREE.Group();
      tg.userData.dynamic = true;
      C.add(tg);
      rbox(0.0225, 0.026, 0.0145, 0.0045, m.steelBright, 0, -0.0035, 0.0, tg);
      rbox(0.01, 0.01, 0.014, 0.003, m.brass, 0, 0.002, 0.0115, tg);
      cylX(0.0032, 0.024, m.brass, 0, -0.012, 0.0, tg, 10);
      return tg;
    });
    // Bindungen am Wurfarm-Ansatz (Leder und Messing)
    [-1, 1].forEach((s) => {
      [0.1, 0.13, 0.16].forEach((x, i) => {
        const bd = rbox(0.0125, 0.034, 0.022, 0.003, i === 1 ? m.leather : m.brass, s * x, XB_Y, -0.3 + [0.004, 0.0105, 0.019][i], C);
        bd.rotation.y = s * (0.05 + i * 0.2);
      });
    });
    const xbStr = { a: strand(0.002, m.string, C), b: strand(0.002, m.string, C) };
    const xbServ = { a: strand(0.0027, m.serving, C), b: strand(0.0027, m.serving, C) };
    const bolt = makeArrow({ r: 0.0046, len: 0.31, vl: 0.05, vh: 0.0095, fz: -0.01 });
    bolt.userData.dynamic = true;
    C.add(bolt);
    // Haltefeder für den Bolzen auf der Schiene
    rbox(0.012, 0.0024, 0.05, 0.001, m.steelBright, 0, 0.0527, 0.04, C);

    // ===== Zustand und API =====
    const muzzle = point(g, 0, 0, 0);
    const nock = point(g, 0, ARROW_Y, 0.12);
    const gripPos = [0, -0.03, 0.004];
    const api = {
      group: g,
      muzzle,
      nock,
      sightY: BOW_SIGHT,
      grip: gripPos,
      fore: null,
      butt: null,
      stance: 'bow',
      variants: ['bow', 'crossbow'],
      variant: 'bow',
      gripR: null,
    };
    let curP = 0;
    let arrowVisible = true;
    let variant = 'bow';
    const tmpA = new V3();
    const tmpN = new V3();
    const zRest = { bow: 0.12, crossbow: -0.19 };
    const zFull = { bow: DRAW_Z, crossbow: 0.1 };

    function applyTip(tg, L, off) {
      tg.position.copy(L.st.tip);
      tg.quaternion.copy(L.st.quat);
      tmpA.copy(L.st.N).multiplyScalar(off).add(L.st.tip);
      return tmpA;
    }
    // Ruhelage der Sehne = Mitte zwischen den Sehnenhaken bei p = 0 (Sehne dann gerade)
    function restOf(limbs, off) {
      limbs.forEach((L) => L.update(0));
      return limbs.reduce((z, L) => z + (L.st.tip.z + L.st.N.z * off) / limbs.length, 0);
    }
    zRest.bow = restOf(bowLimbs, 0.0155);
    zRest.crossbow = restOf(prodL, 0.0125);
    const dU = new V3();
    const dD = new V3();
    function drawBow(p) {
      const anchors = bowLimbs.map((L, i) => {
        L.update(p);
        return applyTip(bowTips[i], L, 0.0155).clone();
      });
      const zn = zRest.bow + (zFull.bow - zRest.bow) * p;
      tmpN.set(0, ARROW_Y, zn);
      setStrand(bowStr.a, anchors[0], tmpN);
      setStrand(bowStr.b, tmpN, anchors[1]);
      dU.copy(anchors[0]).sub(tmpN).normalize();
      dD.copy(anchors[1]).sub(tmpN).normalize();
      setStrand(servA, tmpN, tmpA.copy(tmpN).addScaledVector(dU, 0.04));
      setStrand(servB, tmpN, tmpA.copy(tmpN).addScaledVector(dD, 0.04));
      crimps[0].position.copy(tmpN).addScaledVector(dU, 0.0075);
      crimps[1].position.copy(tmpN).addScaledVector(dD, 0.0075);
      puffs[0].position.lerpVectors(anchors[0], tmpN, 0.3);
      puffs[1].position.lerpVectors(anchors[1], tmpN, 0.3);
      bowArrow.position.set(0, ARROW_Y, zn - 0.008);
      return zn;
    }
    function drawXbow(p) {
      const anchors = prodL.map((L, i) => {
        L.update(p);
        return applyTip(prodTips[i], L, 0.0125).clone();
      });
      // Sehne: bei p = 0 gerade zwischen den Spitzen, bei p = 1 in der Nuss
      const zn = zRest.crossbow + (zFull.crossbow - zRest.crossbow) * p;
      tmpN.set(0, XB_Y, zn);
      setStrand(xbStr.a, anchors[0], tmpN);
      setStrand(xbStr.b, tmpN, anchors[1]);
      dU.copy(anchors[0]).sub(tmpN).normalize();
      dD.copy(anchors[1]).sub(tmpN).normalize();
      setStrand(xbServ.a, tmpN, tmpA.copy(tmpN).addScaledVector(dU, 0.04));
      setStrand(xbServ.b, tmpN, tmpA.copy(tmpN).addScaledVector(dD, 0.04));
      bolt.position.set(0, XB_Y, zn - 0.008);
      return zn;
    }
    function setDraw(p) {
      p = Math.max(0, Math.min(1, +p || 0));
      curP = p;
      const zn = variant === 'crossbow' ? drawXbow(p) : drawBow(p);
      nock.position.set(0, variant === 'crossbow' ? XB_Y : ARROW_Y, zn + (variant === 'crossbow' ? XB_DZ : 0));
    }
    function setArrowVisible(v) {
      arrowVisible = !!v;
      bowArrow.visible = arrowVisible && variant === 'bow';
      bolt.visible = arrowVisible && variant === 'crossbow';
    }
    function setVariant(name) {
      variant = name === 'crossbow' ? 'crossbow' : 'bow';
      api.variant = variant;
      // nur die aktive Variante hängt im Modell (damit Bounding-Boxen stimmen)
      if (variant === 'bow') {
        g.remove(C);
        g.add(B);
      } else {
        g.remove(B);
        g.add(C);
      }
      if (variant === 'crossbow') {
        api.sightY = XB_SIGHT;
        gripPos[0] = 0;
        gripPos[1] = -0.03;
        gripPos[2] = -0.1 + XB_DZ; // Stützhand unter dem Vorderschaft
        api.gripR = [0, -0.085, 0.215 + XB_DZ]; // Schusshand am Pistolengriff
        bolt.add(muzzle);
        muzzle.position.set(0, 0, bolt.userData.tipZ);
      } else {
        api.sightY = BOW_SIGHT;
        gripPos[0] = 0;
        gripPos[1] = -0.03;
        gripPos[2] = 0.004; // Griffhand (links) am Lederwickel
        api.gripR = null;
        bowArrow.add(muzzle);
        muzzle.position.set(0, 0, bowArrow.userData.tipZ);
      }
      setArrowVisible(arrowVisible);
      setDraw(curP);
    }
    api.setDraw = setDraw;
    api.setArrowVisible = setArrowVisible;
    api.setVariant = setVariant;
    api.getDraw = () => curP;
    bake(B);
    bake(C);
    setVariant('bow');
    return api;
  }

  SR.WEAPON_DEFS.push({
    id: 'bogen',
    name: 'Jagdbogen',
    short: 'Bogen',
    kind: 'Recurvebogen · Pfeil und Bogen',
    type: 'bow',
    wall: true,
    wallRot: [PI / 2, 0, 0], // Bogen: waagerecht, flach an der Wand
    variantWallRot: { crossbow: [0, 0, PI / 2] }, // Armbrust: Wurfarme senkrecht, flach an der Wand
    interval: 1.25,
    drawTime: 0.8,
    arrowSpeed: 92,
    dmg: 62,
    hipPos: [-0.12, -0.09, -0.62],
    adsZ: -0.58,
    adsFov: 55,
    vmAdsFov: 46,
    adsTime: 0.28,
    hipSpread: 0.03,
    adsSpread: 0,
    bloom: 0,
    maxBloom: 0,
    recoil: 0.01,
    recoilYaw: 0.002,
    recover: 8,
    kickBack: 0.02,
    kickRot: 0.03,
    sound: null,
    shell: null,
    holeR: 0.007,
    build: buildBow,
  });
  SR.WEAPON_DEFS.push({
    id: 'p9',
    name: 'P-9',
    short: 'P-9',
    kind: 'Selbstladepistole',
    wall: true,
    interval: 0.22,
    dmg: 20,
    hipPos: [0.15, -0.115, -0.46],
    adsZ: -0.4,
    adsFov: 58,
    vmAdsFov: 46,
    adsTime: 0.16,
    hipSpread: 0.016,
    adsSpread: 0.003,
    bloom: 0.004,
    maxBloom: 0.03,
    recoil: 0.02,
    recoilYaw: 0.006,
    recover: 8,
    kickBack: 0.035,
    kickRot: 0.1,
    sound: { crack: 3000, body: 2200, decay: 0.16, thump: 150, gain: 0.55, echo: 0.35 },
    shell: { r: 0.0044, len: 0.019, up: 1.4, side: 1.0 },
    holeR: 0.008,
    build: buildP9,
  });
  SR.WEAPON_DEFS.push({
    id: 'uz9',
    name: 'UZ-9',
    short: 'UZ-9',
    kind: 'Maschinenpistole',
    wall: true,
    interval: 0.075,
    dmg: 13,
    hipPos: [0.14, -0.15, -0.42],
    adsZ: -0.34,
    adsFov: 56,
    vmAdsFov: 46,
    adsTime: 0.18,
    hipSpread: 0.024,
    adsSpread: 0.008,
    bloom: 0.002,
    maxBloom: 0.03,
    recoil: 0.012,
    recoilYaw: 0.008,
    recover: 9,
    kickBack: 0.025,
    kickRot: 0.05,
    sound: { crack: 3300, body: 2400, decay: 0.12, thump: 160, gain: 0.55, echo: 0.3 },
    shell: { r: 0.0044, len: 0.019, up: 1.0, side: 1.5 },
    holeR: 0.007,
    build: buildUZ9,
  });
  SR.WEAPON_DEFS.push({
    id: 'lever',
    name: 'Büffeljäger',
    short: 'Büffeljäger',
    kind: 'Unterhebelrepetierer',
    wall: true,
    interval: 0.75,
    dmg: 55,
    hipPos: [0.14, -0.17, -0.3],
    adsZ: -0.26,
    adsFov: 38,
    vmAdsFov: 42,
    adsTime: 0.24,
    hipSpread: 0.022,
    adsSpread: 0.0015,
    bloom: 0,
    maxBloom: 0,
    recoil: 0.05,
    recoilYaw: 0.012,
    recover: 6,
    kickBack: 0.06,
    kickRot: 0.1,
    sound: { crack: 2500, body: 1250, decay: 0.5, thump: 85, gain: 0.95, echo: 0.8 },
    shell: { r: 0.0048, len: 0.04, up: 0.9, side: 1.2, delay: 0.45 },
    holeR: 0.008,
    build: buildLever,
  });
  SR.WEAPON_DEFS.push({
    id: 'hand50',
    name: 'Handkanone .50',
    short: 'Handkanone',
    kind: 'Großkaliber-Pistole',
    wall: true,
    interval: 0.62,
    dmg: 80,
    hipPos: [0.15, -0.125, -0.5],
    adsZ: -0.46,
    adsFov: 54,
    vmAdsFov: 46,
    adsTime: 0.2,
    hipSpread: 0.02,
    adsSpread: 0.004,
    bloom: 0.006,
    maxBloom: 0.03,
    recoil: 0.09,
    recoilYaw: 0.02,
    recover: 6,
    kickBack: 0.09,
    kickRot: 0.35,
    sound: { crack: 1900, body: 900, decay: 0.55, thump: 62, gain: 1.1, echo: 1.0 },
    shell: { r: 0.0066, len: 0.033, up: 1.3, side: 1.1 },
    holeR: 0.01,
    build: buildHand50,
  });
  SR.WEAPON_DEFS.push({
    id: 'mg',
    name: 'Sägewerk MG',
    short: 'Sägewerk',
    kind: 'Leichtes Maschinengewehr',
    wall: true,
    interval: 0.085,
    dmg: 15,
    hipPos: [0.14, -0.2, -0.4],
    adsZ: -0.44,
    adsFov: 52,
    vmAdsFov: 44,
    adsTime: 0.3,
    hipSpread: 0.03,
    adsSpread: 0.012,
    bloom: 0.003,
    maxBloom: 0.04,
    recoil: 0.012,
    recoilYaw: 0.01,
    recover: 8,
    kickBack: 0.03,
    kickRot: 0.05,
    sound: { crack: 2800, body: 1500, decay: 0.2, thump: 95, gain: 0.85, echo: 0.8 },
    shell: { r: 0.0058, len: 0.057, up: 0.8, side: 1.6 },
    holeR: 0.007,
    build: buildMG,
  });
  SR.WEAPON_DEFS.forEach((d) => {
    if (!d.rpm) d.rpm = Math.round(60 / d.interval);
  });
})();
