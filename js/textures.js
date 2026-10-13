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
})();
