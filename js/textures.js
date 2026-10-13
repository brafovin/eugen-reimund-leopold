// Prozedurale Texturen (Canvas) – keine externen Bilddateien nötig.
(function () {
  'use strict';
  const SR = (window.SR = window.SR || {});

  // Farben als sRGB angeben und korrekt umrechnen lassen (vor allen anderen Three.js-Objekten).
  const CM = THREE.ColorManagement;
  if (CM) {
    if ('legacyMode' in CM) CM.legacyMode = false;
    else CM.enabled = true;
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // Kleiner deterministischer Zufallsgenerator, damit Texturen immer gleich aussehen.
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  }
  SR.rng = rng;

  function toTexture(canvas, repeat) {
    const t = new THREE.CanvasTexture(canvas);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = SR.maxAniso || 4;
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
    return t;
  }

  // Zeichnet weiche Flecken nahtlos (auch über den Rand gekachelt).
  function softPatches(g, size, r, count, colors, minR, maxR) {
    for (let i = 0; i < count; i++) {
      const x = r() * size;
      const y = r() * size;
      const rad = minR + r() * (maxR - minR);
      const col = colors[Math.floor(r() * colors.length)];
      for (let dx = -size; dx <= size; dx += size) {
        for (let dy = -size; dy <= size; dy += size) {
          const grd = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
          grd.addColorStop(0, col);
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grd;
          g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
        }
      }
    }
  }

  SR.tex = {
    grass() {
      const S = 512;
      const c = makeCanvas(S, S);
      const g = c.getContext('2d');
      const r = rng(11);
      g.fillStyle = '#5b7634';
      g.fillRect(0, 0, S, S);
      softPatches(g, S, r, 70, ['rgba(128,146,64,0.35)', 'rgba(52,78,30,0.35)', 'rgba(140,130,70,0.22)'], 30, 110);
      for (let i = 0; i < 14000; i++) {
        const x = r() * S;
        const y = r() * S;
        g.fillStyle = 'hsl(' + (70 + r() * 32) + ',' + (30 + r() * 30) + '%,' + (16 + r() * 28) + '%)';
        g.fillRect(x, y, 1 + (r() < 0.2 ? 1 : 0), 2 + r() * 4);
      }
      return toTexture(c, [1, 1]);
    },

    gravel() {
      const S = 256;
      const c = makeCanvas(S, S);
      const g = c.getContext('2d');
      const r = rng(5);
      g.fillStyle = '#9c8f74';
      g.fillRect(0, 0, S, S);
      softPatches(g, S, r, 30, ['rgba(120,105,80,0.35)', 'rgba(175,165,140,0.3)'], 15, 50);
      for (let i = 0; i < 5000; i++) {
        const l = 35 + r() * 40;
        g.fillStyle = 'hsl(' + (30 + r() * 15) + ',' + (8 + r() * 14) + '%,' + l + '%)';
        const s = 1 + r() * 2.5;
        g.fillRect(r() * S, r() * S, s, s);
      }
      return toTexture(c, [1, 1]);
    },

    concrete() {
      const S = 512;
      const c = makeCanvas(S, S);
      const g = c.getContext('2d');
      const r = rng(23);
      g.fillStyle = '#a6a39b';
      g.fillRect(0, 0, S, S);
      softPatches(g, S, r, 50, ['rgba(120,118,110,0.25)', 'rgba(190,188,180,0.25)'], 20, 90);
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = 'rgba(' + (r() < 0.5 ? '60,58,55' : '220,218,210') + ',' + (0.15 + r() * 0.25) + ')';
        g.fillRect(r() * S, r() * S, 1, 1);
      }
      // Fugen der Betonplatten
      g.strokeStyle = 'rgba(70,68,62,0.55)';
      g.lineWidth = 3;
      g.strokeRect(1.5, 1.5, S - 3, S - 3);
      return toTexture(c, [1, 1]);
    },

    wood(base, seed, size) {
      const W = size || 256;
      const H = size || 256;
      const c = makeCanvas(W, H);
      const g = c.getContext('2d');
      const img = g.createImageData(W, H);
      const r = rng(seed || 3);
      const p0 = r() * 10;
      const p1 = r() * 10;
      const p2 = r() * 10;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const yy = y + Math.sin((x / W) * Math.PI * 2 + p0) * 7 + Math.sin((x / W) * Math.PI * 4 + p1) * 3;
          const ring = Math.sin(yy * 0.32) * 0.5 + 0.5;
          const fine = Math.sin((y + Math.sin((x / W) * Math.PI * 6 + p2) * 2) * 1.9) * 0.5 + 0.5;
          const k = 0.74 + ring * 0.2 + fine * 0.07 + (r() - 0.5) * 0.06;
          const i = (y * W + x) * 4;
          img.data[i] = Math.min(255, base[0] * k);
          img.data[i + 1] = Math.min(255, base[1] * k);
          img.data[i + 2] = Math.min(255, base[2] * k);
          img.data[i + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      return toTexture(c, [1, 1]);
    },

    rubberMat() {
      const S = 256;
      const c = makeCanvas(S, S);
      const g = c.getContext('2d');
      const r = rng(9);
      g.fillStyle = '#2f3a2c';
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < 4000; i++) {
        g.fillStyle = 'rgba(' + (r() < 0.5 ? '20,26,20' : '70,84,66') + ',0.35)';
        g.fillRect(r() * S, r() * S, 1, 1);
      }
      return toTexture(c, [4, 2]);
    },

    // Zielscheibe: deckt den Bereich x = -0.32..0.32 m, y = 0..1.12 m ab.
    target(bodyPath, head) {
      const W = 320;
      const H = 560;
      const PX = W / 0.64;
      const c = makeCanvas(W, H);
      const g = c.getContext('2d');
      const X = (x) => (x + 0.32) * PX;
      const Y = (y) => H - y * PX;

      g.fillStyle = '#cfae74';
      g.fillRect(0, 0, W, H);
      // Pappe-Struktur
      const r = rng(31);
      for (let i = 0; i < 2500; i++) {
        g.fillStyle = 'rgba(' + (r() < 0.5 ? '120,90,50' : '240,220,170') + ',' + (0.1 + r() * 0.2) + ')';
        g.fillRect(r() * W, r() * H, 1 + r() * 2, 1);
      }

      // Silhouette dunkel, Ringe hell (klassische Mannscheibe)
      g.fillStyle = '#2b2a25';
      g.beginPath();
      bodyPath(g, X, Y);
      g.fill();
      g.beginPath();
      g.arc(X(head.x), Y(head.y), head.r * PX, 0, Math.PI * 2);
      g.fill();

      g.strokeStyle = '#efe6cc';
      g.fillStyle = '#efe6cc';
      g.lineWidth = 3;
      const cx = X(0);
      const cy = Y(0.44);
      const rings = [0.26, 0.2, 0.14, 0.08];
      g.font = '600 16px "Barlow Condensed", Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      rings.forEach((rad, i) => {
        g.beginPath();
        g.arc(cx, cy, rad * PX, 0, Math.PI * 2);
        g.stroke();
        const mid = (rad + (rings[i + 1] || 0.035)) / 2;
        g.fillText(String(7 + i), cx - mid * PX, cy);
        g.fillText(String(7 + i), cx + mid * PX, cy);
      });
      g.beginPath();
      g.arc(cx, cy, 0.03 * PX, 0, Math.PI * 2);
      g.fill();

      // Kopf-Zone
      g.beginPath();
      g.arc(X(head.x), Y(head.y), head.r * 0.6 * PX, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(X(head.x), Y(head.y), 0.02 * PX, 0, Math.PI * 2);
      g.fill();

      // Rand
      g.strokeStyle = '#1b1a16';
      g.lineWidth = 5;
      g.beginPath();
      bodyPath(g, X, Y);
      g.stroke();
      g.beginPath();
      g.arc(X(head.x), Y(head.y), head.r * PX - 2, 0, Math.PI * 2);
      g.stroke();

      const t = toTexture(c);
      t.repeat.set(1 / 0.64, 1 / 1.12);
      t.offset.set(0.5, 0);
      return t;
    },

    label(text, opts) {
      const o = opts || {};
      const W = o.w || 256;
      const H = o.h || 64;
      const c = makeCanvas(W, H);
      const g = c.getContext('2d');
      g.fillStyle = o.bg || '#e9e2c9';
      g.fillRect(0, 0, W, H);
      g.strokeStyle = o.border || '#2b2a25';
      g.lineWidth = Math.max(3, H * 0.06);
      g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, W - g.lineWidth, H - g.lineWidth);
      g.fillStyle = o.fg || '#1d1c18';
      g.font = (o.weight || '700') + ' ' + Math.round(H * (o.scale || 0.62)) + 'px ' + (o.font || '"Barlow Condensed", "Arial Narrow", Arial, sans-serif');
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, W / 2, H / 2 + H * 0.04);
      return toTexture(c);
    },

    // ---------- Muster für Waffen-Skins ----------

    // Tarnmuster aus unregelmäßigen Flecken (nahtlos)
    camo(colors, seed, opts) {
      const o = opts || {};
      const S = 256;
      const c = makeCanvas(S, S);
      const g = c.getContext('2d');
      const r = rng(seed || 1);
      g.fillStyle = colors[0];
      g.fillRect(0, 0, S, S);
      const count = o.count || 60;
      for (let i = 0; i < count; i++) {
        const col = colors[1 + Math.floor(r() * (colors.length - 1))];
        const x = r() * S;
        const y = r() * S;
        const rad = (o.minR || 8) + r() * ((o.maxR || 28) - (o.minR || 8));
        const pts = [];
        const n = 7 + Math.floor(r() * 5);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const rr = rad * (0.55 + r() * 0.6);
          pts.push([Math.cos(a) * rr * (o.stretch || 1), Math.sin(a) * rr]);
        }
        g.fillStyle = col;
        for (let dx = -S; dx <= S; dx += S) {
          for (let dy = -S; dy <= S; dy += S) {
            g.beginPath();
            pts.forEach((p, k) => (k ? g.lineTo(x + dx + p[0], y + dy + p[1]) : g.moveTo(x + dx + p[0], y + dy + p[1])));
            g.closePath();
            g.fill();
          }
        }
      }
      return toTexture(c, [1, 1]);
    },

    // Bundeswehr-Flecktarn: viele kleine Tupfen in fünf Farben
    flecktarn() {
      return SR.tex.camo(['#7d7a52', '#4d5a32', '#2f3b23', '#5b4632', '#181a14'], 77, { count: 420, minR: 3, maxR: 9 });
    },

    // Pixel-Tarnmuster
    digital(colors, seed, cell) {
      const S = 256;
      const C = cell || 8;
      const c = makeCanvas(S, S);
      const g = c.getContext('2d');
      const r = rng(seed || 2);
      g.fillStyle = colors[0];
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = colors[1 + Math.floor(r() * (colors.length - 1))];
        const x = Math.floor((r() * S) / C) * C;
        const y = Math.floor((r() * S) / C) * C;
        const w = (1 + Math.floor(r() * 4)) * C;
        const h = (1 + Math.floor(r() * 3)) * C;
        g.fillRect(x, y, w, h);
        if (x + w > S) g.fillRect(x - S, y, w, h);
        if (y + h > S) g.fillRect(x, y - S, w, h);
      }
      return toTexture(c, [1, 1]);
    },

    // Holzfällerhemd-Karo
    plaid(colors) {
      const S = 128;
      const c = makeCanvas(S, S);
      const g = c.getContext('2d');
      g.fillStyle = colors[0];
      g.fillRect(0, 0, S, S);
      g.fillStyle = colors[1];
      g.globalAlpha = 0.85;
      g.fillRect(0, 0, S / 2, S);
      g.fillRect(0, 0, S, S / 2);
      g.globalAlpha = 1;
      g.fillStyle = colors[1];
      g.fillRect(0, 0, S / 2, S / 2);
      g.strokeStyle = colors[2];
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(S * 0.75, 0);
      g.lineTo(S * 0.75, S);
      g.moveTo(0, S * 0.75);
      g.lineTo(S, S * 0.75);
      g.stroke();
      return toTexture(c, [1, 1]);
    },

    // Damaszener Stahl: gewellte Lagen
    damascus(c1, c2, seed) {
      const S = 256;
      const c = makeCanvas(S, S);
      const g = c.getContext('2d');
      const img = g.createImageData(S, S);
      const r = rng(seed || 5);
      const p = [r() * 6, r() * 6, r() * 6];
      // Hex direkt lesen (THREE.Color würde in lineare Farbwerte umrechnen)
      const hex = (h) => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 });
      const a = hex(c1);
      const b = hex(c2);
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const u = (x / S) * Math.PI * 2;
          const yy = y + Math.sin(u + p[0]) * 18 + Math.sin(u * 3 + p[1]) * 7 + Math.sin(u * 5 + p[2]) * 3;
          const k = Math.pow(Math.sin(yy * 0.29) * 0.5 + 0.5, 1.6);
          const i = (y * S + x) * 4;
          img.data[i] = (a.r + (b.r - a.r) * k) * 255;
          img.data[i + 1] = (a.g + (b.g - a.g) * k) * 255;
          img.data[i + 2] = (a.b + (b.b - a.b) * k) * 255;
          img.data[i + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      return toTexture(c, [1, 1]);
    },

    // Gravur: Ranken auf Silber
    engraving(base, line, seed) {
      const S = 256;
      const c = makeCanvas(S, S);
      const g = c.getContext('2d');
      const r = rng(seed || 7);
      g.fillStyle = base;
      g.fillRect(0, 0, S, S);
      g.strokeStyle = line;
      g.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        let x = r() * S;
        let y = r() * S;
        let a = r() * Math.PI * 2;
        const turn = (r() < 0.5 ? -1 : 1) * (0.08 + r() * 0.1);
        g.lineWidth = 1 + r() * 1.5;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 40; k++) {
          a += turn * (1 + k * 0.03);
          x += Math.cos(a) * 2.2;
          y += Math.sin(a) * 2.2;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      return toTexture(c, [1, 1]);
    },

    // Lava: dunkles Gestein mit glühenden Rissen. which = 'map' oder 'glow'
    lava(which, seed) {
      const S = 256;
      const c = makeCanvas(S, S);
      const g = c.getContext('2d');
      const r = rng(seed || 13);
      const glow = which === 'glow';
      g.fillStyle = glow ? '#000' : '#1b1512';
      g.fillRect(0, 0, S, S);
      if (!glow) softPatches(g, S, rng(99), 40, ['rgba(60,40,32,0.5)', 'rgba(10,8,8,0.5)'], 10, 40);
      for (let i = 0; i < 18; i++) {
        let x = r() * S;
        let y = r() * S;
        let a = r() * Math.PI * 2;
        const w = 1.5 + r() * 2.5;
        for (let k = 0; k < 30; k++) {
          const nx = x + Math.cos(a) * 6;
          const ny = y + Math.sin(a) * 6;
          g.strokeStyle = glow ? '#ff7a1a' : '#a8320c';
          g.lineWidth = w * (1 - k / 40);
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(nx, ny);
          g.stroke();
          x = nx;
          y = ny;
          a += (r() - 0.5) * 1.1;
        }
      }
      return toTexture(c, [1, 1]);
    },

    // Leuchtstreifen (für Neon-Skins als Leucht-Textur)
    neonLines(color) {
      const S = 128;
      const c = makeCanvas(S, S);
      const g = c.getContext('2d');
      g.fillStyle = '#000';
      g.fillRect(0, 0, S, S);
      g.strokeStyle = color;
      g.lineWidth = 3;
      for (let i = -S; i < S * 2; i += 32) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + S, S);
        g.stroke();
      }
      return toTexture(c, [1, 1]);
    },

    // Galaxie: Nebel und Sterne. which = 'map' (Farbe) oder 'glow' (leuchtende Sterne)
    galaxy(which, seed) {
      const S = 256;
      const c = makeCanvas(S, S);
      const g = c.getContext('2d');
      const glow = which === 'glow';
      g.fillStyle = glow ? '#000' : '#0b0820';
      g.fillRect(0, 0, S, S);
      softPatches(g, S, rng(seed || 3), 26, glow ? ['rgba(90,40,140,0.35)', 'rgba(30,60,140,0.3)'] : ['rgba(120,40,170,0.6)', 'rgba(40,80,190,0.55)', 'rgba(200,60,150,0.35)'], 30, 90);
      const r = rng((seed || 3) + 1);
      for (let i = 0; i < 260; i++) {
        const big = r() < 0.08;
        g.fillStyle = 'rgba(255,255,255,' + (0.5 + r() * 0.5) + ')';
        g.beginPath();
        g.arc(r() * S, r() * S, big ? 1.6 : 0.7, 0, Math.PI * 2);
        g.fill();
      }
      return toTexture(c, [1, 1]);
    },

    // Regenbogen-Streifen
    rainbow() {
      const S = 256;
      const c = makeCanvas(S, S);
      const g = c.getContext('2d');
      const grd = g.createLinearGradient(0, 0, S, S);
      ['#ff3b3b', '#ff9a1f', '#ffe14a', '#3bd16f', '#2fa8ff', '#7b5cff', '#ff3b3b'].forEach((col, i, a) => grd.addColorStop(i / (a.length - 1), col));
      g.fillStyle = grd;
      g.fillRect(0, 0, S, S);
      return toTexture(c, [1, 1]);
    },

    // Graustufen-Körnung für Bump-Maps (gebürstetes Metall, Kunststoff-Narbung)
    grain(seed, streaks) {
      const S = 128;
      const c = makeCanvas(S, S);
      const g = c.getContext('2d');
      const r = rng(seed || 17);
      g.fillStyle = '#808080';
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < 2600; i++) {
        const v = Math.floor(80 + r() * 100);
        g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
        const w = streaks ? 4 + r() * 22 : 1 + r() * 1.4;
        g.fillRect(r() * S, r() * S, w, streaks ? 1 : 1 + r() * 1.4);
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = SR.maxAniso || 4;
      return t;
    },

    soft() {
      const S = 64;
      const c = makeCanvas(S, S);
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.4, 'rgba(255,255,255,0.55)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, S, S);
      return toTexture(c);
    },

    flash() {
      const S = 128;
      const c = makeCanvas(S, S);
      const g = c.getContext('2d');
      g.translate(S / 2, S / 2);
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, S / 2);
      grd.addColorStop(0, 'rgba(255,250,220,1)');
      grd.addColorStop(0.25, 'rgba(255,200,90,0.9)');
      grd.addColorStop(0.6, 'rgba(255,120,30,0.35)');
      grd.addColorStop(1, 'rgba(255,90,0,0)');
      g.fillStyle = grd;
      for (let i = 0; i < 7; i++) {
        g.rotate((Math.PI * 2) / 7);
        g.beginPath();
        g.moveTo(-5, 0);
        g.lineTo(0, -S / 2);
        g.lineTo(5, 0);
        g.fill();
      }
      g.beginPath();
      g.arc(0, 0, S * 0.22, 0, Math.PI * 2);
      g.fill();
      return toTexture(c);
    },
  };

  // =====================================================================
  // Welt-Texturen (Umgebung): Rauschen, Wiese, Kies, Beton, Holz, Rinde,
  // Laub, Felder, Schilder usw. Alles prozedural, alle Canvas <= 1024².
  // =====================================================================
  (function () {
    // Software-Canvas (CPU): viel schneller bei sehr vielen kleinen Pfaden als der GPU-Canvas, vor allem ohne echte Grafikkarte.
    const ctx2d = (cv) => cv.getContext('2d', { willReadFrequently: true });

    // Zeichnet fn(x, y) so oft, dass auch über den Rand hinaus nahtlos gekachelt wird.
    function tiled(S, x, y, m, fn) {
      const xs = [0];
      const ys = [0];
      if (x < m) xs.push(S);
      else if (x > S - m) xs.push(-S);
      if (y < m) ys.push(S);
      else if (y > S - m) ys.push(-S);
      for (let i = 0; i < xs.length; i++) for (let j = 0; j < ys.length; j++) fn(x + xs[i], y + ys[j]);
    }

    // Mittlere Farbe (linear) einer sRGB-Canvas-Textur, z. B. um in der Ferne zur Durchschnittsfarbe zu blenden.
    function meanLinear(canvas) {
      const n = 24;
      const c = makeCanvas(n, n);
      const g = ctx2d(c);
      g.imageSmoothingQuality = 'high';
      g.drawImage(canvas, 0, 0, n, n);
      const d = g.getImageData(0, 0, n, n).data;
      const m = [0, 0, 0];
      const lin = (v) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      for (let i = 0; i < n * n; i++) {
        m[0] += lin(d[i * 4]);
        m[1] += lin(d[i * 4 + 1]);
        m[2] += lin(d[i * 4 + 2]);
      }
      return m.map((v) => v / (n * n));
    }

    function crack(g, r, x, y, a, len, w, alpha, depth) {
      let px = x;
      let py = y;
      const pts = [[px, py]];
      for (let d = 0; d < len; d += 5 + r() * 6) {
        a += (r() - 0.5) * 0.7;
        px += Math.cos(a) * (5 + r() * 6);
        py += Math.sin(a) * (5 + r() * 6);
        pts.push([px, py]);
        if (depth < 2 && r() < 0.05) crack(g, r, px, py, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.7), len * 0.4, w * 0.7, alpha, depth + 1);
      }
      g.lineJoin = 'round';
      g.strokeStyle = 'rgba(235,232,222,' + alpha * 0.45 + ')';
      g.lineWidth = w + 1.4;
      g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(p[0] + 1, p[1] + 1) : g.moveTo(p[0] + 1, p[1] + 1)));
      g.stroke();
      g.strokeStyle = 'rgba(28,26,23,' + alpha + ')';
      g.lineWidth = w;
      g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.stroke();
    }

    Object.assign(SR.tex, {
      // Nahtloses Wertrauschen, drei Kanäle (R: grob, G: mittel, B: fein), jeweils auf 0..1 gestreckt.
      // Daten für die CPU: tex.userData.pixels (RGBA) und tex.userData.size
      noiseMap(seed) {
        const S = 256;
        const c = makeCanvas(S, S);
        const g = ctx2d(c);
        const img = g.createImageData(S, S);
        const r = rng(seed || 7);
        const lat = (n) => {
          const a = new Float32Array(n * n);
          for (let i = 0; i < a.length; i++) a[i] = r();
          return a;
        };
        const vn = (a, n, x, y) => {
          const fx = x * n;
          const fy = y * n;
          const ix = Math.floor(fx);
          const iy = Math.floor(fy);
          let tx = fx - ix;
          let ty = fy - iy;
          tx = tx * tx * tx * (tx * (tx * 6 - 15) + 10);
          ty = ty * ty * ty * (ty * (ty * 6 - 15) + 10);
          const x0 = ix % n;
          const x1 = (ix + 1) % n;
          const y0 = iy % n;
          const y1 = (iy + 1) % n;
          const p = a[y0 * n + x0];
          const q = a[y0 * n + x1];
          const u = a[y1 * n + x0];
          const v = a[y1 * n + x1];
          return p + (q - p) * tx + (u - p) * ty + (p - q - u + v) * tx * ty;
        };
        const chans = [
          [3, 5],
          [6, 4],
          [12, 3],
        ];
        chans.forEach((cfg, ch) => {
          const octs = [];
          for (let o = 0; o < cfg[1]; o++) octs.push({ n: cfg[0] * Math.pow(2, o), a: lat(cfg[0] * Math.pow(2, o)), w: Math.pow(0.55, o) });
          const vals = new Float32Array(S * S);
          let lo = 1e9;
          let hi = -1e9;
          for (let y = 0; y < S; y++) {
            for (let x = 0; x < S; x++) {
              let sum = 0;
              let tw = 0;
              for (let o = 0; o < octs.length; o++) {
                sum += vn(octs[o].a, octs[o].n, x / S, y / S) * octs[o].w;
                tw += octs[o].w;
              }
              sum /= tw;
              vals[y * S + x] = sum;
              if (sum < lo) lo = sum;
              if (sum > hi) hi = sum;
            }
          }
          for (let i = 0; i < S * S; i++) img.data[i * 4 + ch] = Math.round(((vals[i] - lo) / (hi - lo)) * 255);
        });
        for (let i = 0; i < S * S; i++) img.data[i * 4 + 3] = 255;
        g.putImageData(img, 0, 0);
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.userData.pixels = img.data;
        t.userData.size = S;
        return t;
      },

      // Wiese: nahtlose Detailtextur für den Boden (Halme, Klee, Erde, trockene Stellen)
      meadow(seed) {
        const S = 512;
        const c = makeCanvas(S, S);
        const g = ctx2d(c);
        const r = rng(seed || 61);
        g.fillStyle = '#566f31';
        g.fillRect(0, 0, S, S);
        softPatches(g, S, r, 54, ['rgba(124,140,58,0.30)', 'rgba(40,64,26,0.34)', 'rgba(150,134,76,0.20)', 'rgba(72,92,40,0.26)'], 26, 120);
        // kleine Erdlücken
        for (let i = 0; i < 320; i++) {
          const x = r() * S;
          const y = r() * S;
          const s = 1 + r() * 3;
          g.fillStyle = 'rgba(48,36,24,' + (0.18 + r() * 0.25) + ')';
          tiled(S, x, y, 6, (px, py) => g.fillRect(px, py, s, s * (0.6 + r() * 0.8)));
        }
        // Halme
        g.lineCap = 'round';
        for (let i = 0; i < 17000; i++) {
          const x = r() * S;
          const y = r() * S;
          const len = 3 + r() * 10;
          const a = -Math.PI / 2 + (r() - 0.5) * 1.7;
          const dry = r() < 0.12;
          const hue = dry ? 48 + r() * 14 : 68 + r() * 40;
          const sat = dry ? 26 + r() * 20 : 26 + r() * 34;
          const lit = dry ? 36 + r() * 24 : 13 + r() * 36;
          g.strokeStyle = 'hsla(' + hue + ',' + sat + '%,' + lit + '%,0.78)';
          g.lineWidth = 0.7 + r() * 1.2;
          const dx = Math.cos(a) * len;
          const dy = Math.sin(a) * len;
          tiled(S, x, y, 14, (px, py) => {
            g.beginPath();
            g.moveTo(px, py);
            g.lineTo(px + dx, py + dy);
            g.stroke();
          });
        }
        // Klee-Inseln (kleine helle Blättchen)
        for (let i = 0; i < 70; i++) {
          const x = r() * S;
          const y = r() * S;
          for (let k = 0; k < 9; k++) {
            const ox = (r() - 0.5) * 16;
            const oy = (r() - 0.5) * 16;
            g.fillStyle = 'hsla(' + (98 + r() * 24) + ',' + (36 + r() * 16) + '%,' + (27 + r() * 14) + '%,0.8)';
            tiled(S, x + ox, y + oy, 6, (px, py) => {
              g.beginPath();
              g.ellipse(px, py, 2.4 + r() * 1.6, 1.8 + r(), r() * 3, 0, Math.PI * 2);
              g.fill();
            });
          }
        }
        // winzige Blüten (Gänseblümchen, Hahnenfuß)
        for (let i = 0; i < 38; i++) {
          const x = r() * S;
          const y = r() * S;
          g.fillStyle = r() < 0.6 ? 'rgba(240,240,225,0.85)' : 'rgba(236,200,60,0.85)';
          tiled(S, x, y, 4, (px, py) => g.fillRect(px, py, 2, 2));
        }
        const t = toTexture(c, [1, 1]);
        t.userData.mean = meanLinear(c);
        return t;
      },

      // Kies: nahtlos, einzelne Steine mit Schatten und Glanzlicht
      gravelFine(seed) {
        const S = 512;
        const c = makeCanvas(S, S);
        const g = ctx2d(c);
        const r = rng(seed || 29);
        g.fillStyle = '#8b816c';
        g.fillRect(0, 0, S, S);
        softPatches(g, S, r, 34, ['rgba(112,98,76,0.40)', 'rgba(176,164,140,0.34)', 'rgba(90,84,72,0.3)'], 24, 90);
        for (let i = 0; i < 9000; i++) {
          const l = 30 + r() * 48;
          g.fillStyle = 'hsla(' + (30 + r() * 14) + ',' + (6 + r() * 16) + '%,' + l + '%,0.8)';
          const s = 0.8 + r() * 1.6;
          const x = r() * S;
          const y = r() * S;
          tiled(S, x, y, 3, (px, py) => g.fillRect(px, py, s, s));
        }
        for (let i = 0; i < 4600; i++) {
          const x = r() * S;
          const y = r() * S;
          const rad = 1.6 + Math.pow(r(), 2.2) * 6.5;
          const ry = rad * (0.6 + r() * 0.4);
          const rot = r() * Math.PI;
          const hue = 26 + r() * 22;
          const sat = 6 + r() * 24;
          const lit = 30 + r() * 44;
          tiled(S, x, y, rad * 2 + 3, (px, py) => {
            g.fillStyle = 'rgba(30,24,16,0.5)';
            g.beginPath();
            g.ellipse(px + 0.8, py + 1.2, rad * 1.05, ry * 1.05, rot, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = 'hsl(' + hue + ',' + sat + '%,' + lit + '%)';
            g.beginPath();
            g.ellipse(px, py, rad, ry, rot, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = 'hsla(' + hue + ',' + sat * 0.6 + '%,' + Math.min(90, lit + 20) + '%,0.5)';
            g.beginPath();
            g.ellipse(px - rad * 0.25, py - ry * 0.28, rad * 0.55, ry * 0.45, rot, 0, Math.PI * 2);
            g.fill();
          });
        }
        const t = toTexture(c, [1, 1]);
        t.userData.mean = meanLinear(c);
        return t;
      },

      // Betonplatte 7,2 x 6,0 m (nicht gekachelt, UV 0..1 über die ganze Oberseite; oben = vorne zu den Scheiben)
      concretePad() {
        const W = 1024;
        const H = 1024;
        const c = makeCanvas(W, H);
        const g = ctx2d(c);
        const r = rng(77);
        const PX = W / 7.2;
        const PY = H / 6.0;
        g.fillStyle = '#a8a59c';
        g.fillRect(0, 0, W, H);
        // Plattenfelder (3 x 3) mit leicht verschiedenem Ton
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            g.fillStyle = r() < 0.5 ? 'rgba(255,255,250,' + (0.02 + r() * 0.05) + ')' : 'rgba(40,38,34,' + (0.02 + r() * 0.06) + ')';
            g.fillRect((i * W) / 3, (j * H) / 3, W / 3, H / 3);
          }
        }
        softPatches(g, W, r, 90, ['rgba(116,114,106,0.20)', 'rgba(196,194,186,0.22)', 'rgba(120,112,98,0.14)'], 36, 190);
        // Zuschlagstoffe und Poren
        for (let i = 0; i < 52000; i++) {
          const k = r();
          g.fillStyle = k < 0.45 ? 'rgba(62,60,55,' + (0.12 + r() * 0.3) + ')' : k < 0.9 ? 'rgba(228,226,216,' + (0.12 + r() * 0.3) + ')' : 'rgba(150,120,90,' + (0.12 + r() * 0.2) + ')';
          const s = 1 + (r() < 0.25 ? 1 : 0) + (r() < 0.04 ? 1 : 0);
          g.fillRect(r() * W, r() * H, s, s);
        }
        for (let i = 0; i < 3500; i++) {
          g.fillStyle = 'rgba(30,28,25,' + (0.3 + r() * 0.4) + ')';
          g.fillRect(r() * W, r() * H, 1, 1);
        }
        // Wasserflecken / Verschmutzung
        softPatches(g, W, rng(5), 16, ['rgba(70,62,48,0.16)', 'rgba(255,255,250,0.10)'], 60, 160);
        // Fugen (Bitumen) zwischen den Platten
        const joint = (x0, y0, x1, y1) => {
          const hor = y0 === y1;
          const lines = [
            ['rgba(30,28,25,0.12)', 11],
            ['rgba(30,28,25,0.4)', 4],
            ['rgba(24,22,19,0.8)', 2],
          ];
          lines.forEach((l) => {
            g.strokeStyle = l[0];
            g.lineWidth = l[1];
            g.beginPath();
            g.moveTo(x0, y0);
            g.lineTo(x1, y1);
            g.stroke();
          });
          g.strokeStyle = 'rgba(240,238,228,0.28)';
          g.lineWidth = 1.5;
          g.beginPath();
          if (hor) {
            g.moveTo(x0, y0 + 4);
            g.lineTo(x1, y1 + 4);
          } else {
            g.moveTo(x0 + 4, y0);
            g.lineTo(x1 + 4, y1);
          }
          g.stroke();
        };
        for (let i = 1; i < 3; i++) {
          joint((i * W) / 3, 0, (i * W) / 3, H);
          joint(0, (i * H) / 3, W, (i * H) / 3);
        }
        // Risse
        for (let i = 0; i < 9; i++) crack(g, r, r() * W, r() * H, r() * 6.28, 70 + r() * 200, 1.4 + r() * 1.2, 0.55, 0);
        for (let i = 0; i < 26; i++) crack(g, r, r() * W, r() * H, r() * 6.28, 30 + r() * 90, 0.9, 0.35, 1);
        // Risse, die an den Fugen anfangen
        for (let i = 0; i < 8; i++) {
          const jx = (1 + Math.floor(r() * 2)) * (W / 3);
          crack(g, r, jx, r() * H, r() < 0.5 ? 0 : Math.PI, 60 + r() * 120, 1.6, 0.6, 0);
        }
        // Ölflecken, Kaugummi, Farbspritzer
        for (let i = 0; i < 7; i++) {
          const x = r() * W;
          const y = r() * H;
          const rad = 14 + r() * 36;
          for (let k = 0; k < 5; k++) {
            const ox = (r() - 0.5) * rad;
            const oy = (r() - 0.5) * rad;
            const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad * (0.4 + r() * 0.5));
            gr.addColorStop(0, 'rgba(40,34,26,0.34)');
            gr.addColorStop(0.6, 'rgba(52,44,34,0.15)');
            gr.addColorStop(1, 'rgba(48,40,30,0)');
            g.fillStyle = gr;
            g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
          }
        }
        for (let i = 0; i < 40; i++) {
          g.fillStyle = r() < 0.5 ? 'rgba(220,216,206,0.5)' : 'rgba(90,86,80,0.4)';
          g.beginPath();
          g.ellipse(r() * W, r() * H, 2 + r() * 3, 2 + r() * 2, r() * 3, 0, Math.PI * 2);
          g.fill();
        }
        // Rand: Schmutz und Moos
        const edge = 46;
        const eg = (x0, y0, x1, y1, rx, ry, rw, rh) => {
          const gr = g.createLinearGradient(x0, y0, x1, y1);
          gr.addColorStop(0, 'rgba(58,52,38,0.42)');
          gr.addColorStop(1, 'rgba(58,52,38,0)');
          g.fillStyle = gr;
          g.fillRect(rx, ry, rw, rh);
        };
        eg(0, 0, edge, 0, 0, 0, edge, H);
        eg(W, 0, W - edge, 0, W - edge, 0, edge, H);
        eg(0, 0, 0, edge, 0, 0, W, edge);
        eg(0, H, 0, H - edge, 0, H - edge, W, edge);
        for (let i = 0; i < 700; i++) {
          const side = Math.floor(r() * 4);
          const d = Math.pow(r(), 2) * 30;
          const p = r();
          const x = side === 0 ? d : side === 1 ? W - d : p * W;
          const y = side === 2 ? d : side === 3 ? H - d : p * H;
          g.fillStyle = 'hsla(' + (80 + r() * 30) + ',' + (30 + r() * 25) + '%,' + (20 + r() * 20) + '%,' + (0.25 + r() * 0.4) + ')';
          const s = 1 + r() * 3;
          g.fillRect(x, y, s, s);
        }
        // Feuerlinie (gelb, abgenutzt) direkt an der Stelle, bis zu der man nach vorn gehen kann (z = -2,1)
        const ly = ((-2.1 + 2.4) / 6.0) * H;
        g.fillStyle = 'rgba(214,176,40,0.9)';
        g.fillRect(0.3 * PX, ly - 0.05 * PY, W - 0.6 * PX, 0.1 * PY);
        for (let i = 0; i < 1400; i++) {
          g.fillStyle = r() < 0.6 ? 'rgba(150,146,136,' + (0.4 + r() * 0.5) + ')' : 'rgba(110,100,84,' + (0.3 + r() * 0.4) + ')';
          g.fillRect(0.3 * PX + r() * (W - 0.6 * PX), ly - 0.06 * PY + r() * 0.12 * PY, 1 + r() * 3, 1 + r() * 2);
        }
        // weiße Schablonen-Schrift „STAND 1“
        g.save();
        g.fillStyle = 'rgba(232,230,220,0.82)';
        g.font = '700 ' + Math.round(0.36 * PY) + 'px "Saira Stencil One","Barlow Condensed","Arial Narrow",Arial,sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('STAND 1', (-2.45 + 3.6) * PX, ((-1.2 + 2.4) / 6.0) * H);
        g.restore();
        for (let i = 0; i < 1500; i++) {
          g.fillStyle = 'rgba(' + (r() < 0.5 ? '150,146,136' : '110,104,92') + ',' + (0.35 + r() * 0.5) + ')';
          g.fillRect((-3.0 + 3.6) * PX + r() * 1.2 * PX, ((-1.4 + 2.4) / 6.0) * H + r() * 0.4 * PY, 1 + r() * 2, 1 + r() * 2);
        }
        const t = toTexture(c, [1, 1]);
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        return t;
      },

      // Holzbretter: Maserung entlang u, nahtlos, Grundfarbe als [r,g,b]
      planks(base, seed) {
        const S = 512;
        const c = makeCanvas(S, S);
        const g = ctx2d(c);
        const r = rng(seed || 41);
        const b = base || [150, 104, 62];
        g.fillStyle = 'rgb(' + b[0] + ',' + b[1] + ',' + b[2] + ')';
        g.fillRect(0, 0, S, S);
        softPatches(g, S, r, 30, ['rgba(255,225,170,0.12)', 'rgba(60,34,14,0.16)'], 40, 160);
        // Jahresringe als lange, leicht wellige Linien
        for (let i = 0; i < 170; i++) {
          const y0 = r() * S;
          const k = 1 + Math.floor(r() * 3);
          const amp = 2 + r() * 8;
          const ph = r() * 6.28;
          const dark = r() < 0.6;
          g.strokeStyle = dark ? 'rgba(52,28,10,' + (0.06 + r() * 0.2) + ')' : 'rgba(255,224,170,' + (0.05 + r() * 0.1) + ')';
          g.lineWidth = 0.6 + r() * 2.4;
          [0, S, -S].forEach((oy) => {
            if (y0 + oy < -20 || y0 + oy > S + 20) return;
            g.beginPath();
            for (let x = 0; x <= S; x += 8) {
              const yy = y0 + oy + Math.sin((x / S) * Math.PI * 2 * k + ph) * amp;
              if (x === 0) g.moveTo(x, yy);
              else g.lineTo(x, yy);
            }
            g.stroke();
          });
        }
        // Poren
        for (let i = 0; i < 5000; i++) {
          g.fillStyle = 'rgba(40,22,8,' + (0.15 + r() * 0.3) + ')';
          g.fillRect(r() * S, r() * S, 2 + r() * 6, 1);
        }
        // Astlöcher
        for (let i = 0; i < 3; i++) {
          const x = r() * S;
          const y = r() * S;
          tiled(S, x, y, 30, (px, py) => {
            for (let k = 5; k >= 1; k--) {
              g.fillStyle = k % 2 ? 'rgba(70,40,18,0.5)' : 'rgba(150,100,56,0.35)';
              g.beginPath();
              g.ellipse(px, py, k * 4.2, k * 1.9, 0, 0, Math.PI * 2);
              g.fill();
            }
            g.fillStyle = 'rgba(40,20,8,0.8)';
            g.beginPath();
            g.ellipse(px, py, 2.2, 1.2, 0, 0, Math.PI * 2);
            g.fill();
          });
        }
        return toTexture(c, [1, 1]);
      },

      // Gummimatte mit feinem Noppenmuster (nahtlos)
      rubberGrip() {
        const S = 128;
        const c = makeCanvas(S, S);
        const g = ctx2d(c);
        const r = rng(19);
        g.fillStyle = '#323d30';
        g.fillRect(0, 0, S, S);
        for (let row = 0; row < 16; row++) {
          for (let col = 0; col < 16; col++) {
            const x = col * 8 + (row % 2 ? 4 : 0) + 2;
            const y = row * 8 + 2;
            g.fillStyle = 'rgba(8,12,8,0.7)';
            g.beginPath();
            g.arc(x + 0.7, y + 0.9, 3, 0, Math.PI * 2);
            g.fill();
            const gr = g.createRadialGradient(x - 0.8, y - 0.8, 0.2, x, y, 3);
            gr.addColorStop(0, '#566752');
            gr.addColorStop(1, '#38453580');
            g.fillStyle = gr;
            g.beginPath();
            g.arc(x, y, 2.8, 0, Math.PI * 2);
            g.fill();
          }
        }
        for (let i = 0; i < 500; i++) {
          g.fillStyle = 'rgba(' + (r() < 0.5 ? '10,14,10' : '90,106,86') + ',0.25)';
          g.fillRect(r() * S, r() * S, 1, 1);
        }
        return toTexture(c, [1, 1]);
      },

      // Rinde: kind = 'eiche' | 'birke' | 'kiefer' (u um den Stamm, v nach oben, nahtlos)
      bark(kind) {
        const W = 128;
        const H = 256;
        const c = makeCanvas(W, H);
        const g = ctx2d(c);
        const r = rng(kind === 'birke' ? 8 : kind === 'kiefer' ? 14 : 3);
        if (kind === 'birke') {
          g.fillStyle = '#ddd8cb';
          g.fillRect(0, 0, W, H);
          softPatches(g, 128, r, 10, ['rgba(255,255,250,0.35)', 'rgba(150,140,120,0.3)'], 12, 40);
          for (let i = 0; i < 90; i++) {
            const x = r() * W;
            const y = r() * H;
            const w = 6 + r() * 26;
            g.fillStyle = 'rgba(' + (28 + r() * 20) + ',' + (26 + r() * 18) + ',' + (24 + r() * 16) + ',' + (0.55 + r() * 0.4) + ')';
            tiled(W, x, y, 30, (px, py) => {
              g.beginPath();
              g.ellipse(px, py, w * 0.5, 1.2 + r() * 1.6, 0, 0, Math.PI * 2);
              g.fill();
            });
          }
          for (let i = 0; i < 40; i++) {
            g.fillStyle = 'rgba(120,108,88,' + (0.08 + r() * 0.15) + ')';
            g.fillRect(r() * W, r() * H, 1 + r() * 2, 8 + r() * 30);
          }
        } else {
          const base = kind === 'kiefer' ? [92, 66, 46] : [76, 60, 44];
          g.fillStyle = 'rgb(' + base.join(',') + ')';
          g.fillRect(0, 0, W, H);
          softPatches(g, 128, r, 12, ['rgba(120,96,70,0.25)', 'rgba(30,22,14,0.3)'], 14, 50);
          // Furchen
          for (let i = 0; i < 46; i++) {
            const x0 = (i / 46) * W + (r() - 0.5) * 3;
            const ph = r() * 6.28;
            const dark = 'rgba(20,14,8,' + (0.5 + r() * 0.35) + ')';
            const lite = 'rgba(160,132,98,' + (0.15 + r() * 0.15) + ')';
            [[dark, 2 + r() * 2.6, 0], [lite, 1.2, 2.5]].forEach((st) => {
              g.strokeStyle = st[0];
              g.lineWidth = st[1];
              g.beginPath();
              for (let y = 0; y <= H; y += 8) {
                const x = x0 + st[2] + Math.sin((y / H) * 6.28 * 2 + ph) * 2.2 + Math.sin(y * 0.21 + ph * 3) * 0.8;
                if (y === 0) g.moveTo(x, y);
                else g.lineTo(x, y);
              }
              g.stroke();
            });
          }
          for (let i = 0; i < 2600; i++) {
            g.fillStyle = 'rgba(' + (r() < 0.5 ? '16,10,6' : '170,140,104') + ',' + (0.1 + r() * 0.2) + ')';
            g.fillRect(r() * W, r() * H, 1 + r(), 2 + r() * 5);
          }
          if (kind !== 'kiefer') {
            for (let i = 0; i < 8; i++) {
              g.fillStyle = 'rgba(122,140,92,' + (0.05 + r() * 0.1) + ')';
              tiled(W, r() * W, r() * H, 20, (px, py) => {
                g.beginPath();
                g.ellipse(px, py, 4 + r() * 8, 6 + r() * 14, 0, 0, Math.PI * 2);
                g.fill();
              });
            }
          }
        }
        return toTexture(c, [1, 1]);
      },

      // Laubbüschel mit Alpha (für gekreuzte Karten in Baumkronen). kind: 'eiche' | 'birke' | 'busch'
      leaves(kind) {
        const S = 256;
        const c = makeCanvas(S, S);
        const g = ctx2d(c);
        const r = rng(kind === 'birke' ? 91 : kind === 'busch' ? 53 : 17);
        const cfg =
          kind === 'birke'
            ? { n: 150, rx: [5, 9], ry: [3, 5.6], hue: [72, 98], sat: [44, 62], lit: [36, 62] }
            : kind === 'busch'
            ? { n: 110, rx: [8, 14], ry: [4, 7.5], hue: [86, 118], sat: [34, 54], lit: [26, 52] }
            : { n: 120, rx: [9, 16], ry: [5, 9], hue: [88, 118], sat: [34, 54], lit: [26, 56] };
        // dünne Zweige im Hintergrund
        g.strokeStyle = 'rgba(66,48,30,0.9)';
        g.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          const a = r() * 6.28;
          g.beginPath();
          g.moveTo(128, 128);
          g.lineTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92);
          g.stroke();
        }
        const leaves = [];
        for (let i = 0; i < cfg.n; i++) {
          const a = r() * 6.28;
          const rad = Math.sqrt(r()) * 104;
          leaves.push({ x: 128 + Math.cos(a) * rad, y: 128 + Math.sin(a) * rad, rot: r() * 6.28, rx: cfg.rx[0] + r() * (cfg.rx[1] - cfg.rx[0]), ry: cfg.ry[0] + r() * (cfg.ry[1] - cfg.ry[0]) });
        }
        leaves.sort((p, q) => q.y - p.y); // hintere (untere) zuerst, die oberen heller darüber
        leaves.forEach((l) => {
          const top = (128 - l.y) / 128;
          const lit = cfg.lit[0] + r() * (cfg.lit[1] - cfg.lit[0]) + top * 7;
          const hue = cfg.hue[0] + r() * (cfg.hue[1] - cfg.hue[0]);
          const sat = cfg.sat[0] + r() * (cfg.sat[1] - cfg.sat[0]);
          g.save();
          g.translate(l.x, l.y);
          g.rotate(l.rot);
          g.fillStyle = 'hsl(' + hue + ',' + sat + '%,' + lit + '%)';
          g.beginPath();
          g.moveTo(-l.rx, 0);
          g.quadraticCurveTo(0, -l.ry * 1.5, l.rx, 0);
          g.quadraticCurveTo(0, l.ry * 1.5, -l.rx, 0);
          g.fill();
          g.strokeStyle = 'hsla(' + hue + ',' + sat + '%,' + (lit - 14) + '%,0.7)';
          g.lineWidth = 1;
          g.stroke();
          g.strokeStyle = 'hsla(' + hue + ',' + (sat - 8) + '%,' + (lit + 14) + '%,0.5)';
          g.beginPath();
          g.moveTo(-l.rx * 0.8, 0);
          g.lineTo(l.rx * 0.8, 0);
          g.stroke();
          g.restore();
        });
        const t = toTexture(c);
        return t;
      },

      // Acker/Wiese von oben. kind: 'weizen' | 'gruen' | 'pflug' | 'heu'; Reihen laufen entlang v (Kachel ca. 16 m)
      field(kind) {
        const S = 512;
        const c = makeCanvas(S, S);
        const g = ctx2d(c);
        const r = rng(kind === 'pflug' ? 3 : kind === 'weizen' ? 5 : kind === 'heu' ? 9 : 7);
        const base = { weizen: '#b49642', gruen: '#5d8734', pflug: '#5e4531', heu: '#948f4e' }[kind] || '#6e9a38';
        g.fillStyle = base;
        g.fillRect(0, 0, S, S);
        softPatches(g, S, r, 40, kind === 'pflug' ? ['rgba(40,26,16,0.3)', 'rgba(150,110,76,0.25)'] : ['rgba(255,240,170,0.18)', 'rgba(60,80,20,0.22)', 'rgba(120,90,30,0.15)'], 30, 120);
        const rows = kind === 'heu' ? 0 : 32;
        for (let i = 0; i < rows; i++) {
          const x = (i + 0.5) * (S / rows);
          if (kind === 'pflug') {
            g.fillStyle = 'rgba(30,18,10,0.45)';
            g.fillRect(x - 3, 0, 4, S);
            g.fillStyle = 'rgba(190,150,110,0.3)';
            g.fillRect(x + 1, 0, 3, S);
          } else {
            g.fillStyle = 'rgba(30,40,10,0.28)';
            g.fillRect(x - 1.5, 0, 3, S);
            g.fillStyle = kind === 'weizen' ? 'rgba(255,236,150,0.22)' : 'rgba(150,200,80,0.22)';
            g.fillRect(x + 3, 0, 3, S);
          }
        }
        for (let i = 0; i < 9000; i++) {
          const hue = kind === 'pflug' ? 24 + r() * 10 : kind === 'gruen' ? 78 + r() * 30 : 42 + r() * 16;
          const lit = kind === 'pflug' ? 18 + r() * 28 : 30 + r() * 34;
          g.fillStyle = 'hsla(' + hue + ',' + (30 + r() * 30) + '%,' + lit + '%,0.45)';
          g.fillRect(r() * S, r() * S, 1 + r(), 2 + r() * 5);
        }
        return toTexture(c, [1, 1]);
      },

      // Holz-/Warnschild. lines: [{text, size (Anteil der Höhe), color}], style: 'warn' | 'holz' | 'info'
      sign(lines, style, w, h) {
        const W = w || 512;
        const H = h || 256;
        const c = makeCanvas(W, H);
        const g = ctx2d(c);
        const r = rng(W + H + (style ? style.length : 1));
        const st = style || 'holz';
        const bg = { warn: '#e6c42a', holz: '#7d5a38', info: '#e8e4d2', rot: '#b3261f' }[st] || '#7d5a38';
        g.fillStyle = bg;
        g.fillRect(0, 0, W, H);
        if (st === 'holz') {
          for (let i = 0; i < 40; i++) {
            g.strokeStyle = 'rgba(40,22,8,' + (0.08 + r() * 0.2) + ')';
            g.lineWidth = 1 + r() * 2;
            const y0 = r() * H;
            g.beginPath();
            g.moveTo(0, y0);
            for (let x = 0; x <= W; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.02 + i) * 3);
            g.stroke();
          }
          g.fillStyle = 'rgba(30,16,6,0.55)';
          for (let i = 1; i < 4; i++) g.fillRect(0, (i * H) / 4 - 1, W, 2);
        }
        softPatches(g, Math.max(W, H), r, 10, ['rgba(255,255,240,0.10)', 'rgba(30,20,10,0.14)'], 30, 90);
        const m = Math.round(H * 0.05);
        g.strokeStyle = st === 'warn' ? '#1d1c18' : st === 'rot' ? '#f0eadc' : st === 'info' ? '#2c5a34' : 'rgba(230,214,170,0.9)';
        g.lineWidth = Math.round(H * 0.045);
        g.strokeRect(m, m, W - 2 * m, H - 2 * m);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const total = lines.reduce((a, l) => a + l.size, 0);
        let y = (H - total * H) / 2;
        lines.forEach((l) => {
          let px = Math.round(l.size * H);
          g.font = (l.weight || '700') + ' ' + px + 'px "Barlow Condensed","Arial Narrow",Arial,sans-serif';
          // Schrift verkleinern, falls sie nicht in die Breite passt
          const tw = g.measureText(l.text).width;
          if (tw > W * 0.84) {
            px = Math.round((px * W * 0.84) / tw);
            g.font = (l.weight || '700') + ' ' + px + 'px "Barlow Condensed","Arial Narrow",Arial,sans-serif';
          }
          g.fillStyle = l.color || (st === 'warn' ? '#1d1c18' : st === 'info' ? '#1e3c24' : '#f2ecd8');
          g.fillText(l.text, W / 2, y + px / 2);
          y += px;
        });
        // Verwitterung
        for (let i = 0; i < 900; i++) {
          g.fillStyle = 'rgba(' + (r() < 0.5 ? '40,34,26' : '240,236,220') + ',' + (0.05 + r() * 0.12) + ')';
          g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 2);
        }
        return toTexture(c);
      },

      // Fahnentuch: rot, mit Gewebe und Saum
      flagCloth() {
        const W = 256;
        const H = 160;
        const c = makeCanvas(W, H);
        const g = ctx2d(c);
        const r = rng(63);
        g.fillStyle = '#c4302a';
        g.fillRect(0, 0, W, H);
        for (let y = 0; y < H; y += 2) {
          g.fillStyle = 'rgba(0,0,0,' + (0.04 + (y % 4 ? 0 : 0.04)) + ')';
          g.fillRect(0, y, W, 1);
        }
        for (let x = 0; x < W; x += 2) {
          g.fillStyle = 'rgba(255,200,190,' + (x % 4 ? 0.02 : 0.06) + ')';
          g.fillRect(x, 0, 1, H);
        }
        softPatches(g, 160, r, 12, ['rgba(255,130,110,0.16)', 'rgba(80,10,10,0.2)'], 20, 60);
        // Saum und Naht
        g.strokeStyle = 'rgba(240,200,190,0.55)';
        g.lineWidth = 1;
        g.setLineDash([5, 3]);
        g.strokeRect(5, 5, W - 10, H - 10);
        g.setLineDash([]);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(0, 0, 14, H);
        for (let i = 0; i < 3; i++) {
          g.fillStyle = '#2a2a28';
          g.beginPath();
          g.arc(7, 22 + i * 58, 3.4, 0, Math.PI * 2);
          g.fill();
        }
        return toTexture(c);
      },

      // Sandsack aus Jute (nahtlos)
      sack() {
        const S = 128;
        const c = makeCanvas(S, S);
        const g = ctx2d(c);
        const r = rng(88);
        g.fillStyle = '#b09f78';
        g.fillRect(0, 0, S, S);
        softPatches(g, S, r, 14, ['rgba(120,100,64,0.28)', 'rgba(220,206,170,0.22)'], 12, 40);
        for (let y = 0; y < S; y += 3) {
          g.fillStyle = 'rgba(60,46,24,' + (0.1 + r() * 0.12) + ')';
          g.fillRect(0, y, S, 1);
        }
        for (let x = 0; x < S; x += 3) {
          g.fillStyle = 'rgba(240,226,190,' + (0.08 + r() * 0.1) + ')';
          g.fillRect(x, 0, 1, S);
        }
        for (let i = 0; i < 900; i++) {
          g.fillStyle = 'rgba(' + (r() < 0.5 ? '70,54,30' : '236,222,184') + ',' + (0.15 + r() * 0.25) + ')';
          g.fillRect(r() * S, r() * S, 1 + r() * 2, 1);
        }
        return toTexture(c, [1, 1]);
      },

      // Stroh (nahtlos): kurze, gelb-braune Halme, Richtung entlang u
      straw() {
        const S = 256;
        const c = makeCanvas(S, S);
        const g = ctx2d(c);
        const r = rng(34);
        g.fillStyle = '#c9a850';
        g.fillRect(0, 0, S, S);
        softPatches(g, S, r, 24, ['rgba(120,86,30,0.3)', 'rgba(250,228,140,0.28)'], 18, 70);
        g.lineCap = 'round';
        for (let i = 0; i < 4200; i++) {
          const x = r() * S;
          const y = r() * S;
          const len = 8 + r() * 26;
          const a = (r() - 0.5) * 0.5;
          g.strokeStyle = 'hsla(' + (38 + r() * 14) + ',' + (45 + r() * 30) + '%,' + (32 + r() * 40) + '%,0.8)';
          g.lineWidth = 0.8 + r() * 1.3;
          const dx = Math.cos(a) * len;
          const dy = Math.sin(a) * len;
          tiled(S, x, y, 30, (px, py) => {
            g.beginPath();
            g.moveTo(px, py);
            g.lineTo(px + dx, py + dy);
            g.stroke();
          });
        }
        return toTexture(c, [1, 1]);
      },

      // Ölfass: u um das Fass, v von unten nach oben. color = Grundfarbe (CSS)
      barrel(color) {
        const W = 128;
        const H = 256;
        const c = makeCanvas(W, H);
        const g = ctx2d(c);
        const r = rng(71);
        g.fillStyle = color || '#2f5f8a';
        g.fillRect(0, 0, W, H);
        softPatches(g, 128, r, 14, ['rgba(255,255,255,0.10)', 'rgba(0,0,0,0.16)'], 12, 50);
        // Sicken
        [0.05, 0.2, 0.5, 0.8, 0.95].forEach((p) => {
          const y = H * p;
          g.fillStyle = 'rgba(0,0,0,0.38)';
          g.fillRect(0, y - 2, W, 3);
          g.fillStyle = 'rgba(255,255,255,0.22)';
          g.fillRect(0, y + 1, W, 2);
        });
        // Rost und Kratzer
        for (let i = 0; i < 90; i++) {
          const x = r() * W;
          const y = r() < 0.6 ? (r() < 0.5 ? r() * 40 : H - r() * 40) : r() * H;
          g.fillStyle = 'rgba(' + (110 + r() * 40) + ',' + (56 + r() * 20) + ',' + (24 + r() * 10) + ',' + (0.25 + r() * 0.5) + ')';
          tiled(W, x, y, 12, (px, py) => {
            g.beginPath();
            g.ellipse(px, py, 1 + r() * 5, 1 + r() * 4, r() * 3, 0, Math.PI * 2);
            g.fill();
          });
        }
        for (let i = 0; i < 12; i++) {
          const x = r() * W;
          const y = H * (0.2 + r() * 0.6);
          g.strokeStyle = 'rgba(110,56,24,' + (0.2 + r() * 0.3) + ')';
          g.lineWidth = 1 + r() * 2;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + (r() - 0.5) * 3, y + 10 + r() * 40);
          g.stroke();
        }
        // Warnstreifen
        g.fillStyle = 'rgba(240,234,210,0.85)';
        g.fillRect(0, H * 0.42, W, 10);
        return toTexture(c, [1, 1]);
      },
    });
  })();
})();
