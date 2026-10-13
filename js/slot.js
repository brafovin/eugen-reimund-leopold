// Skin-Automat: 3D-Spielautomat auf dem Platz und das Bedienfeld mit drei Walzen.
(function () {
  'use strict';
  const SR = (window.SR = window.SR || {});

  SR.SPIN_COST = 100;
  // Gewinnchancen pro Dreh (werden auch im Automaten angezeigt)
  SR.SLOT_ODDS = [
    { type: 'skin', chance: 0.4, label: 'Neuer Skin (3 gleiche Waffen)' },
    { type: 'money', amount: 250, chance: 0.05, label: '250 Taler' },
    { type: 'money', amount: 100, chance: 0.08, label: '100 Taler' },
    { type: 'money', amount: 50, chance: 0.12, label: '50 Taler' },
    { type: 'none', chance: 0.35, label: 'Niete' },
  ];

  // ---------- 3D-Automat ----------
  function signTexture(lines, opts) {
    const o = opts || {};
    const c = document.createElement('canvas');
    c.width = o.w || 512;
    c.height = o.h || 160;
    const g = c.getContext('2d');
    g.fillStyle = o.bg || '#2a0c0c';
    g.fillRect(0, 0, c.width, c.height);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lines.forEach((l) => {
      g.font = l.font;
      g.fillStyle = l.color;
      g.shadowColor = l.glow || 'transparent';
      g.shadowBlur = l.glow ? 18 : 0;
      g.fillText(l.text, c.width / 2, l.y);
    });
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  SR.buildSlotMachine = function (scene, x, z, faceX, faceZ, floorY) {
    const group = new THREE.Group();
    group.position.set(x, floorY, z);
    scene.add(group);
    group.lookAt(faceX, floorY, faceZ);

    const lacquer = new THREE.MeshStandardMaterial({ color: 0x7c1c1a, roughness: 0.35, metalness: 0.2 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c1513, roughness: 0.6 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd8ac3a, metalness: 1, roughness: 0.25 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.12 });
    const parts = [];
    const add = (geo, mat, px, py, pz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.surface = 'steel';
      group.add(m);
      parts.push(m);
      return m;
    };

    add(new THREE.BoxGeometry(0.86, 0.12, 0.66), dark, 0, 0.06, 0); // Sockel
    add(new THREE.BoxGeometry(0.78, 1.5, 0.58), lacquer, 0, 0.87, 0); // Gehäuse
    add(new THREE.BoxGeometry(0.8, 0.05, 0.62), gold, 0, 0.62, 0.0); // Zierleisten
    add(new THREE.BoxGeometry(0.8, 0.05, 0.62), gold, 0, 1.62, 0.0);
    add(new THREE.BoxGeometry(0.84, 0.32, 0.64), lacquer, 0, 1.8, 0.0); // Kopfteil

    // Bildschirm mit Walzen
    const screenTex = signTexture(
      [
        { text: 'C96   G36   KR86', font: '700 46px "Barlow Condensed", Arial, sans-serif', color: '#1d1c18', y: 70 },
        { text: '100 TALER PRO DREH', font: '600 26px "Barlow Condensed", Arial, sans-serif', color: '#7c1c1a', y: 132 },
      ],
      { bg: '#f1ead6', w: 512, h: 170 }
    );
    const screen = add(
      new THREE.PlaneGeometry(0.6, 0.2),
      new THREE.MeshStandardMaterial({ map: screenTex, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0.55, roughness: 0.3 }),
      0,
      1.25,
      0.297
    );
    screen.castShadow = false;
    add(new THREE.BoxGeometry(0.66, 0.26, 0.02), gold, 0, 1.25, 0.282);

    // Leuchtschild oben
    const signTex = signTexture(
      [
        { text: 'SKIN-AUTOMAT', font: '400 62px "Saira Stencil One", Impact, sans-serif', color: '#ffd46b', glow: '#ffb347', y: 70 },
        { text: '24 Waffen-Skins zu gewinnen', font: '600 30px "Barlow Condensed", Arial, sans-serif', color: '#f1ead6', y: 128 },
      ],
      { w: 512, h: 160 }
    );
    const sign = add(
      new THREE.PlaneGeometry(0.78, 0.26),
      new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.9 }),
      0,
      1.8,
      0.322
    );
    sign.castShadow = false;

    // Lämpchen rund um das Schild
    const bulbs = [];
    const bulbGeo = new THREE.SphereGeometry(0.018, 10, 8);
    for (let i = 0; i < 14; i++) {
      const top = i < 7;
      const k = (i % 7) / 6;
      const m = new THREE.Mesh(bulbGeo, new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffb340, emissiveIntensity: 1 }));
      m.position.set(-0.38 + k * 0.76, top ? 1.95 : 1.65, 0.325);
      group.add(m);
      bulbs.push(m);
    }

    // Münzschlitz, Ausgabeschale, Hebel
    add(new THREE.BoxGeometry(0.12, 0.08, 0.04), chrome, 0.2, 1.0, 0.3);
    add(new THREE.BoxGeometry(0.03, 0.05, 0.01), dark, 0.2, 1.0, 0.322);
    add(new THREE.BoxGeometry(0.4, 0.1, 0.12), chrome, 0, 0.4, 0.33);
    add(new THREE.BoxGeometry(0.36, 0.06, 0.1), dark, 0, 0.42, 0.34);
    const lever = new THREE.Group();
    lever.position.set(0.42, 1.05, 0.05);
    group.add(lever);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.42, 10), chrome);
    arm.position.y = 0.21;
    arm.castShadow = true;
    lever.add(arm);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd01f1a, roughness: 0.25 }));
    knob.position.y = 0.44;
    knob.castShadow = true;
    lever.add(knob);
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 14).rotateZ(Math.PI / 2), chrome, 0.41, 1.05, 0.05);

    // Unsichtbare Box zum Anschauen/Benutzen
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.1, 0.75), new THREE.MeshBasicMaterial({ visible: false }));
    hitbox.position.set(0, 1.05, 0);
    group.add(hitbox);
    group.updateMatrixWorld(true);

    let pull = 0;
    return {
      group,
      hitbox,
      parts,
      x,
      z,
      radius: 0.55,
      pullLever() {
        pull = 1;
      },
      update(t, dt) {
        bulbs.forEach((b, i) => {
          b.material.emissiveIntensity = (Math.floor(t * 4) + i) % 2 ? 1.6 : 0.25;
        });
        pull = Math.max(0, pull - dt * 1.6);
        lever.rotation.x = Math.sin(Math.min(1, pull) * Math.PI) * 0.9;
      },
    };
  };

  // ---------- Bedienfeld ----------
  // api: { money(), spend(n), earn(n), owns(wid, sid), unlock(wid, sid), equip(wid, sid), equipped(wid), icon(index, sid), close() }
  SR.createSlotUI = function (api) {
    const $ = (id) => document.getElementById(id);
    const el = {
      root: $('slot'),
      money: $('slotMoney'),
      spin: $('spinBtn'),
      msg: $('slotMsg'),
      reels: Array.from(document.querySelectorAll('#slot .reel .strip')),
      reelBoxes: Array.from(document.querySelectorAll('#slot .reel')),
      prize: $('prize'),
      prizeImg: $('prizeImg'),
      prizeRarity: $('prizeRarity'),
      prizeName: $('prizeName'),
      prizeWeapon: $('prizeWeapon'),
      prizeEquip: $('prizeEquip'),
      grid: $('skinGrid'),
      count: $('skinCount'),
      odds: $('oddsBody'),
      close: $('slotClose'),
    };
    const DEFS = SR.WEAPON_DEFS;
    const CELL = 76;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let spinning = false;
    let lastPrize = null;

    // Walzensymbole: jede Waffe, Taler, Niete
    const SYMBOLS = DEFS.map((d, i) => ({ kind: 'weapon', index: i })).concat([{ kind: 'money' }, { kind: 'none' }]);
    const randSym = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

    function symEl(sym) {
      const d = document.createElement('div');
      d.className = 'sym ' + sym.kind;
      if (sym.kind === 'weapon') {
        const img = document.createElement('img');
        img.alt = DEFS[sym.index].short;
        img.src = api.icon(sym.index, 'standard');
        const label = document.createElement('span');
        label.textContent = DEFS[sym.index].short;
        d.append(img, label);
      } else if (sym.kind === 'money') {
        d.innerHTML = '<i class="coin">T</i><span>Taler</span>';
      } else {
        d.innerHTML = '<i class="blank">✕</i><span>Niete</span>';
      }
      return d;
    }

    function fillStrip(strip, syms) {
      strip.textContent = '';
      syms.forEach((s) => strip.appendChild(symEl(s)));
    }

    const current = [0, 1, 2].map(() => [randSym(), randSym(), randSym()]);
    function initReels() {
      el.reels.forEach((strip, i) => {
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(0)';
        fillStrip(strip, current[i]);
      });
    }

    // Gewinnchancen-Tabelle
    el.odds.innerHTML = SR.SLOT_ODDS.map((o) => '<tr><td>' + o.label + '</td><td>' + Math.round(o.chance * 100) + ' %</td></tr>').join('');

    function pickWeighted(list, weightOf) {
      const total = list.reduce((n, x) => n + weightOf(x), 0);
      let r = Math.random() * total;
      for (const x of list) {
        r -= weightOf(x);
        if (r <= 0) return x;
      }
      return list[list.length - 1];
    }

    // Ergebnis eines Drehs. Skins: nur welche, die man noch nicht hat (keine Doppelten).
    function roll() {
      const o = pickWeighted(SR.SLOT_ODDS, (x) => x.chance);
      if (o.type === 'skin') {
        const pool = [];
        DEFS.forEach((d, i) =>
          SR.skinList(d.id).forEach((s) => {
            if (!api.owns(d.id, s.id)) pool.push({ index: i, skin: s });
          })
        );
        if (!pool.length) return { type: 'money', amount: 300, complete: true };
        const p = pickWeighted(pool, (x) => SR.RARITY[x.skin.rarity].weight);
        return { type: 'skin', index: p.index, skin: p.skin };
      }
      return o.type === 'money' ? { type: 'money', amount: o.amount } : { type: 'none' };
    }

    function symbolsFor(out) {
      if (out.type === 'skin') {
        const s = { kind: 'weapon', index: out.index };
        return [s, s, s];
      }
      if (out.type === 'money') return [SYMBOLS[DEFS.length], SYMBOLS[DEFS.length], SYMBOLS[DEFS.length]];
      // Niete: niemals drei gleiche
      let a;
      do {
        a = [randSym(), randSym(), randSym()];
      } while (a[0] === a[1] && a[1] === a[2]);
      return a;
    }

    function spinReel(i, finalSym, duration) {
      const strip = el.reels[i];
      const extra = 14 + i * 5;
      const syms = current[i].slice();
      for (let k = 0; k < extra; k++) syms.push(randSym());
      const before = randSym();
      const after = randSym();
      syms.push(before, finalSym, after);
      fillStrip(strip, syms);
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0)';
      void strip.offsetHeight;
      const target = (syms.length - 3) * CELL;
      strip.style.transition = 'transform ' + duration + 'ms cubic-bezier(.15,.7,.2,1)';
      strip.style.transform = 'translateY(-' + target + 'px)';
      current[i] = [before, finalSym, after];
      setTimeout(() => {
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(0)';
        fillStrip(strip, current[i]);
        SR.sound.reelStop();
      }, duration + 20);
    }

    function setMsg(text, kind) {
      el.msg.textContent = text;
      el.msg.dataset.kind = kind || '';
    }

    function refresh() {
      el.money.textContent = api.money().toLocaleString('de-DE');
      el.spin.disabled = spinning || api.money() < SR.SPIN_COST;
      renderGrid();
    }

    function spin() {
      if (spinning) return;
      if (!api.spend(SR.SPIN_COST)) {
        setMsg('Nicht genug Taler. Triff ein paar Scheiben, dann komm wieder!', 'warn');
        return;
      }
      spinning = true;
      el.prize.hidden = true;
      el.reelBoxes.forEach((r) => (r.style.removeProperty('--win')));
      el.root.classList.remove('win');
      setMsg('Die Walzen drehen sich …');
      refresh();
      const out = roll();
      const syms = symbolsFor(out);
      const base = reduced ? 300 : 1100;
      const step = reduced ? 150 : 450;
      syms.forEach((s, i) => spinReel(i, s, base + i * step));
      SR.sound.spinTicks((base + 2 * step) / 1000);
      setTimeout(() => finish(out), base + 2 * step + 120);
    }

    function finish(out) {
      spinning = false;
      if (out.type === 'skin') {
        const d = DEFS[out.index];
        api.unlock(d.id, out.skin.id);
        const r = SR.RARITY[out.skin.rarity];
        lastPrize = { wid: d.id, sid: out.skin.id };
        el.prizeImg.src = api.icon(out.index, out.skin.id);
        el.prizeImg.alt = out.skin.name + ' für ' + d.name;
        el.prizeRarity.textContent = r.name;
        el.prize.style.setProperty('--rar', r.color);
        el.prizeName.textContent = out.skin.name;
        el.prizeWeapon.textContent = 'Neuer Skin für ' + d.name;
        el.prizeEquip.hidden = false;
        el.prizeEquip.textContent = 'Jetzt ausrüsten';
        el.prizeEquip.disabled = false;
        el.prize.hidden = false;
        el.reelBoxes.forEach((b) => b.style.setProperty('--win', r.color));
        el.root.classList.add('win');
        setMsg('Drei Mal ' + d.short + '! Du hast einen ' + r.name.toLowerCase() + 'en Skin gewonnen.', 'win');
        if (out.skin.rarity >= 2) SR.sound.jackpot();
        else SR.sound.win();
      } else if (out.type === 'money') {
        api.earn(out.amount);
        el.reelBoxes.forEach((b) => b.style.setProperty('--win', '#e6ae45'));
        el.root.classList.add('win');
        setMsg(
          out.complete ? 'Du hast schon alle Skins! Dafür gibt es ' + out.amount + ' Taler.' : 'Drei Taler! Du bekommst ' + out.amount + ' Taler.',
          'win'
        );
        SR.sound.coins();
      } else {
        setMsg('Leider nichts. Versuch es noch einmal!', '');
      }
      refresh();
    }

    // Sammlung: alle Skins pro Waffe
    function renderGrid() {
      let owned = 0;
      const rows = DEFS.map((d, i) => {
        const eq = api.equipped(d.id);
        const tiles = [{ id: 'standard', name: 'Standard', rarity: -1 }].concat(SR.skinList(d.id)).map((s) => {
          const has = s.id === 'standard' || api.owns(d.id, s.id);
          if (has && s.id !== 'standard') owned++;
          const rar = s.rarity >= 0 ? SR.RARITY[s.rarity] : null;
          const active = eq === s.id;
          return (
            '<button type="button" class="tile' + (has ? '' : ' locked') + (active ? ' active' : '') + '"' +
            ' data-w="' + d.id + '" data-s="' + s.id + '"' + (has ? '' : ' disabled') +
            ' aria-pressed="' + active + '" style="--rar:' + (rar ? rar.color : '#6b6f66') + '">' +
            '<img alt="" src="' + api.icon(i, s.id) + '">' +
            '<span class="tn">' + (has ? s.name : '???') + '</span>' +
            '<span class="tr">' + (active ? 'aktiv' : rar ? rar.name : 'Grundausstattung') + '</span>' +
            '</button>'
          );
        });
        return '<div class="wrow"><h4>' + d.name + '</h4><div class="tiles">' + tiles.join('') + '</div></div>';
      });
      el.grid.innerHTML = rows.join('');
      el.count.textContent = owned + '/' + SR.SKIN_TOTAL;
    }

    el.grid.addEventListener('click', (e) => {
      const b = e.target.closest('.tile');
      if (!b || b.disabled) return;
      api.equip(b.dataset.w, b.dataset.s);
      SR.sound.pickup();
      renderGrid();
    });
    el.prizeEquip.addEventListener('click', () => {
      if (!lastPrize) return;
      api.equip(lastPrize.wid, lastPrize.sid);
      SR.sound.pickup();
      el.prizeEquip.textContent = 'Ausgerüstet';
      el.prizeEquip.disabled = true;
      renderGrid();
    });
    el.spin.addEventListener('click', spin);
    el.close.addEventListener('click', () => {
      if (!spinning) api.close();
    });

    let built = false;
    return {
      open() {
        if (!built) {
          initReels();
          built = true;
        }
        setMsg('Drei gleiche Waffen = neuer Skin für diese Waffe. Drei Taler = Geld zurück.');
        refresh();
        el.root.hidden = false;
        el.spin.focus();
      },
      hide() {
        el.root.hidden = true;
      },
      get spinning() {
        return spinning;
      },
      spin,
      refresh,
    };
  };
})();
