// Feldwege, auf denen die Gegner patrouillieren. Koordinaten in Metern (x nach rechts, z nach hinten; der Spieler steht bei 0/0,
// die Scheiben liegen vor ihm bei negativem z). Jeder Weg ist eine Linie aus Wegpunkten.
(function () {
  'use strict';
  const SR = (window.SR = window.SR || {});

  SR.PATHS = [
    { id: 'wald', name: 'Waldweg', width: 3.2, pts: [[-125, -100], [-88, -74], [-58, -50], [-42, -24]] },
    { id: 'handel', name: 'Handelsroute', width: 3.6, pts: [[112, -122], [78, -88], [52, -58], [38, -34]] },
    { id: 'feld', name: 'Feldweg', width: 3.0, pts: [[135, 62], [96, 46], [66, 30], [48, 16]] },
    { id: 'grat', name: 'Höhenpfad', width: 2.6, pts: [[-70, -96], [-34, -91], [2, -99], [36, -94], [70, -100]] },
  ];

  // Abstand eines Punktes zum nächsten Weg (für Bäume, Gras usw.: nichts auf den Weg setzen)
  SR.pathDistance = function (x, z) {
    let best = Infinity;
    SR.PATHS.forEach((p) => {
      for (let i = 0; i < p.pts.length - 1; i++) {
        const ax = p.pts[i][0];
        const az = p.pts[i][1];
        const bx = p.pts[i + 1][0];
        const bz = p.pts[i + 1][1];
        const dx = bx - ax;
        const dz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
        best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)) - p.width / 2);
      }
    });
    return best;
  };

  // Geglättete Kurve und Länge für jeden Weg (für die Gegner und die Weg-Optik)
  SR.preparePaths = function () {
    SR.PATHS.forEach((p) => {
      if (p.curve) return;
      p.curve = new THREE.CatmullRomCurve3(p.pts.map((q) => new THREE.Vector3(q[0], 0, q[1])), false, 'centripetal');
      p.length = p.curve.getLength();
    });
  };
  // Punkt bei Strecke s (Meter) auf dem Weg
  SR.pathPoint = function (path, s, out) {
    return path.curve.getPointAt(Math.max(0, Math.min(1, s / path.length)), out || new THREE.Vector3());
  };
  // Nächste Strecke s zu einem Punkt (grob, 1-m-Raster)
  SR.pathNearest = function (path, x, z) {
    const p = new THREE.Vector3();
    let best = 0;
    let bd = Infinity;
    for (let s = 0; s <= path.length; s += 2) {
      SR.pathPoint(path, s, p);
      const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  };

  // Staubweg als Band auf dem Boden
  function roadTexture() {
    const W = 256;
    const H = 256;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const r = SR.rng(61);
    const base = g.createLinearGradient(0, 0, W, 0);
    base.addColorStop(0, 'rgba(120,98,66,0)');
    base.addColorStop(0.14, 'rgba(126,102,70,0.9)');
    base.addColorStop(0.5, 'rgba(150,124,88,1)');
    base.addColorStop(0.86, 'rgba(126,102,70,0.9)');
    base.addColorStop(1, 'rgba(120,98,66,0)');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    // Fahrspuren
    [0.3, 0.7].forEach((x) => {
      const rut = g.createLinearGradient((x - 0.07) * W, 0, (x + 0.07) * W, 0);
      rut.addColorStop(0, 'rgba(90,70,46,0)');
      rut.addColorStop(0.5, 'rgba(90,70,46,0.55)');
      rut.addColorStop(1, 'rgba(90,70,46,0)');
      g.fillStyle = rut;
      g.fillRect((x - 0.07) * W, 0, 0.14 * W, H);
    });
    // Steinchen und Grasbüschel
    for (let i = 0; i < 1400; i++) {
      const x = W * (0.12 + r() * 0.76);
      const l = 60 + r() * 60;
      g.fillStyle = 'rgba(' + l + ',' + (l * 0.82) + ',' + (l * 0.6) + ',' + (0.25 + r() * 0.3) + ')';
      g.fillRect(x, r() * H, 1 + r() * 2, 1 + r() * 2);
    }
    for (let i = 0; i < 220; i++) {
      g.fillStyle = 'rgba(' + (70 + r() * 30) + ',' + (100 + r() * 40) + ',45,0.5)';
      g.fillRect(W * (0.5 + (r() - 0.5) * 0.5), r() * H, 1, 3 + r() * 4);
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = SR.maxAniso || 4;
    return t;
  }

  SR.buildPaths = function (scene) {
    SR.preparePaths();
    const tex = roadTexture();
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 1,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    SR.PATHS.forEach((p) => {
      const n = Math.ceil(p.length / 2);
      const pos = [];
      const uv = [];
      const idx = [];
      const a = new THREE.Vector3();
      const tan = new THREE.Vector3();
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        p.curve.getPointAt(u, a);
        p.curve.getTangentAt(u, tan);
        const nx = -tan.z;
        const nz = tan.x;
        const w = p.width / 2 + 0.5;
        pos.push(a.x - nx * w, 0.02, a.z - nz * w, a.x + nx * w, 0.02, a.z + nz * w);
        uv.push(0, (u * p.length) / 5, 1, (u * p.length) / 5);
        if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.renderOrder = 1;
      scene.add(m);
    });
  };
})();
