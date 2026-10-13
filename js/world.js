// Umgebung: Himmel mit Wolken, Gelände mit Hügeln und Dunst, Wiese mit Gras und Blumen, Wälder, Felder,
// Schützenstand mit Betonplatte, Tisch, Fahne und Requisiten. Alles prozedural (Canvas-Texturen + Instancing).
(function () {
  'use strict';
  const SR = (window.SR = window.SR || {});

  const PAD_TOP = 0.1;
  const TABLE = { z: -1.15, width: 3.2, depth: 1.36, height: 0.85 };
  const PAD = { x: 0, z: 0.6, w: 7.2, d: 6.0 };
  const GRAVEL = { x: 0, z: 0.4, r: 8 };
  // Zielscheiben (halten wir frei) – siehe Spielvorgabe
  const TARGET_SPOTS = [[0, -12], [-10.3, -19.4], [12.2, -27.4], [5.7, -54.7], [14.1, -7.5], [34.5, 6.1], [14.1, 16.9], [0, 48], [-9, 10.7], [-27.4, 5.8], [-61.8, -32.9], [-18.8, -35.3]];
  // Dunstfarbe: Himmel am Horizont, Nebel und ferne Hügel laufen darin zusammen
  const HAZE_HEX = 0xc6d9e6;
  const WIND = { uTime: { value: 0 } };

  // ---------------------------------------------------------------- Hilfsfunktionen
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  // sRGB-Farbe (0..1) -> lineare Werte für Vertexfarben
  const rgbL = (r, g, b) => [lin(r), lin(g), lin(b)];
  function hslL(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t) => {
      t = (t + 1) % 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return rgbL(f(h + 1 / 3), f(h), f(h - 1 / 3));
  }

  function hash2(x, y) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function hash3(x, y, z) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647 - 11);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    let fx = x - ix;
    let fy = y - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(hash2(ix, iy), hash2(ix + 1, iy), fx), lerp(hash2(ix, iy + 1), hash2(ix + 1, iy + 1), fx), fy);
  }
  function vnoise3(x, y, z) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    let fx = x - ix;
    let fy = y - iy;
    let fz = z - iz;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    fz = fz * fz * (3 - 2 * fz);
    const a = lerp(lerp(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), fx), lerp(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), fx), fy);
    const b = lerp(lerp(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), fx), lerp(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), fx), fy);
    return lerp(a, b, fz);
  }
  function fbm(x, y, oct) {
    let s = 0;
    let a = 0.5;
    let f = 1;
    let t = 0;
    for (let i = 0; i < oct; i++) {
      s += a * vnoise(x * f, y * f);
      t += a;
      a *= 0.5;
      f *= 2.03;
    }
    return s / t;
  }

  const pathDist = (x, z) => (SR.pathDistance ? SR.pathDistance(x, z) : Infinity);
  function nearTarget(x, z, m) {
    for (let i = 0; i < TARGET_SPOTS.length; i++) if (Math.hypot(x - TARGET_SPOTS[i][0], z - TARGET_SPOTS[i][1]) < m) return true;
    return false;
  }
  const onPad = (x, z, m) => Math.abs(x - PAD.x) < PAD.w / 2 + m && Math.abs(z - PAD.z) < PAD.d / 2 + m;

  // ---------------------------------------------------------------- Geometrie-Werkzeuge
  function mergeGeos(list) {
    let total = 0;
    const gs = list.map((g0) => {
      const g = g0.index ? g0.toNonIndexed() : g0;
      total += g.attributes.position.count;
      return g;
    });
    const pos = new Float32Array(total * 3);
    const nor = new Float32Array(total * 3);
    const uv = new Float32Array(total * 2);
    const col = new Float32Array(total * 3).fill(1);
    let o = 0;
    gs.forEach((g) => {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
      o += n;
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return out;
  }
  // Farbe für jeden Vertex: fn(x, y, z, nx, ny, nz) -> [r, g, b] (linear)
  function paint(geo, fn) {
    const p = geo.attributes.position;
    const n = geo.attributes.normal;
    const c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const v = fn(p.getX(i), p.getY(i), p.getZ(i), n ? n.getX(i) : 0, n ? n.getY(i) : 1, n ? n.getZ(i) : 0);
      c[i * 3] = v[0];
      c[i * 3 + 1] = v[1];
      c[i * 3 + 2] = v[2];
    }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return geo;
  }
  function tint(geo, rgb) {
    return paint(geo, () => rgb);
  }
  function xform(geo, x, y, z, ry) {
    if (ry) geo.rotateY(ry);
    geo.translate(x || 0, y || 0, z || 0);
    return geo;
  }

  // Kasten mit abgeschrägter Oberkante. Mitte in x/z = 0, y von 0 bis h. Gruppe 0 = Oberseite + Fasen, Gruppe 1 = Seiten + Unterseite.
  function bevelBox(w, h, d, b) {
    const top = { p: [], n: [], u: [] };
    const sid = { p: [], n: [], u: [] };
    const x0 = -w / 2;
    const x1 = w / 2;
    const z0 = -d / 2;
    const z1 = d / 2;
    const ix0 = x0 + b;
    const ix1 = x1 - b;
    const iz0 = z0 + b;
    const iz1 = z1 - b;
    const yT = h;
    const yB = h - b;
    const uvT = (x, z) => [(x - x0) / w, 1 - (z - z0) / d];
    function quad(L, pts, n, uvs) {
      // Dreiecke so ordnen, dass die geometrische Normale zu n passt
      const a = pts[0];
      const bb = pts[1];
      const c = pts[2];
      const ux = bb[0] - a[0];
      const uy = bb[1] - a[1];
      const uz = bb[2] - a[2];
      const vx = c[0] - a[0];
      const vy = c[1] - a[1];
      const vz = c[2] - a[2];
      const cx = uy * vz - uz * vy;
      const cy = uz * vx - ux * vz;
      const cz = ux * vy - uy * vx;
      const idx = cx * n[0] + cy * n[1] + cz * n[2] >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      idx.forEach((i) => {
        L.p.push(pts[i][0], pts[i][1], pts[i][2]);
        L.n.push(n[0], n[1], n[2]);
        L.u.push(uvs[i][0], uvs[i][1]);
      });
    }
    const q = (x, y, z) => [x, y, z];
    const s2 = Math.SQRT1_2;
    // Oberseite
    quad(top, [q(ix0, yT, iz0), q(ix1, yT, iz0), q(ix1, yT, iz1), q(ix0, yT, iz1)], [0, 1, 0], [uvT(ix0, iz0), uvT(ix1, iz0), uvT(ix1, iz1), uvT(ix0, iz1)]);
    // Fasen
    quad(top, [q(ix0, yT, iz0), q(ix1, yT, iz0), q(ix1, yB, z0), q(ix0, yB, z0)], [0, s2, -s2], [uvT(ix0, iz0), uvT(ix1, iz0), uvT(ix1, z0), uvT(ix0, z0)]);
    quad(top, [q(ix0, yT, iz1), q(ix1, yT, iz1), q(ix1, yB, z1), q(ix0, yB, z1)], [0, s2, s2], [uvT(ix0, iz1), uvT(ix1, iz1), uvT(ix1, z1), uvT(ix0, z1)]);
    quad(top, [q(ix0, yT, iz0), q(ix0, yT, iz1), q(x0, yB, iz1), q(x0, yB, iz0)], [-s2, s2, 0], [uvT(ix0, iz0), uvT(ix0, iz1), uvT(x0, iz1), uvT(x0, iz0)]);
    quad(top, [q(ix1, yT, iz0), q(ix1, yT, iz1), q(x1, yB, iz1), q(x1, yB, iz0)], [s2, s2, 0], [uvT(ix1, iz0), uvT(ix1, iz1), uvT(x1, iz1), uvT(x1, iz0)]);
    // Seiten
    const vh = Math.max(0.05, yB / 2);
    quad(sid, [q(x0, yB, z0), q(x1, yB, z0), q(x1, 0, z0), q(x0, 0, z0)], [0, 0, -1], [[0, 1], [1, 1], [1, 0], [0, 0]].map((u) => [u[0], u[1] * vh]));
    quad(sid, [q(x0, yB, z1), q(x1, yB, z1), q(x1, 0, z1), q(x0, 0, z1)], [0, 0, 1], [[0, 1], [1, 1], [1, 0], [0, 0]].map((u) => [u[0], u[1] * vh]));
    quad(sid, [q(x0, yB, z0), q(x0, yB, z1), q(x0, 0, z1), q(x0, 0, z0)], [-1, 0, 0], [[0, 1], [1, 1], [1, 0], [0, 0]].map((u) => [u[0], u[1] * vh]));
    quad(sid, [q(x1, yB, z0), q(x1, yB, z1), q(x1, 0, z1), q(x1, 0, z0)], [1, 0, 0], [[0, 1], [1, 1], [1, 0], [0, 0]].map((u) => [u[0], u[1] * vh]));
    quad(sid, [q(x0, 0, z0), q(x1, 0, z0), q(x1, 0, z1), q(x0, 0, z1)], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(top.p.concat(sid.p), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(top.n.concat(sid.n), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(top.u.concat(sid.u), 2));
    g.addGroup(0, top.p.length / 3, 0);
    g.addGroup(top.p.length / 3, sid.p.length / 3, 1);
    return g;
  }

  // Zufälliger Einheitsvektor
  function rndDir(R) {
    const u = R() * 2 - 1;
    const a = R() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return [s * Math.cos(a), u, s * Math.sin(a)];
  }
  const norm3 = (v) => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  // Verformte Kugel (Krone, Fels, Busch). Normalen radial -> weiches Aussehen. colFn(nx, ny, nz, y) -> rgb
  function blob(cx, cy, cz, r, sy, detail, R, amp, colFn, flat) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position;
    const nor = new Float32Array(p.count * 3);
    const off = R() * 50;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i);
      let y = p.getY(i);
      let z = p.getZ(i);
      const l = Math.hypot(x, y, z);
      const nx = x / l;
      const ny = y / l;
      const nz = z / l;
      const k = 1 + amp * (vnoise3(nx * 1.9 + off, ny * 1.9 + off, nz * 1.9 + off) * 2 - 1);
      x = nx * k * r;
      y = ny * k * r * sy;
      z = nz * k * r;
      p.setXYZ(i, x + cx, y + cy, z + cz);
      nor[i * 3] = nx;
      nor[i * 3 + 1] = ny;
      nor[i * 3 + 2] = nz;
    }
    if (!flat) g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    else g.computeVertexNormals();
    if (colFn) paint(g, (x, y, z, nx, ny, nz) => colFn(nx, ny, nz, y));
    return g;
  }

  // Laubkarten: viele Quads mit Laubtextur auf der Oberfläche der Kugeln. Schattierung: Normale zeigt nach außen/oben.
  function leafCards(blobs, R, o) {
    const pos = [];
    const nor = [];
    const uv = [];
    const col = [];
    blobs.forEach((b) => {
      const n = Math.max(6, Math.round(b.r * b.r * o.density));
      for (let i = 0; i < n; i++) {
        const d = norm3(rndDir(R));
        if (d[1] < -0.45) d[1] = -0.45 + R() * 0.3;
        const dd = norm3(d);
        // ein Teil der Karten liegt weiter innen (dunkler) und füllt die Lücken der Krone
        const inner = R() < (o.inner || 0);
        const rr = b.r * (inner ? 0.2 + R() * 0.4 : 0.66 + R() * 0.4);
        const px = b.x + dd[0] * rr;
        const py = b.y + dd[1] * rr * (b.sy || 1);
        const pz = b.z + dd[2] * rr;
        const rv = rndDir(R);
        const pn = norm3([dd[0] * 0.5 + rv[0], dd[1] * 0.5 + rv[1], dd[2] * 0.5 + rv[2]]);
        let t1 = cross3(pn, Math.abs(pn[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]);
        t1 = norm3(t1);
        const t2 = cross3(pn, t1);
        const roll = R() * Math.PI * 2;
        const cs = Math.cos(roll);
        const sn = Math.sin(roll);
        const s = o.size[0] + R() * (o.size[1] - o.size[0]);
        const ax = [(t1[0] * cs + t2[0] * sn) * s, (t1[1] * cs + t2[1] * sn) * s, (t1[2] * cs + t2[2] * sn) * s];
        const bx = [(-t1[0] * sn + t2[0] * cs) * s, (-t1[1] * sn + t2[1] * cs) * s, (-t1[2] * sn + t2[2] * cs) * s];
        const corners = [
          [px - ax[0] - bx[0], py - ax[1] - bx[1], pz - ax[2] - bx[2]],
          [px + ax[0] - bx[0], py + ax[1] - bx[1], pz + ax[2] - bx[2]],
          [px + ax[0] + bx[0], py + ax[1] + bx[1], pz + ax[2] + bx[2]],
          [px - ax[0] + bx[0], py - ax[1] + bx[1], pz - ax[2] + bx[2]],
        ];
        const sh = norm3([dd[0], dd[1] + o.upBlend, dd[2]]);
        const c = o.col(dd, py, R, inner);
        const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
        [0, 1, 2, 0, 2, 3].forEach((k) => {
          pos.push(corners[k][0], corners[k][1], corners[k][2]);
          nor.push(sh[0], sh[1], sh[2]);
          uv.push(uvs[k][0], uvs[k][1]);
          col.push(c[0], c[1], c[2]);
        });
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  }

  // Stamm als Kegelstumpf mit leichter Biegung. Rückgabe: Geometrie mit UVs (Rinde) und Vertexfarbe
  function trunkGeo(x, y0, z, r0, r1, h, bendX, bendZ, rgb, uvScaleV) {
    const g = new THREE.CylinderGeometry(r1, r0, h, 7, 4, true);
    g.translate(0, h / 2, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) / h;
      p.setX(i, p.getX(i) + bendX * t * t);
      p.setZ(i, p.getZ(i) + bendZ * t * t);
    }
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (uvScaleV || 1));
    g.computeVertexNormals();
    tint(g, rgb);
    g.translate(x, y0, z);
    return g;
  }
  // Ast: dünner Stamm von a nach b
  function branchGeo(a, b, r0, r1, rgb) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    const g = new THREE.CylinderGeometry(r1, r0, len, 5, 1, true);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
    g.applyQuaternion(q);
    g.translate(a[0], a[1], a[2]);
    tint(g, rgb);
    return g;
  }

  // ---------------------------------------------------------------- Himmel
  function skyMaterial(sunDir, noiseTex, env) {
    const c = (hex) => new THREE.Color(hex);
    const mat = new THREE.ShaderMaterial({
      defines: env ? { ENV: '' } : {},
      uniforms: {
        cZenith: { value: c(0x2760b6) },
        cMid: { value: c(0x5a93d8) },
        cHorizon: { value: c(HAZE_HEX) },
        cGround: { value: c(0x8c9a76) },
        uSun: { value: sunDir },
        uTime: { value: 0 },
        uNoise: { value: noiseTex },
        uCover: { value: 0.49 },
      },
      vertexShader: 'varying vec3 vDir;\nvoid main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform vec3 cZenith; uniform vec3 cMid; uniform vec3 cHorizon; uniform vec3 cGround; uniform vec3 uSun;',
        'uniform float uTime; uniform sampler2D uNoise; uniform float uCover;',
        'varying vec3 vDir;',
        '#ifndef ENV',
        'float dens(vec2 p, float t) {',
        '  vec2 w = vec2(t * 0.0030, t * 0.0011);',
        '  float a = texture2D(uNoise, p * 0.060 + w).r;',
        '  float b = texture2D(uNoise, p * 0.170 + w * 1.7 + vec2(0.31, 0.57)).g;',
        '  float c = texture2D(uNoise, p * 0.520 + w * 2.6 + vec2(0.73, 0.19)).b;',
        '  return a * 0.56 + b * 0.31 + c * 0.13;',
        '}',
        '#endif',
        'void main() {',
        '  vec3 d = normalize(vDir);',
        '  float h = d.y;',
        '  float up = max(h, 0.0);',
        '  vec3 sd = normalize(uSun);',
        '  float s = max(dot(d, sd), 0.0);',
        '  vec3 col = mix(cHorizon, cMid, smoothstep(0.0, 0.30, up));',
        '  col = mix(col, cZenith, smoothstep(0.20, 0.95, up));',
        '  col = mix(col, cGround, smoothstep(0.0, 0.22, -h));',
        // Streulicht um die Sonne und warmer Horizont
        '  col += vec3(1.0, 0.80, 0.52) * pow(s, 4.0) * 0.07 * (1.0 - 0.6 * up);',
        '  col += vec3(1.0, 0.86, 0.60) * pow(s, 28.0) * 0.20;',
        '#ifndef ENV',
        '  if (h > 0.002) {',
        '    vec2 p = d.xz / (h + 0.16);',
        '    float n = dens(p, uTime);',
        '    float cov = smoothstep(uCover, uCover + 0.16, n);',
        '    float fade = smoothstep(0.0, 0.20, h);',
        '    if (cov > 0.003) {',
        '      float n2 = dens(p + normalize(sd.xz + vec2(1e-4)) * 0.22, uTime);',
        '      float lit = clamp(0.55 + (n - n2) * 5.0, 0.0, 1.0);',
        '      vec3 cc = mix(vec3(0.34, 0.42, 0.56), vec3(1.0, 0.975, 0.92), lit);',
        '      cc *= 1.0 - 0.20 * smoothstep(0.72, 1.0, n);',
        '      cc += vec3(1.0, 0.88, 0.62) * pow(s, 8.0) * 0.35 * (1.0 - cov * 0.6);',
        '      col = mix(col, cc, cov * fade * 0.96);',
        '    }',
        '  }',
        '#endif',
        // Sonnenscheibe
        '  col += vec3(1.0, 0.94, 0.78) * smoothstep(0.99984, 0.99995, s) * 5.0;',
        '  col = mix(col, cHorizon, exp(-up * 22.0) * 0.45);',
        '  gl_FragColor = vec4(col, 1.0);',
        '  #include <encodings_fragment>',
        '}',
      ].join('\n'),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    return mat;
  }

  // ---------------------------------------------------------------- Gelände (Hügel am Horizont)
  function terrainH(x, z) {
    const r = Math.hypot(x, z);
    if (r < 300) return 0;
    const rise = smooth(300, 720, r);
    const big = fbm(x * 0.0034 + 3.1, z * 0.0034 - 7.7, 4);
    const rid = 1 - Math.abs(fbm(x * 0.0052 + 17.3, z * 0.0052 + 9.1, 3) * 2 - 1);
    let h = rise * rise * (8 + big * 72 + rid * rid * 46);
    h += smooth(300, 500, r) * Math.max(0, fbm(x * 0.011 + 5, z * 0.011 - 3, 3) - 0.3) * 10;
    h += smooth(800, 1300, r) * fbm(x * 0.0021 - 4, z * 0.0021 + 5, 4) * 230;
    return h;
  }
  // Waldanteil 0..1 (für Bäume und dunklere Waldböden)
  function forestAt(x, z) {
    return smooth(0.5, 0.62, fbm(x * 0.0062 + 50, z * 0.0062 + 80, 4));
  }

  function buildTerrain() {
    const rings = [0, 25, 60, 100, 140, 180, 220, 250, 280, 310, 345, 380, 415, 450, 490, 530, 570, 615, 660, 710, 760, 815, 870, 930, 995, 1065, 1140, 1220, 1310, 1410, 1520];
    const SEG = 176;
    const K = rings.length;
    const pos = new Float32Array(K * SEG * 3);
    const nor = new Float32Array(K * SEG * 3);
    const col = new Float32Array(K * SEG * 3);
    const uv = new Float32Array(K * SEG * 2);
    const e = 6;
    for (let k = 0; k < K; k++) {
      for (let j = 0; j < SEG; j++) {
        const a = (j / SEG) * Math.PI * 2;
        const x = Math.sin(a) * rings[k];
        const z = -Math.cos(a) * rings[k];
        const h = terrainH(x, z);
        const gx = (terrainH(x + e, z) - terrainH(x - e, z)) / (2 * e);
        const gz = (terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e);
        const n = norm3([-gx, 1, -gz]);
        const i = k * SEG + j;
        pos[i * 3] = x;
        pos[i * 3 + 1] = h;
        pos[i * 3 + 2] = z;
        nor[i * 3] = n[0];
        nor[i * 3 + 1] = n[1];
        nor[i * 3 + 2] = n[2];
        uv[i * 2] = x * 0.01;
        uv[i * 2 + 1] = z * 0.01;
        // Vertexfarbe = Multiplikator auf die Wiesenfarbe (innen 1, weiter weg: Wald, Fels, helle Wiesen)
        let c = [1, 1, 1];
        const r = rings[k];
        if (r > 260) {
          const m = smooth(260, 400, r);
          const slope = Math.hypot(gx, gz);
          const forest = forestAt(x, z);
          const patch = fbm(x * 0.004 + 9, z * 0.004 + 1, 3);
          const meadow = [0.78 + patch * 0.45, 0.82 + patch * 0.42, 0.7 + patch * 0.3];
          const wood = [0.42, 0.55, 0.42];
          let t = [lerp(meadow[0], wood[0], forest), lerp(meadow[1], wood[1], forest), lerp(meadow[2], wood[2], forest)];
          const rock = smooth(0.45, 0.9, slope + smooth(120, 260, h) * 0.3);
          t = [lerp(t[0], 1.3, rock), lerp(t[1], 1.0, rock), lerp(t[2], 2.0, rock)];
          // ferne Bergketten: dunkler, damit sie sich im Dunst als blaue Silhouette abheben statt weiß zu leuchten
          const dark = 1 - 0.45 * smooth(700, 1200, r);
          t = [t[0] * dark, t[1] * dark, t[2] * dark];
          c = [lerp(1, t[0], m), lerp(1, t[1], m), lerp(1, t[2], m)];
        }
        col[i * 3] = c[0];
        col[i * 3 + 1] = c[1];
        col[i * 3 + 2] = c[2];
      }
    }
    const idx = [];
    for (let k = 0; k < K - 1; k++) {
      for (let j = 0; j < SEG; j++) {
        const a = k * SEG + j;
        const b = k * SEG + ((j + 1) % SEG);
        const c = (k + 1) * SEG + j;
        const d = (k + 1) * SEG + ((j + 1) % SEG);
        idx.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }

  // ---------------------------------------------------------------- Welt aufbauen
  SR.buildWorld = function (scene, renderer) {
    const shootables = [];
    const sunDir = new THREE.Vector3(-0.45, 0.72, 0.55).normalize();
    const dummy = new THREE.Object3D();
    const tmpC = new THREE.Color();
    const noiseTex = SR.tex.noiseMap(7);
    const NP = noiseTex.userData.pixels;
    const NS = noiseTex.userData.size;

    // Rauschen auf der CPU abfragen (gleiche Rechnung wie im Shader, damit Gras und Boden zusammenpassen)
    function nSample(ch, u, v) {
      u -= Math.floor(u);
      v -= Math.floor(v);
      const fx = u * NS - 0.5;
      const fy = (1 - v) * NS - 0.5;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const X0 = ((x0 % NS) + NS) % NS;
      const X1 = (X0 + 1) % NS;
      const Y0 = ((y0 % NS) + NS) % NS;
      const Y1 = (Y0 + 1) % NS;
      const a = NP[(Y0 * NS + X0) * 4 + ch];
      const b = NP[(Y0 * NS + X1) * 4 + ch];
      const c = NP[(Y1 * NS + X0) * 4 + ch];
      const d = NP[(Y1 * NS + X1) * 4 + ch];
      return lerp(lerp(a, b, tx), lerp(c, d, tx), ty) / 255;
    }
    function macroAt(x, z) {
      const nL = nSample(0, x * 0.0022 + 0.13, z * 0.0022 + 0.13);
      const nM = nSample(1, x * 0.0085 + 0.57, z * 0.0085 + 0.57);
      const nS = nSample(2, x * 0.03 + 0.21, z * 0.03 + 0.21);
      const dry = smooth(0.55, 0.85, nM * 0.6 + nL * 0.4);
      const lush = smooth(0.35, 0.8, nS * 0.5 + nL * 0.5);
      const worn = 1 - smooth(8, 15, Math.hypot(x - GRAVEL.x, z - GRAVEL.z) + (nS - 0.5) * 6);
      return { dry, lush, worn, nM };
    }
    // Kiesrand (unregelmäßig)
    const gravelEdge = (x, z) => GRAVEL.r - 0.2 + (nSample(1, x * 0.045, z * 0.045) * 0.6 + nSample(2, x * 0.19, z * 0.19) * 0.4 - 0.5) * 3.2;

    // ---- Himmel
    const skyMat = skyMaterial(sunDir, noiseTex, false);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), skyMat);
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    scene.add(sky);
    // Nebel: exponentiell, Farbe so setzen, dass sie nach der sRGB-Kodierung genau der Dunstfarbe entspricht (Nebel wird in r149 erst danach eingemischt)
    const fogCol = new THREE.Color(HAZE_HEX).convertLinearToSRGB();
    scene.fog = new THREE.FogExp2(0xffffff, 0.0017);
    scene.fog.color.copy(fogCol);

    // ---- Licht
    const hemi = new THREE.HemisphereLight(0xc8dcff, 0x66733f, 0.5);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d6, 1.3);
    sun.position.copy(sunDir).multiplyScalar(60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -38;
    sc.right = 38;
    sc.top = 38;
    sc.bottom = -38;
    sc.near = 10;
    sc.far = 130;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);
    scene.add(sun.target);

    // ---- Boden: Gelände mit Wiesen-Shader
    const meadowTex = SR.tex.meadow();
    meadowTex.wrapS = meadowTex.wrapT = THREE.RepeatWrapping;
    const meadowMean = meadowTex.userData.mean;
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, vertexColors: true });
    groundMat.customProgramCacheKey = () => 'sr-ground';
    groundMat.onBeforeCompile = (shader) => {
      shader.uniforms.uDetail = { value: meadowTex };
      shader.uniforms.uNoise = { value: noiseTex };
      shader.uniforms.uMean = { value: new THREE.Vector3(meadowMean[0], meadowMean[1], meadowMean[2]) };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nuniform sampler2D uDetail;\nuniform sampler2D uNoise;\nuniform vec3 uMean;')
        .replace(
          '#include <map_fragment>',
          [
            '{',
            '  vec2 wp = vWP.xz;',
            '  vec3 d1 = texture2D(uDetail, wp * 0.34).rgb;',
            '  vec3 d2 = texture2D(uDetail, wp * 0.059 + vec2(0.37, 0.11)).rgb;',
            '  vec3 detail = d1 * (d2 / uMean);',
            '  float nL = texture2D(uNoise, wp * 0.0022 + 0.13).r;',
            '  float nM = texture2D(uNoise, wp * 0.0085 + 0.57).g;',
            '  float nS = texture2D(uNoise, wp * 0.03 + 0.21).b;',
            '  float dry = smoothstep(0.55, 0.85, nM * 0.6 + nL * 0.4);',
            '  float lush = smoothstep(0.35, 0.8, nS * 0.5 + nL * 0.5);',
            '  vec3 tn = mix(vec3(1.0), vec3(1.30, 1.10, 0.62), dry * 0.75) * mix(0.86, 1.10, lush);',
            '  vec3 alb = detail * tn;',
            '  float dc = length(wp - vec2(0.0, 0.4));',
            '  float worn = 1.0 - smoothstep(8.0, 15.0, dc + (nS - 0.5) * 6.0);',
            '  vec3 soil = vec3(0.19, 0.135, 0.09) * (0.7 + d1.g * 1.4);',
            '  alb = mix(alb, soil, worn * 0.6);',
            '  diffuseColor.rgb *= alb;',
            '}',
          ].join('\n')
        );
    };
    const terrain = new THREE.Mesh(buildTerrain(), groundMat);
    terrain.receiveShadow = true;
    terrain.frustumCulled = false;
    scene.add(terrain);
    // Treffer-Ebene für Schüsse (unsichtbar, flach; das sichtbare Gelände ist erst weit weg nicht mehr flach)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false }));
    ground.userData.surface = 'grass';
    scene.add(ground);
    shootables.push(ground);

    // ---- Kiesfläche mit weichem, ausgefranstem Rand
    const gravelTex = SR.tex.gravelFine();
    gravelTex.wrapS = gravelTex.wrapT = THREE.RepeatWrapping;
    gravelTex.repeat.set((GRAVEL.r * 2) / 1.7, (GRAVEL.r * 2) / 1.7);
    const gravelMat = new THREE.MeshStandardMaterial({ map: gravelTex, roughness: 0.95, transparent: true });
    gravelMat.customProgramCacheKey = () => 'sr-gravel';
    gravelMat.onBeforeCompile = (shader) => {
      shader.uniforms.uNoise = { value: noiseTex };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nuniform sampler2D uNoise;')
        .replace(
          '#include <color_fragment>',
          [
            '#include <color_fragment>',
            '{',
            '  float dc = length(vWP.xz - vec2(0.0, 0.4));',
            '  float nn = texture2D(uNoise, vWP.xz * 0.045).g * 0.6 + texture2D(uNoise, vWP.xz * 0.19).b * 0.4;',
            '  float edge = ' + (GRAVEL.r - 0.2).toFixed(2) + ' + (nn - 0.5) * 3.2;',
            '  float stone = dot(sampledDiffuseColor.rgb, vec3(0.33));',
            '  float a = clamp((edge - dc) / 1.9 + (stone - 0.2) * 1.4, 0.0, 1.0);',
            '  diffuseColor.a *= smoothstep(0.15, 0.6, a);',
            '}',
          ].join('\n')
        );
    };
    const gravel = new THREE.Mesh(new THREE.CircleGeometry(GRAVEL.r + 2.5, 72).rotateX(-Math.PI / 2), gravelMat);
    gravel.position.set(GRAVEL.x, 0.012, GRAVEL.z);
    gravel.receiveShadow = true;
    gravel.renderOrder = 1;
    gravel.userData.surface = 'gravel';
    scene.add(gravel);
    shootables.push(gravel);

    // ---- Betonplatte (Oberseite mit Fugen, Rissen, Flecken und Feuerlinie)
    const padTop = new THREE.MeshStandardMaterial({ map: SR.tex.concretePad(), roughness: 0.94 });
    const concSide = SR.tex.concrete();
    concSide.repeat.set(4, 0.4);
    const padSide = new THREE.MeshStandardMaterial({ map: concSide, roughness: 0.95, color: 0xb8b4aa });
    const pad = new THREE.Mesh(bevelBox(PAD.w, PAD_TOP, PAD.d, 0.018), [padTop, padSide]);
    pad.position.set(PAD.x, 0, PAD.z);
    pad.castShadow = true;
    pad.receiveShadow = true;
    pad.userData.surface = 'concrete';
    scene.add(pad);
    shootables.push(pad);

    // ---- Tisch (Holzbretter, Stahlgestell, Gummimatte)
    const topY = PAD_TOP + TABLE.height;
    const woodTex = SR.tex.planks([150, 104, 62], 41);
    const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.62, vertexColors: true });
    const R1 = SR.rng(101);
    const woodParts = [];
    const nBoards = 8;
    const boardW = TABLE.depth / nBoards;
    for (let i = 0; i < nBoards; i++) {
      const g = bevelBox(TABLE.width, 0.05, boardW - 0.003, 0.006);
      const uv = g.attributes.uv;
      const ou = R1();
      const ov = R1();
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 0.9 + ou, uv.getY(k) * 0.9 + ov);
      const k = 0.82 + R1() * 0.3;
      tint(g, [k, k * (0.98 + R1() * 0.04), k * (0.96 + R1() * 0.06)]);
      xform(g, 0, topY - 0.05, TABLE.z - TABLE.depth / 2 + boardW * (i + 0.5));
      woodParts.push(g);
    }
    // Unterbau aus Holz: Rahmen unter der Platte, vorne die Schürze (an ihr hängen die Namensschilder)
    const apronH = 0.12;
    const ap = (w, d, x, z) => xform(tint(bevelBox(w, apronH, d, 0.004), [0.8, 0.78, 0.74]), x, topY - 0.05 - apronH, z);
    woodParts.push(ap(TABLE.width - 0.06, 0.03, 0, TABLE.z + TABLE.depth / 2 - 0.03));
    woodParts.push(ap(TABLE.width - 0.06, 0.03, 0, TABLE.z - TABLE.depth / 2 + 0.045));
    woodParts.push(ap(0.03, TABLE.depth - 0.12, -TABLE.width / 2 + 0.045, TABLE.z));
    woodParts.push(ap(0.03, TABLE.depth - 0.12, TABLE.width / 2 - 0.045, TABLE.z));
    const tableWood = new THREE.Mesh(mergeGeos(woodParts), woodMat);
    tableWood.castShadow = true;
    tableWood.receiveShadow = true;
    tableWood.userData.surface = 'wood';
    scene.add(tableWood);
    shootables.push(tableWood);

    // Stahlgestell (Vierkantrohre, Querstreben, Fußplatten, Schrauben)
    const steelCol = rgbL(0.2, 0.23, 0.22);
    const steelDark = rgbL(0.1, 0.11, 0.1);
    const steelParts = [];
    const legH = TABLE.height - 0.05;
    const lx = TABLE.width / 2 - 0.08;
    const lz = TABLE.depth / 2 - 0.08;
    [-1, 1].forEach((sx) =>
      [-1, 1].forEach((sz) => {
        steelParts.push(tint(new THREE.BoxGeometry(0.06, legH, 0.06).translate(sx * lx, PAD_TOP + legH / 2, TABLE.z + sz * lz), steelCol));
        steelParts.push(tint(new THREE.BoxGeometry(0.11, 0.012, 0.11).translate(sx * lx, PAD_TOP + 0.006, TABLE.z + sz * lz), steelDark));
        // Schraubenköpfe am Beinkopf
        steelParts.push(tint(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 6).rotateX(Math.PI / 2).translate(sx * lx, PAD_TOP + legH - 0.07, TABLE.z + sz * (lz + 0.033)), rgbL(0.6, 0.6, 0.58)));
      })
    );
    const railY = PAD_TOP + 0.3;
    [-1, 1].forEach((sx) => steelParts.push(tint(new THREE.BoxGeometry(0.04, 0.04, TABLE.depth - 0.2).translate(sx * lx, railY, TABLE.z), steelCol)));
    steelParts.push(tint(new THREE.BoxGeometry(TABLE.width - 0.2, 0.04, 0.04).translate(0, railY, TABLE.z - lz), steelCol));
    steelParts.push(tint(new THREE.BoxGeometry(TABLE.width - 0.2, 0.04, 0.04).translate(0, railY, TABLE.z + lz), steelCol));
    // Winkelstahl unter der Platte
    steelParts.push(tint(new THREE.BoxGeometry(TABLE.width - 0.2, 0.03, 0.03).translate(0, topY - 0.17, TABLE.z - lz + 0.03), steelCol));
    const tableSteel = new THREE.Mesh(mergeGeos(steelParts), new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.55, vertexColors: true }));
    tableSteel.castShadow = true;
    tableSteel.receiveShadow = true;
    tableSteel.userData.surface = 'steel';
    scene.add(tableSteel);
    shootables.push(tableSteel);

    // Gummimatte mit abgerundeten Ecken
    const mw = TABLE.width - 0.12;
    const md = TABLE.depth - 0.12;
    const mr = 0.035;
    const ms = new THREE.Shape();
    ms.moveTo(-mw / 2 + mr, -md / 2);
    ms.lineTo(mw / 2 - mr, -md / 2);
    ms.absarc(mw / 2 - mr, -md / 2 + mr, mr, -Math.PI / 2, 0, false);
    ms.lineTo(mw / 2, md / 2 - mr);
    ms.absarc(mw / 2 - mr, md / 2 - mr, mr, 0, Math.PI / 2, false);
    ms.lineTo(-mw / 2 + mr, md / 2);
    ms.absarc(-mw / 2 + mr, md / 2 - mr, mr, Math.PI / 2, Math.PI, false);
    ms.lineTo(-mw / 2, -md / 2 + mr);
    ms.absarc(-mw / 2 + mr, -md / 2 + mr, mr, Math.PI, Math.PI * 1.5, false);
    const matGeo = new THREE.ExtrudeGeometry(ms, { depth: 0.006, bevelEnabled: false, curveSegments: 5 });
    matGeo.rotateX(-Math.PI / 2);
    const gripTex = SR.tex.rubberGrip();
    gripTex.repeat.set(1 / 0.12, 1 / 0.12);
    const rubber = new THREE.Mesh(matGeo, new THREE.MeshStandardMaterial({ map: gripTex, roughness: 0.92 }));
    rubber.position.set(0, topY, TABLE.z);
    rubber.castShadow = false;
    rubber.receiveShadow = true;
    rubber.userData.surface = 'wood';
    scene.add(rubber);
    shootables.push(rubber);

    // ---- Fahne
    const poleGeoParts = [];
    const poleX = 3.4;
    const poleZ = -2.2;
    poleGeoParts.push(tint(new THREE.CylinderGeometry(0.022, 0.034, 4.2, 12).translate(poleX, PAD_TOP + 2.1, poleZ), rgbL(0.62, 0.64, 0.62)));
    poleGeoParts.push(tint(new THREE.SphereGeometry(0.05, 12, 8).translate(poleX, PAD_TOP + 4.24, poleZ), rgbL(0.85, 0.66, 0.2)));
    poleGeoParts.push(tint(new THREE.CylinderGeometry(0.11, 0.12, 0.02, 14).translate(poleX, PAD_TOP + 0.01, poleZ), steelDark));
    poleGeoParts.push(tint(new THREE.CylinderGeometry(0.045, 0.06, 0.12, 12).translate(poleX, PAD_TOP + 0.07, poleZ), steelDark));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      poleGeoParts.push(tint(new THREE.CylinderGeometry(0.012, 0.012, 0.014, 6).translate(poleX + Math.cos(a) * 0.085, PAD_TOP + 0.027, poleZ + Math.sin(a) * 0.085), rgbL(0.7, 0.7, 0.68)));
    }
    // Hissleine
    poleGeoParts.push(tint(new THREE.CylinderGeometry(0.004, 0.004, 3.6, 4).translate(poleX + 0.05, PAD_TOP + 2.2, poleZ + 0.02), rgbL(0.8, 0.78, 0.7)));
    const pole = new THREE.Mesh(mergeGeos(poleGeoParts), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.6, vertexColors: true }));
    pole.castShadow = true;
    pole.receiveShadow = true;
    pole.userData.surface = 'steel';
    scene.add(pole);
    shootables.push(pole);
    const flagGeo = new THREE.PlaneGeometry(1.0, 0.64, 22, 10);
    flagGeo.translate(0.5, 0, 0);
    const flagBase = flagGeo.attributes.position.array.slice();
    const flagTex = SR.tex.flagCloth();
    const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: flagTex, roughness: 0.85, side: THREE.DoubleSide }));
    flag.position.set(poleX + 0.035, 3.88 + PAD_TOP, poleZ);
    flag.rotation.y = 0.6;
    flag.castShadow = true;
    scene.add(flag);

    // ---- Gras (Klingenbüschel, windbewegt) und Wildblumen
    function windify(mat, key, sway, heightRef, petal) {
      mat.customProgramCacheKey = () => key;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = WIND.uTime;
        shader.uniforms.uSway = { value: sway };
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uSway;' + (petal ? '\nattribute float aPetal;' : ''))
          .replace(
            '#include <begin_vertex>',
            [
              '#include <begin_vertex>',
              '{',
              '  float hk = clamp(position.y / ' + heightRef.toFixed(3) + ', 0.0, 1.0);',
              '  hk *= hk;',
              '  vec2 ip = instanceMatrix[3].xz;',
              '  float ph = ip.x * 0.31 + ip.y * 0.21;',
              '  float gust = sin(uTime * 1.5 + ph) * 0.55 + sin(uTime * 2.7 + ph * 2.3) * 0.25 + sin(uTime * 0.6 + ip.x * 0.04) * 0.5;',
              '  vec3 wl = vec3(1.0, 0.0, 0.4) * gust * uSway * hk;',
              '  mat3 im = mat3(instanceMatrix);',
              '  wl = (wl * im) / dot(im[0], im[0]);',
              '  transformed += wl;',
              '}',
            ].join('\n')
          );
        if (petal) {
          shader.vertexShader = shader.vertexShader.replace(
            '#include <color_vertex>',
            'vColor = color.rgb;\n#ifdef USE_INSTANCING_COLOR\nvColor = mix(vColor, vColor * instanceColor.rgb, aPetal);\n#endif'
          );
        }
        if (!petal) {
          // Gras: Normale nicht umdrehen (beide Seiten gleich hell)
          shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', 'float faceDirection = 1.0;\nvec3 normal = normalize(vNormal);\nvec3 geometryNormal = normal;');
        }
      };
    }

    function bladeTuft(nBlades, hMin, hMax, wBase, spread, R, simple) {
      const pos = [];
      const nor = [];
      const col = [];
      const base = rgbL(0.2, 0.31, 0.1);
      const mid = rgbL(0.4, 0.55, 0.2);
      const tip = rgbL(0.66, 0.78, 0.36);
      for (let i = 0; i < nBlades; i++) {
        const rr = spread * Math.sqrt(R());
        const ra = R() * Math.PI * 2;
        const bx = Math.cos(ra) * rr;
        const bz = Math.sin(ra) * rr;
        const a = R() * Math.PI * 2;
        const h = hMin + R() * (hMax - hMin);
        const lean = 0.15 + R() * 0.55;
        const dx = Math.cos(a);
        const dz = Math.sin(a);
        const sx = -dz;
        const sz = dx;
        const w = wBase * (0.7 + R() * 0.6);
        const ring = (t, wf) => {
          const off = lean * h * t * t;
          const cx = bx + dx * off;
          const cz = bz + dz * off;
          const cy = h * t * (1 - 0.1 * t);
          return [[cx - sx * w * wf * 0.5, cy, cz - sz * w * wf * 0.5], [cx + sx * w * wf * 0.5, cy, cz + sz * w * wf * 0.5]];
        };
        const r0 = ring(0, 1);
        const r1 = ring(0.5, 0.72);
        const tipP = ring(1, 0)[0];
        const nrm = norm3([bx * 6 + dx * 0.25, 1, bz * 6 + dz * 0.25]);
        const shade = 0.78 + R() * 0.44;
        const cb = [base[0] * shade, base[1] * shade, base[2] * shade];
        const cm = [mid[0] * shade, mid[1] * shade, mid[2] * shade];
        const ct = [tip[0] * shade, tip[1] * shade, tip[2] * shade];
        const tri = (p, q, r, c0, c1, c2) => {
          [p, q, r].forEach((v, k) => {
            pos.push(v[0], v[1], v[2]);
            nor.push(nrm[0], nrm[1], nrm[2]);
            const c = [c0, c1, c2][k];
            col.push(c[0], c[1], c[2]);
          });
        };
        if (simple) {
          // ein einzelnes Dreieck pro Halm (für mittlere und große Entfernung)
          const tp = ring(1, 0)[0];
          tri(r0[0], r0[1], tp, cb, cb, ct);
        } else {
          tri(r0[0], r0[1], r1[1], cb, cb, cm);
          tri(r0[0], r1[1], r1[0], cb, cm, cm);
          tri(r1[0], r1[1], tipP, cm, cm, ct);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      return g;
    }

    const RG = SR.rng(2024);
    // Platz für Gras: nicht auf Platte, Kies, Wegen; dünner im festgetretenen Bereich
    function grassSpot(x, z) {
      if (onPad(x, z, 0.4)) return null;
      const m = macroAt(x, z);
      const d = Math.hypot(x - GRAVEL.x, z - GRAVEL.z);
      const ge = gravelEdge(x, z);
      if (d < ge - 0.8) return null;
      let keep = smooth(ge - 0.8, ge + 3.5, d);
      keep *= 1 - 0.75 * m.worn;
      if (keep < RG()) return null;
      if (pathDist(x, z) < 0.45) return null;
      return m;
    }
    const grassCol = new THREE.Color();
    function scatterGrass(mesh, count, r0, r1, hScale) {
      let n = 0;
      let guard = 0;
      while (n < count && guard++ < count * 6) {
        const rr = Math.sqrt(lerp(r0 * r0, r1 * r1, RG()));
        const a = RG() * Math.PI * 2;
        const x = Math.sin(a) * rr;
        const z = -Math.cos(a) * rr + 0.4;
        const m = grassSpot(x, z);
        if (!m) continue;
        dummy.position.set(x, 0, z);
        dummy.rotation.set(0, RG() * 6.283, 0);
        const s = (0.75 + RG() * 0.6) * hScale * (1 - 0.25 * m.dry) * (0.92 + 0.16 * m.lush);
        dummy.scale.set(s * (0.9 + RG() * 0.3), s, s * (0.9 + RG() * 0.3));
        dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
        // Farbe: Mischung aus sattem Grün und trockenem Gelb, passend zum Boden
        const v = 0.86 + RG() * 0.28;
        const lush = 0.86 + 0.24 * m.lush;
        const dr = m.dry * 0.7;
        grassCol.setRGB(lerp(1.0, 1.9, dr) * v * lush, lerp(1.0, 1.25, dr) * v * lush, lerp(1.0, 0.55, dr) * v * lush);
        mesh.setColorAt(n, grassCol);
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    const grassMat = () => new THREE.MeshStandardMaterial({ roughness: 1, vertexColors: true, side: THREE.DoubleSide });
    // Drei Stufen: nah mit gebogenen Halmen (3 Dreiecke), weiter weg einfache Dreiecke und breitere Halme
    const grassNear = new THREE.InstancedMesh(bladeTuft(9, 0.1, 0.26, 0.02, 0.1, RG, false), grassMat(), 4200);
    windify(grassNear.material, 'sr-grass-near', 0.07, 0.26, false);
    scatterGrass(grassNear, 4200, 0, 9, 1);
    grassNear.frustumCulled = false;
    scene.add(grassNear);
    const grassMid = new THREE.InstancedMesh(bladeTuft(9, 0.12, 0.28, 0.034, 0.16, RG, true), grassMat(), 9000);
    windify(grassMid.material, 'sr-grass-mid', 0.08, 0.28, false);
    scatterGrass(grassMid, 9000, 9, 30, 1);
    grassMid.frustumCulled = false;
    scene.add(grassMid);
    const grassFar = new THREE.InstancedMesh(bladeTuft(6, 0.16, 0.3, 0.06, 0.3, RG, true), grassMat(), 9000);
    windify(grassFar.material, 'sr-grass-far', 0.08, 0.3, false);
    scatterGrass(grassFar, 9000, 30, 80, 1);
    grassFar.frustumCulled = false;
    scene.add(grassFar);

    // Wildblumen in Gruppen
    const flowerGeo = (() => {
      const R = SR.rng(77);
      const pos = [];
      const nor = [];
      const col = [];
      const pet = [];
      const stemC = rgbL(0.25, 0.42, 0.14);
      const H = 0.22;
      const tri = (a, b, c, color, p) => {
        [a, b, c].forEach((v) => {
          pos.push(v[0], v[1], v[2]);
          nor.push(0, 1, 0);
          col.push(color[0], color[1], color[2]);
          pet.push(p);
        });
      };
      const sw = 0.0045;
      tri([-sw, 0, 0], [sw, 0, 0], [0.012, H, 0], stemC, 0);
      tri([-sw, 0, 0], [0.012, H, 0], [0.004, H, 0], stemC, 0);
      tri([0, 0, -sw], [0, 0, sw], [0.012, H * 0.98, 0.0], stemC, 0);
      // zwei kleine Blätter
      tri([0.003, H * 0.25, 0], [0.05, H * 0.4, 0.01], [0.004, H * 0.32, 0], stemC, 0);
      tri([0.005, H * 0.38, 0], [-0.045, H * 0.5, -0.01], [0.004, H * 0.45, 0], stemC, 0);
      const cx = 0.012;
      const cy = H;
      const tiltX = 0.35;
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        const pt = (a, r) => [cx + Math.cos(a) * r * Math.cos(tiltX), cy + 0.012 + Math.cos(a) * r * Math.sin(tiltX), Math.sin(a) * r];
        // Blütenblätter: Dreiecke mit weißlicher Grundfarbe (Instanzfarbe wird aufmoduliert)
        tri(pt(0, 0), pt(a0, 0.036), pt((a0 + a1) / 2, 0.052), [0.95 + R() * 0.05, 0.95, 0.95], 1);
        tri(pt(0, 0), pt((a0 + a1) / 2, 0.052), pt(a1, 0.036), [0.9, 0.9, 0.9 + R() * 0.1], 1);
      }
      const yc = rgbL(0.95, 0.75, 0.15);
      for (let i = 0; i < 5; i++) {
        const a0 = (i / 5) * Math.PI * 2;
        const a1 = ((i + 1) / 5) * Math.PI * 2;
        const pt = (a, r) => [cx + Math.cos(a) * r * Math.cos(tiltX), cy + 0.016 + Math.cos(a) * r * Math.sin(tiltX), Math.sin(a) * r];
        tri(pt(0, 0), pt(a0, 0.014), pt(a1, 0.014), yc, 0);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('aPetal', new THREE.Float32BufferAttribute(pet, 1));
      return g;
    })();
    const flowerMat = new THREE.MeshStandardMaterial({ roughness: 0.9, vertexColors: true, side: THREE.DoubleSide });
    windify(flowerMat, 'sr-flower', 0.05, 0.22, true);
    const NFLOWER = 1500;
    const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, NFLOWER);
    {
      const palette = [
        [1.0, 1.0, 0.95],
        [1.0, 0.88, 0.2],
        [0.78, 0.45, 0.95],
        [0.95, 0.3, 0.3],
        [0.4, 0.55, 1.0],
        [1.0, 0.62, 0.8],
      ].map((c) => rgbL(c[0], c[1], c[2]));
      let n = 0;
      let guard = 0;
      const RF = SR.rng(555);
      while (n < NFLOWER && guard++ < 60000) {
        const rr = 10 + Math.pow(RF(), 0.8) * 60;
        const a = RF() * Math.PI * 2;
        const x = Math.sin(a) * rr;
        const z = -Math.cos(a) * rr + 0.4;
        // Gruppen: nur wo ein Rauschfeld hoch ist
        const cl = vnoise(x * 0.09 + 11, z * 0.09 + 3);
        if (cl < 0.62 || RF() > (cl - 0.55) * 2.6) continue;
        if (onPad(x, z, 0.4) || pathDist(x, z) < 0.6 || nearTarget(x, z, 1.2)) continue;
        if (Math.hypot(x - GRAVEL.x, z - GRAVEL.z) < gravelEdge(x, z) + 1.5) continue;
        dummy.position.set(x, 0, z);
        dummy.rotation.set(0, RF() * 6.283, 0);
        const s = 0.8 + RF() * 0.7;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        flowers.setMatrixAt(n, dummy.matrix);
        // pro Gruppe überwiegend eine Farbe
        const pi = Math.floor(vnoise(x * 0.05 + 40, z * 0.05 + 40) * palette.length * 0.999) % palette.length;
        const c = RF() < 0.75 ? palette[pi] : palette[Math.floor(RF() * palette.length)];
        tmpC.setRGB(c[0], c[1], c[2]);
        flowers.setColorAt(n, tmpC);
        n++;
      }
      flowers.count = n;
      flowers.instanceMatrix.needsUpdate = true;
      flowers.instanceColor.needsUpdate = true;
    }
    flowers.frustumCulled = false;
    scene.add(flowers);

    // ---- Felder in der Ferne (flache Quads mit Reihentextur) samt Zaun und Strohballen
    const fieldKinds = ['weizen', 'gruen', 'pflug', 'heu'];
    const fieldMats = {};
    fieldKinds.forEach((k) => {
      const t = SR.tex.field(k);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      fieldMats[k] = new THREE.MeshStandardMaterial({ map: t, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    });
    const fields = [];
    {
      const cands = [
        [-130, 150, 120, 66, 0.35, 'weizen'],
        [-205, 40, 70, 110, 0.12, 'gruen'],
        [150, 130, 100, 60, -0.3, 'pflug'],
        [215, -30, 64, 100, 0.2, 'weizen'],
        [30, 190, 110, 54, 0.05, 'gruen'],
        [-60, 205, 90, 60, 0.45, 'heu'],
        [190, 60, 70, 70, 0.7, 'heu'],
        [-20, -215, 120, 60, 0.0, 'gruen'],
        [170, -150, 90, 80, 0.5, 'pflug'],
        [-175, -150, 100, 70, -0.3, 'weizen'],
        [100, 220, 80, 56, 0.2, 'weizen'],
      ];
      cands.forEach((f) => {
        const [cx, cz, w, d, rot, kind] = f;
        // alle Ecken und die Mitte müssen frei von Wegen und nicht zu nah am Platz sein
        let ok = Math.hypot(cx, cz) - Math.max(w, d) * 0.5 > 108 && Math.hypot(cx, cz) + Math.max(w, d) * 0.5 < 296;
        const pts = [];
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) pts.push([i * w * 0.5, j * d * 0.5]);
        pts.forEach((p) => {
          const x = cx + p[0] * Math.cos(rot) - p[1] * Math.sin(rot);
          const z = cz + p[0] * Math.sin(rot) + p[1] * Math.cos(rot);
          if (pathDist(x, z) < 14) ok = false;
        });
        fields.forEach((o) => {
          if (Math.hypot(o.cx - cx, o.cz - cz) < (Math.max(o.w, o.d) + Math.max(w, d)) * 0.55) ok = false;
        });
        if (ok && fields.length < 6) fields.push({ cx, cz, w, d, rot, kind });
      });
      fields.forEach((f) => {
        const g = new THREE.PlaneGeometry(f.w, f.d);
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (f.w / 16), uv.getY(i) * (f.d / 16));
        g.rotateX(-Math.PI / 2);
        g.rotateY(-f.rot);
        g.translate(f.cx, 0.06, f.cz);
        const m = new THREE.Mesh(g, fieldMats[f.kind]);
        m.receiveShadow = false;
        scene.add(m);
      });
    }
    const inField = (x, z, m) =>
      fields.some((f) => {
        const dx = x - f.cx;
        const dz = z - f.cz;
        const lx2 = dx * Math.cos(f.rot) + dz * Math.sin(f.rot);
        const lz2 = -dx * Math.sin(f.rot) + dz * Math.cos(f.rot);
        return Math.abs(lx2) < f.w / 2 + m && Math.abs(lz2) < f.d / 2 + m;
      });

    // Zaun um die Felder (Pfosten + eine Latte, niedrig) und runde Heuballen auf den Heufeldern
    {
      const posts = [];
      const rails = [];
      const bales = [];
      fields.forEach((f) => {
        const c = Math.cos(f.rot);
        const sn = Math.sin(f.rot);
        const toW = (lx, lz) => [f.cx + lx * c - lz * sn, f.cz + lx * sn + lz * c];
        const side = (ax, az, bx, bz) => {
          const L = Math.hypot(bx - ax, bz - az);
          const n = Math.max(1, Math.round(L / 5));
          for (let i = 0; i <= n; i++) {
            const t = i / n;
            const w = toW(ax + (bx - ax) * t, az + (bz - az) * t);
            posts.push([w[0], w[1]]);
          }
          const w0 = toW(ax, az);
          const w1 = toW(bx, bz);
          rails.push([(w0[0] + w1[0]) / 2, (w0[1] + w1[1]) / 2, Math.atan2(-(w1[1] - w0[1]), w1[0] - w0[0]), L]);
        };
        const hw = f.w / 2 + 0.6;
        const hd = f.d / 2 + 0.6;
        side(-hw, -hd, hw, -hd);
        side(hw, -hd, hw, hd);
        side(hw, hd, -hw, hd);
        side(-hw, hd, -hw, -hd);
        if (f.kind === 'heu' && Math.hypot(f.cx, f.cz) > 135) {
          for (let i = 0; i < 9; i++) {
            const w = toW((hash2(i, 3) - 0.5) * f.w * 0.7, (hash2(i, 9) - 0.5) * f.d * 0.7);
            bales.push([w[0], w[1], hash2(i, 5) * 3.14]);
          }
        }
      });
      const fenceMat = new THREE.MeshStandardMaterial({ color: 0x6b5a46, roughness: 1 });
      const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 1.0, 0.09).translate(0, 0.5, 0), fenceMat, Math.max(1, posts.length));
      posts.forEach((p, i) => {
        dummy.position.set(p[0], 0, p[1]);
        dummy.rotation.set(0, hash2(i, 1) * 3, 0);
        dummy.scale.set(1, 0.85 + hash2(i, 2) * 0.15, 1);
        dummy.updateMatrix();
        pm.setMatrixAt(i, dummy.matrix);
      });
      pm.frustumCulled = false;
      scene.add(pm);
      const rm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.05, 0.025), fenceMat, Math.max(1, rails.length * 2));
      rails.forEach((r, i) => {
        [0.55, 0.92].forEach((y, k) => {
          dummy.position.set(r[0], y, r[1]);
          dummy.rotation.set(0, r[2], 0);
          dummy.scale.set(r[3], 1, 1);
          dummy.updateMatrix();
          rm.setMatrixAt(i * 2 + k, dummy.matrix);
        });
      });
      rm.frustumCulled = false;
      scene.add(rm);
      if (bales.length) {
        const bt = SR.tex.straw();
        bt.repeat.set(2, 1);
        const bm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.5, 1.1, 14).rotateZ(Math.PI / 2).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ map: bt, roughness: 1 }), bales.length);
        bales.forEach((b, i) => {
          dummy.position.set(b[0], 0, b[1]);
          dummy.rotation.set(0, b[2], 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          bm.setMatrixAt(i, dummy.matrix);
        });
        bm.frustumCulled = false;
        scene.add(bm);
      }
    }

    // ---- Bäume, Büsche, Felsen
    const bark = {
      eiche: SR.tex.bark('eiche'),
      birke: SR.tex.bark('birke'),
    };
    const leafTex = { eiche: SR.tex.leaves('eiche'), birke: SR.tex.leaves('birke'), busch: SR.tex.leaves('busch') };
    function leafMaterial(tex, key) {
      const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, vertexColors: true, side: THREE.DoubleSide, alphaTest: 0.32 });
      m.customProgramCacheKey = () => key;
      m.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', 'float faceDirection = 1.0;\nvec3 normal = normalize(vNormal);\nvec3 geometryNormal = normal;');
      };
      return m;
    }
    const solidMat = new THREE.MeshStandardMaterial({ roughness: 1, vertexColors: true, side: THREE.DoubleSide });
    solidMat.customProgramCacheKey = () => 'sr-solid';
    solidMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', 'float faceDirection = 1.0;\nvec3 normal = normalize(vNormal);\nvec3 geometryNormal = normal;');
    };
    const trunkMats = {
      eiche: new THREE.MeshStandardMaterial({ map: bark.eiche, roughness: 1, vertexColors: true }),
      birke: new THREE.MeshStandardMaterial({ map: bark.birke, roughness: 0.85, vertexColors: true }),
    };

    // Laubbaum aus Stamm, Ästen, dunklem Kern und Laubkarten
    function broadleaf(R, o) {
      const barkC = o.birch ? rgbL(0.95, 0.94, 0.9) : rgbL(0.9, 0.82, 0.74);
      const trunk = [];
      const H = o.trunkH;
      trunk.push(trunkGeo(0, 0, 0, o.birch ? 0.17 : 0.3, o.birch ? 0.08 : 0.15, H, (R() - 0.5) * 0.6, (R() - 0.5) * 0.6, barkC, H * 0.8));
      const blobs = o.blobs.map((b) => ({ x: b[0], y: b[1], z: b[2], r: b[3], sy: b[4] || 1 }));
      blobs.forEach((b) => {
        const dx = b.x;
        const dz = b.z;
        const len = Math.hypot(dx, dz) || 1;
        trunk.push(branchGeo([dx * 0.05, H * 0.9, dz * 0.05], [b.x * 0.6, b.y - b.r * 0.2, b.z * 0.6], 0.09, 0.03, barkC));
      });
      const topY0 = Math.max.apply(null, blobs.map((b) => b.y + b.r));
      const botY0 = Math.min.apply(null, blobs.map((b) => b.y - b.r));
      const cards = leafCards(blobs, R, {
        density: o.density,
        size: o.leaf,
        upBlend: 0.35,
        inner: 0.34,
        col: (dd, y, rnd, inner) => {
          const t = clamp((y - botY0) / (topY0 - botY0), 0, 1);
          const k = (0.5 + 0.55 * t) * (0.72 + 0.4 * smooth(-0.7, 0.9, dd[1])) * (0.92 + rnd() * 0.16) * (inner ? 0.5 : 1);
          const hue = o.birch ? 78 + rnd() * 18 : 92 + rnd() * 20;
          const sat = o.birch ? 0.6 : 0.5;
          const c = hslL(hue, sat, 0.45);
          // Textur ist bereits grün: Vertexfarbe nur als Helligkeit/Tönung
          return [c[0] * k * 3.4, c[1] * k * 3.4, c[2] * k * 3.4];
        },
      });
      return { trunk: mergeGeos(trunk), core: null, cards };
    }
    function oakShape(R, tall) {
      const s = 1;
      const H = tall ? 3.1 : 2.2;
      const cy = tall ? 6.6 : 5.0;
      const blobs = tall
        ? [[0, cy, 0, 2.9, 1.15], [1.5, cy - 1.0, 0.5, 2.0], [-1.4, cy - 0.6, -0.6, 2.1], [0.2, cy + 1.7, -0.2, 1.8], [0.2, cy - 1.3, -1.6, 1.8]]
        : [[0, cy, 0, 3.1, 0.9], [2.1, cy - 0.5, 0.8, 2.3], [-2.0, cy - 0.3, -0.7, 2.4], [0.5, cy + 1.2, -0.3, 2.0], [0.3, cy - 0.8, 2.0, 2.0], [-0.6, cy - 0.7, -2.2, 2.0]];
      return broadleaf(R, { trunkH: H, blobs: blobs.map((b) => b.map((v) => v * s)), density: 14, leaf: [1.1, 1.7] });
    }
    function birchShape(R) {
      const cy = 6.2;
      const blobs = [[0, cy, 0, 1.9, 1.5], [0.7, cy - 1.7, 0.3, 1.3, 1.2], [-0.6, cy + 1.2, -0.3, 1.3, 1.2], [0.2, cy - 0.5, -1.0, 1.2, 1.1]];
      return broadleaf(R, { birch: true, trunkH: 4.6, blobs, density: 16, leaf: [0.75, 1.15] });
    }
    // Nadelbaum: gestufte Kegel mit ausgefranstem Rand
    function conifer(R, o) {
      const parts = [];
      const H = o.h;
      parts.push(trunkGeo(0, 0, 0, 0.26, 0.07, H * 0.96, (R() - 0.5) * 0.3, (R() - 0.5) * 0.3, rgbL(0.35, 0.27, 0.2), 1));
      const nT = o.tiers;
      for (let t = 0; t < nT; t++) {
        const u = t / (nT - 1);
        const y0 = H * (o.bare + (0.96 - o.bare) * Math.pow(u, 0.9)) - H * 0.02;
        const tierH = H * (0.34 - 0.18 * u) * (o.tall || 1);
        const rad = o.r * Math.pow(1 - u, 0.78) + 0.18;
        const seg = 14;
        const pos = [];
        const nor = [];
        const col = [];
        const ring = [];
        for (let j = 0; j < seg; j++) {
          const a = (j / seg) * Math.PI * 2 + R() * 0.2;
          const rr = rad * (0.72 + R() * 0.55);
          ring.push([Math.cos(a) * rr, y0 + (R() - 0.5) * 0.18 * tierH - 0.12 * rr, Math.sin(a) * rr, a]);
        }
        const tip = [0, y0 + tierH, 0];
        const bright = (0.8 + 0.5 * u) * (0.9 + R() * 0.2);
        for (let j = 0; j < seg; j++) {
          const a = ring[j];
          const b = ring[(j + 1) % seg];
          const sh = 0.82 + R() * 0.34;
          const am = (a[3] + b[3] + (b[3] < a[3] ? Math.PI * 2 : 0)) / 2;
          const nrm = norm3([Math.cos(am) * tierH, rad * 0.8, Math.sin(am) * tierH]);
          [a, tip, b].forEach((v, k) => {
            pos.push(v[0], v[1], v[2]);
            nor.push(nrm[0], nrm[1] + 0.2, nrm[2]);
            const dark = (k === 1 ? 1.0 : 0.6) * sh;
            const c = o.pine ? rgbL(0.1 * bright * dark * 1.6, 0.2 * bright * dark * 1.6, 0.13 * bright * dark * 1.6) : rgbL(0.07 * bright * dark * 1.8, 0.2 * bright * dark * 1.8, 0.08 * bright * dark * 1.8);
            col.push(c[0], c[1], c[2]);
          });
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        parts.push(g);
      }
      return mergeGeos(parts);
    }
    // Kiefer: hoher kahler Stamm, flache Kronenballen
    function pine(R) {
      const parts = [];
      const H = 11;
      parts.push(trunkGeo(0, 0, 0, 0.3, 0.12, H * 0.8, 0.5, -0.3, rgbL(0.55, 0.38, 0.25), 1));
      const blobsP = [[0.3, H * 0.84, -0.1, 2.3, 0.66], [-1.8, H * 0.74, 0.5, 1.9, 0.62], [1.9, H * 0.7, 0.6, 1.8, 0.62], [0.0, H * 0.95, 0.0, 1.6, 0.68], [-0.4, H * 0.62, -1.7, 1.5, 0.6], [1.0, H * 0.6, -1.3, 1.3, 0.6]];
      blobsP.forEach((b) => {
        parts.push(
          blob(b[0], b[1], b[2], b[3], b[4], 2, R, 0.3, (nx, ny, nz, y) => {
            const k = 0.55 + 0.5 * smooth(-0.8, 1, ny);
            return rgbL(0.08 * k * 1.9, 0.2 * k * 1.9, 0.11 * k * 1.9);
          })
        );
      });
      return mergeGeos(parts);
    }
    // Einfaches Fernmodell (nur Vertexfarben): Stamm + wenige Kugeln
    function farBroad(R, birch) {
      const parts = [];
      parts.push(trunkGeo(0, 0, 0, 0.3, 0.14, 2.4, 0, 0, birch ? rgbL(0.9, 0.9, 0.86) : rgbL(0.4, 0.31, 0.24), 1));
      const bl = birch ? [[0, 5.6, 0, 1.9, 1.5], [0.6, 4.2, 0.3, 1.3, 1.2]] : [[0, 4.6, 0, 3.0, 0.95], [1.9, 4.0, 0.7, 2.1, 1], [-1.8, 4.2, -0.6, 2.2, 1], [0.3, 5.9, -0.3, 1.9, 1]];
      bl.forEach((b) => {
        parts.push(
          blob(b[0], b[1], b[2], b[3], b[4], 0, R, 0.2, (nx, ny, nz, y) => {
            const k = 0.5 + 0.55 * smooth(-0.9, 0.9, ny);
            return birch ? rgbL(0.2 * k * 1.9, 0.3 * k * 1.9, 0.1 * k * 1.9) : rgbL(0.12 * k * 1.9, 0.22 * k * 1.9, 0.07 * k * 1.9);
          })
        );
      });
      return mergeGeos(parts);
    }

    const RT = SR.rng(1337);
    // Bäume platzieren: in Gruppen, nie auf Wegen, nicht in Feldern, nicht näher als 100 m
    const trees = [];
    {
      const accept = (x, z, minGap, mapped) => {
        for (let i = 0; i < trees.length; i++) if (Math.hypot(trees[i].x - x, trees[i].z - z) < minGap) return false;
        return true;
      };
      let tries = 0;
      const NNEAR = 120;
      const NFAR = 1000;
      let near = 0;
      let far = 0;
      while ((near < NNEAR || far < NFAR) && tries++ < 90000) {
        const a = RT() * Math.PI * 2;
        const wantFar = far < NFAR && (near >= NNEAR || RT() < 0.8);
        const r = wantFar ? 260 + Math.pow(RT(), 1.3) * 760 : 98 + RT() * 170;
        const x = Math.sin(a) * r;
        const z = -Math.cos(a) * r;
        const f = forestAt(x, z);
        const open = fbm(x * 0.0062 + 50, z * 0.0062 + 80, 4);
        const keep = open > 0.54 ? 1 : open > 0.46 ? 0.35 : r > 420 ? 0.12 : 0.04;
        if (RT() > keep * (wantFar ? 1 : 0.9)) continue;
        if (pathDist(x, z) < 9 || inField(x, z, 8)) continue;
        const h = terrainH(x, z);
        const gx = (terrainH(x + 5, z) - terrainH(x - 5, z)) / 10;
        const gz = (terrainH(x, z + 5) - terrainH(x, z - 5)) / 10;
        if (Math.hypot(gx, gz) > 0.55) continue;
        if (!accept(x, z, wantFar ? 7 : 6)) continue;
        const sp = fbm(x * 0.004 + 10, z * 0.004 - 30, 3);
        let kind;
        const q = RT();
        if (h > 45 || sp > 0.56) kind = q < 0.7 ? 'fichte' : q < 0.85 ? 'kiefer' : 'eiche';
        else if (sp < 0.42) kind = q < 0.6 ? 'eiche' : q < 0.8 ? 'birke' : 'fichte';
        else kind = q < 0.35 ? 'eiche' : q < 0.55 ? 'fichte' : q < 0.7 ? 'birke' : q < 0.82 ? 'kiefer' : 'eiche';
        trees.push({ x, y: h - 0.15, z, kind, far: wantFar && r > 330, r, s: 0.8 + RT() * 0.55, rot: RT() * 6.283, v: RT(), hue: RT() });
        if (wantFar) far++;
        else near++;
      }
    }
    // Instanzen anlegen
    const treeMeshes = [];
    function makeSet(geoTrunk, geoCore, geoCards, trunkMat, leafMat, count) {
      const set = { n: 0 };
      const mk = (geo, mat) => {
        if (!geo) return null;
        const m = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
        m.count = 0;
        m.frustumCulled = false;
        scene.add(m);
        treeMeshes.push(m);
        return m;
      };
      set.trunk = mk(geoTrunk, trunkMat);
      set.core = mk(geoCore, solidMat);
      set.cards = mk(geoCards, leafMat);
      return set;
    }
    const Rg = SR.rng(31);
    const oakA = oakShape(Rg, false);
    const oakB = oakShape(Rg, true);
    const birch = birchShape(Rg);
    const count = (pred) => trees.filter(pred).length;
    const nOakNear = count((t) => t.kind === 'eiche' && !t.far);
    const nBirNear = count((t) => t.kind === 'birke' && !t.far);
    const sets = {
      eicheA: makeSet(oakA.trunk, oakA.core, oakA.cards, trunkMats.eiche, leafMaterial(leafTex.eiche, 'sr-leaf-eiche'), nOakNear),
      eicheB: makeSet(oakB.trunk, oakB.core, oakB.cards, trunkMats.eiche, leafMaterial(leafTex.eiche, 'sr-leaf-eiche'), nOakNear),
      birke: makeSet(birch.trunk, birch.core, birch.cards, trunkMats.birke, leafMaterial(leafTex.birke, 'sr-leaf-birke'), nBirNear),
      fichteA: makeSet(conifer(Rg, { h: 14, tiers: 8, r: 2.5, bare: 0.1 }), null, null, solidMat, null, trees.length),
      fichteB: makeSet(conifer(Rg, { h: 10, tiers: 6, r: 2.1, bare: 0.14, tall: 1.1 }), null, null, solidMat, null, trees.length),
      kiefer: makeSet(pine(Rg), null, null, solidMat, null, trees.length),
      fernEiche: makeSet(farBroad(Rg, false), null, null, solidMat, null, trees.length),
      fernBirke: makeSet(farBroad(Rg, true), null, null, solidMat, null, trees.length),
    };
    function addInst(set, t, sx, sy, tintRGB) {
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(0, t.rot, 0);
      dummy.scale.set(sx, sy, sx * (0.92 + t.v * 0.16));
      dummy.updateMatrix();
      tmpC.setRGB(tintRGB[0], tintRGB[1], tintRGB[2]);
      ['trunk', 'core', 'cards'].forEach((k) => {
        const m = set[k];
        if (!m) return;
        m.setMatrixAt(m.count, dummy.matrix);
        m.setColorAt(m.count, k === 'trunk' ? tmpC.setRGB(1, 1, 1) : tmpC.setRGB(tintRGB[0], tintRGB[1], tintRGB[2]));
        m.count++;
      });
    }
    let altA = 0;
    trees.forEach((t) => {
      const v = 0.82 + t.v * 0.36;
      const yel = 0.9 + t.hue * 0.3;
      const tn = [v * yel, v, v * (1.1 - (yel - 0.9))];
      // weit entfernte Bäume wirken sonst winzig: etwas größer skalieren
      const grow = t.far ? 1 + (t.r - 330) / 900 : 1;
      const s = t.s * grow;
      if (t.kind === 'eiche') {
        if (t.far) addInst(sets.fernEiche, t, s * 1.15, s * 1.15, tn);
        else addInst(altA++ % 2 ? sets.eicheA : sets.eicheB, t, s, s, tn);
      } else if (t.kind === 'birke') {
        if (t.far) addInst(sets.fernBirke, t, s * 1.1, s * 1.1, tn);
        else addInst(sets.birke, t, s, s, tn);
      } else if (t.kind === 'fichte') {
        addInst(t.v < 0.5 ? sets.fichteA : sets.fichteB, t, s * (0.85 + t.hue * 0.3), s * (0.95 + t.hue * 0.3), tn);
      } else {
        addInst(sets.kiefer, t, s, s, tn);
      }
    });
    treeMeshes.forEach((m) => {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });

    // Büsche (Kern + Laubkarten): niedrig in Platznähe, höher in der Ferne
    {
      const RB = SR.rng(909);
      const bushBlobs = [{ x: 0, y: 0.5, z: 0, r: 0.72, sy: 0.8 }, { x: 0.55, y: 0.38, z: 0.2, r: 0.5, sy: 0.8 }, { x: -0.5, y: 0.4, z: -0.25, r: 0.55, sy: 0.8 }, { x: 0.1, y: 0.45, z: -0.55, r: 0.45, sy: 0.8 }];
      const bushCards = leafCards(bushBlobs, RB, {
        density: 40,
        size: [0.28, 0.46],
        upBlend: 0.4,
        inner: 0.3,
        col: (dd, y, rnd, inner) => {
          const k = (0.55 + 0.6 * smooth(0.0, 0.9, y)) * (0.8 + 0.45 * smooth(-0.6, 0.9, dd[1])) * (0.9 + rnd() * 0.2) * (inner ? 0.55 : 1);
          const c = hslL(96 + rnd() * 22, 0.5, 0.45);
          return [c[0] * k * 3.2, c[1] * k * 3.2, c[2] * k * 3.2];
        },
      });
      const bushCore = null;
      const NB = 150;
      const bs = makeSet(null, bushCore, bushCards, null, leafMaterial(leafTex.busch, 'sr-leaf-busch'), NB);
      let n = 0;
      let guard = 0;
      while (n < NB && guard++ < 20000) {
        const near = RB() < 0.55;
        const r = near ? 22 + RB() * 100 : 110 + Math.pow(RB(), 1.2) * 280;
        const a = RB() * Math.PI * 2;
        const x = Math.sin(a) * r;
        const z = -Math.cos(a) * r;
        if (pathDist(x, z) < 3.5 || nearTarget(x, z, 6) || inField(x, z, 3) || onPad(x, z, 3)) continue;
        if (Math.hypot(x - GRAVEL.x, z - GRAVEL.z) < GRAVEL.r + 4) continue;
        // in der Nähe niedrig, sonst auch größer; nur dort, wo Waldrand/Gebüsch-Rauschen hoch ist
        const bn = vnoise(x * 0.03 + 7, z * 0.03 + 19);
        if (bn < 0.5 && RB() > 0.25) continue;
        const sc = r < 130 ? 0.5 + RB() * 0.5 : 0.8 + RB() * 1.1;
        const t = { x, y: terrainH(x, z) - 0.05, z, rot: RB() * 6.283, v: RB() };
        const v = 0.8 + RB() * 0.4;
        addInst(bs, t, sc * (1 + RB() * 0.3), sc, [v * (0.95 + RB() * 0.2), v, v * 0.9]);
        n++;
      }
      [bs.cards].forEach((m) => {
        m.instanceMatrix.needsUpdate = true;
        m.instanceColor.needsUpdate = true;
      });
    }

    // Felsen: verformte Ikosaeder (in der Nähe klein, weiter weg große Brocken)
    {
      const RR = SR.rng(4711);
      const rocksGeo = (() => {
        const g = blob(0, 0, 0, 1, 0.7, 2, RR, 0.34, null, true);
        const p = g.attributes.position;
        const nrm = g.attributes.normal;
        const col = new Float32Array(p.count * 3);
        for (let i = 0; i < p.count; i += 3) {
          // je Fläche eine leicht andere Farbe
          const k = 0.78 + RR() * 0.3;
          for (let j = 0; j < 3; j++) {
            const ny = nrm.getY(i + j);
            const moss = smooth(0.55, 0.95, ny);
            const y = p.getY(i + j);
            const ao = 0.62 + 0.38 * smooth(-0.6, 0.5, y);
            const c = rgbL(0.62 * k * ao * (1 - moss * 0.3), (0.6 + moss * 0.05) * k * ao, 0.55 * k * ao * (1 - moss * 0.45));
            col[(i + j) * 3] = c[0];
            col[(i + j) * 3 + 1] = c[1];
            col[(i + j) * 3 + 2] = c[2];
          }
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        return g;
      })();
      const NR = 70;
      const rocks = new THREE.InstancedMesh(rocksGeo, new THREE.MeshStandardMaterial({ roughness: 0.95, vertexColors: true, flatShading: true }), NR);
      let n = 0;
      let guard = 0;
      while (n < NR && guard++ < 20000) {
        const nearRock = n < 28;
        const r = nearRock ? 16 + RR() * 112 : 150 + RR() * 480;
        const a = RR() * Math.PI * 2;
        const x = Math.sin(a) * r;
        const z = -Math.cos(a) * r;
        if (pathDist(x, z) < (nearRock ? 3 : 10) || nearTarget(x, z, 6) || inField(x, z, 3) || onPad(x, z, 4)) continue;
        if (Math.hypot(x - GRAVEL.x, z - GRAVEL.z) < GRAVEL.r + 3) continue;
        const s = nearRock ? 0.22 + Math.pow(RR(), 1.8) * 0.55 : 1.2 + Math.pow(RR(), 1.6) * 4.2;
        dummy.position.set(x, terrainH(x, z) + s * 0.12, z);
        dummy.rotation.set((RR() - 0.5) * 0.3, RR() * 6.283, (RR() - 0.5) * 0.3);
        dummy.scale.set(s * (1 + RR() * 0.5), s * (0.7 + RR() * 0.5), s * (0.9 + RR() * 0.5));
        dummy.updateMatrix();
        rocks.setMatrixAt(n, dummy.matrix);
        n++;
      }
      rocks.count = n;
      rocks.castShadow = true;
      rocks.receiveShadow = true;
      rocks.frustumCulled = false;
      rocks.userData.surface = 'concrete';
      scene.add(rocks);
      shootables.push(rocks);
    }

    // ---- Requisiten rund um den Stand (außerhalb der freigehaltenen Fläche)
    {
      const props = new THREE.Group();
      scene.add(props);
      const RP = SR.rng(606);
      const addMesh = (geo, mat, surface, cast) => {
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = cast !== false;
        m.receiveShadow = true;
        m.userData.surface = surface;
        props.add(m);
        shootables.push(m);
        return m;
      };
      const addInstanced = (geo, mat, surface, mats, colors) => {
        const m = new THREE.InstancedMesh(geo, mat, mats.length);
        mats.forEach((mx, i) => {
          m.setMatrixAt(i, mx);
          if (colors) m.setColorAt(i, colors[i]);
        });
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
        m.userData.surface = surface;
        props.add(m);
        shootables.push(m);
        return m;
      };
      const M4 = (x, y, z, ry, sx, sy, sz, rx, rz) => {
        dummy.position.set(x, y, z);
        dummy.rotation.set(rx || 0, ry || 0, rz || 0);
        dummy.scale.set(sx || 1, sy || 1, sz || sx || 1);
        dummy.updateMatrix();
        return dummy.matrix.clone();
      };

      // Sandsäcke: zwei niedrige Wälle hinter dem Platz (Mitte bleibt offen, damit man nach hinten sehen kann)
      {
        const sackGeo = new THREE.SphereGeometry(0.5, 12, 8);
        {
          const p = sackGeo.attributes.position;
          const Rs = SR.rng(7);
          for (let i = 0; i < p.count; i++) {
            const x = p.getX(i);
            const y = p.getY(i);
            const z = p.getZ(i);
            // Kissenform: Ecken betonen, oben abflachen
            const k = 1 + 0.12 * (Math.abs(x) * Math.abs(z) * 4) - 0.1 * Math.max(0, y) * 0;
            p.setXYZ(i, x * k, y * (y > 0 ? 0.8 : 1), z * k);
          }
          sackGeo.computeVertexNormals();
        }
        const sackTex = SR.tex.sack();
        sackTex.repeat.set(2, 2);
        const sackMat = new THREE.MeshStandardMaterial({ map: sackTex, roughness: 1 });
        const mats = [];
        const cols = [];
        const wall = (x0, x1, z, courses) => {
          const L = 0.56;
          for (let c = 0; c < courses; c++) {
            const off = c % 2 ? L / 2 : 0;
            for (let x = x0 + off; x < x1 - 0.1; x += L) {
              const jx = (RP() - 0.5) * 0.04;
              const jz = (RP() - 0.5) * 0.07;
              mats.push(M4(x + jx, 0.11 + c * 0.17, z + jz + (c % 2 ? 0.03 : 0), (RP() - 0.5) * 0.12, L * 0.98, 0.3, 0.46));
              const v = 0.84 + RP() * 0.3;
              cols.push(tmpC.clone().setRGB(v * 0.82, v * 0.8 * (0.96 + RP() * 0.06), v * 0.74 * (0.9 + RP() * 0.1)));
            }
          }
        };
        wall(-4.0, -1.3, 5.75, 3);
        wall(1.3, 4.0, 5.75, 3);
        wall(-3.6, -1.8, 6.2, 2);
        wall(1.8, 3.6, 6.2, 2);
        addInstanced(sackGeo, sackMat, 'gravel', mats, cols);
      }

      // Fässer
      {
        const prof = [];
        const pts = [[0.0, 0], [0.27, 0], [0.292, 0.02], [0.29, 0.07], [0.275, 0.1], [0.29, 0.13], [0.292, 0.3], [0.305, 0.44], [0.292, 0.58], [0.29, 0.75], [0.275, 0.78], [0.29, 0.81], [0.292, 0.86], [0.27, 0.88], [0.255, 0.865], [0.22, 0.87], [0, 0.87]];
        pts.forEach((p) => prof.push(new THREE.Vector2(p[0], p[1])));
        const barrelGeo = new THREE.LatheGeometry(prof, 20);
        const mk = (color, list) => {
          const mat = new THREE.MeshStandardMaterial({ map: SR.tex.barrel(color), roughness: 0.5, metalness: 0.55 });
          addInstanced(barrelGeo, mat, 'steel', list);
        };
        mk('#2f5f8a', [M4(-7.3, 0, 5.6, 0.4, 1), M4(-8.0, 0, 6.15, 1.2, 1), M4(-7.7, 0, 4.95, 0.9, 1, 1, 1, Math.PI / 2, 0)]);
        mk('#8d2d27', [M4(7.5, 0, 5.4, 0.2, 1), M4(8.15, 0, 5.95, 2.4, 1)]);
      }
      // Kisten
      {
        const crateTex = SR.tex.planks([160, 120, 74], 12);
        crateTex.repeat.set(1, 1);
        const crateGeo = bevelBox(0.62, 0.62, 0.62, 0.012);
        const g = new THREE.BoxGeometry(0.62, 0.62, 0.62).translate(0, 0.31, 0);
        const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.85 });
        addInstanced(g, crateMat, 'wood', [M4(-6.9, 0, 7.15, 0.3, 1), M4(-6.3, 0, 7.25, -0.2, 1), M4(-6.7, 0.62, 7.2, 0.5, 0.9), M4(6.6, 0, 7.0, 0.15, 1)]);
        crateGeo.dispose();
      }
      // Strohballen (vorne links und rechts, abseits der Schusslinien)
      {
        const strawTex = SR.tex.straw();
        const baleGeo = bevelBox(0.9, 0.46, 0.46, 0.03);
        const bm = new THREE.MeshStandardMaterial({ map: strawTex, roughness: 1 });
        const mats = [];
        const cols = [];
        const place = (x, y, z, ry) => {
          mats.push(M4(x, y, z, ry, 1));
          const v = 0.85 + RP() * 0.25;
          cols.push(tmpC.clone().setRGB(v, v * 0.97, v * 0.9));
        };
        place(-6.6, 0, -5.8, 0.25);
        place(-5.65, 0, -5.55, -0.1);
        place(-6.15, 0.46, -5.7, 0.1);
        place(6.9, 0, -6.4, -0.2);
        place(7.8, 0, -6.2, 0.3);
        // Ballen sind bevelBox mit Gruppen -> als Einzelgeometrie ohne Gruppen verwenden
        baleGeo.clearGroups();
        addInstanced(baleGeo, bm, 'grass', mats, cols);
      }
      // Schilder auf Holzpfosten
      {
        const postMat = new THREE.MeshStandardMaterial({ map: SR.tex.planks([120, 86, 52], 5), roughness: 0.9, vertexColors: true });
        const posts = [];
        const sign = (x, z, ry, lines, style, w, h, y0) => {
          const woodC = [0.75, 0.72, 0.68];
          [-1, 1].forEach((sx) => {
            const g = new THREE.BoxGeometry(0.09, y0 + h + 0.1, 0.09).translate(sx * (w / 2 - 0.12), (y0 + h + 0.1) / 2, 0);
            tint(g, woodC);
            g.rotateY(ry);
            g.translate(x, 0, z);
            posts.push(g);
          });
          const tex = SR.tex.sign(lines, style, 512, Math.round(512 * (h / w)));
          const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
          board.position.set(0, y0 + h / 2, 0.065);
          const grp = new THREE.Group();
          grp.add(board);
          grp.position.set(x, 0, z);
          grp.rotation.y = ry;
          board.castShadow = true;
          board.receiveShadow = true;
          board.userData.surface = 'wood';
          props.add(grp);
          shootables.push(board);
        };
        sign(-5.3, -3.6, 0.35, [{ text: 'ACHTUNG', size: 0.34 }, { text: 'SCHIESSBETRIEB', size: 0.3 }], 'warn', 1.3, 0.62, 0.7);
        sign(6.3, -6.8, -0.5, [{ text: 'STAND 1', size: 0.42 }, { text: 'Nur nach vorn schießen', size: 0.2, weight: '500' }], 'info', 1.2, 0.6, 0.65);
        sign(-6.2, 8.4, 0.9, [{ text: 'GEHÖRSCHUTZ', size: 0.3 }, { text: 'TRAGEN', size: 0.3 }], 'rot', 1.1, 0.55, 0.6);
        const pm = new THREE.Mesh(mergeGeos(posts), postMat);
        pm.castShadow = true;
        pm.receiveShadow = true;
        pm.userData.surface = 'wood';
        props.add(pm);
        shootables.push(pm);
      }
    }

    // ---- Umgebungs-Reflexionen für Metall (aus einem kleinen Himmel erzeugt)
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMaterial(sunDir, noiseTex, true)));
    const envGround = new THREE.Mesh(new THREE.CircleGeometry(45, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x55683a }));
    envGround.position.y = -2;
    envScene.add(envGround);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envMap = pmrem.fromScene(envScene, 0.02, 0.1, 200).texture;
    scene.environment = envMap;
    pmrem.dispose();

    // ---- Animation: Wolken, Gras im Wind, Fahne
    function update(t) {
      skyMat.uniforms.uTime.value = t;
      WIND.uTime.value = t;
      const p = flagGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = flagBase[i * 3];
        const y = flagBase[i * 3 + 1];
        const amp = x * (0.05 + 0.11 * x);
        const w = Math.sin(x * 7.5 - t * 5.0 + y * 2.2) * amp + Math.sin(x * 14 - t * 8.3 + y * 3.1) * 0.022 * x + Math.sin(t * 1.3) * 0.03 * x;
        p.array[i * 3] = x - w * w * 1.6;
        p.array[i * 3 + 1] = y - x * x * 0.05 + Math.sin(t * 1.9 + x * 3) * 0.012 * x;
        p.array[i * 3 + 2] = w;
      }
      p.needsUpdate = true;
      flagGeo.computeVertexNormals();
    }

    return {
      sunDir,
      sun,
      sky,
      envMap,
      shootables,
      padTop: PAD_TOP,
      table: {
        topY: topY + 0.006,
        z: TABLE.z,
        width: TABLE.width,
        depth: TABLE.depth,
        frontZ: TABLE.z + TABLE.depth / 2,
        apronY: topY - 0.11,
        minX: -TABLE.width / 2,
        maxX: TABLE.width / 2,
        minZ: TABLE.z - TABLE.depth / 2,
        maxZ: TABLE.z + TABLE.depth / 2,
      },
      bounds: { minX: -3.3, maxX: 3.3, minZ: -2.1, maxZ: 3.3 },
      update,
      // zusätzlich: Geländehöhe an einer Stelle (0 im ganzen Spielbereich, Hügel erst weit draußen)
      heightAt: terrainH,
      terrain,
      ground,
    };
  };
})();
