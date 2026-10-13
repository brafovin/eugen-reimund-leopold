// Waffen-Skins: 4 pro Waffe, je einer pro Seltenheit.
// Ein Skin ersetzt die Materialien eines Modells anhand ihrer Rolle (metal, wood, poly …, siehe weapons.js).
(function () {
  'use strict';
  const SR = (window.SR = window.SR || {});
  const T = SR.tex;

  SR.RARITY = [
    { name: 'Gewöhnlich', color: '#aab1b9', weight: 50 },
    { name: 'Selten', color: '#4f93e6', weight: 30 },
    { name: 'Episch', color: '#b06ae6', weight: 15 },
    { name: 'Legendär', color: '#e6ae45', weight: 5 },
    { name: 'Geheim', color: '#ff4fa3', weight: 0 }, // nur Geheimwaffe, eigene Chance am Automaten
  ];
  SR.SECRET_RARITY = 4;

  const GOLD = { color: 0xd8ac3a, metalness: 1, roughness: 0.18 };
  const GOLD_DARK = { color: 0x9c7420, metalness: 1, roughness: 0.25 };

  // tex: Funktion, die die Textur erzeugt (erst wenn der Skin gebraucht wird)
  SR.SKINS = {
    c96: [
      {
        id: 'kirsch',
        name: 'Kirschholz',
        rarity: 0,
        wood: { tex: () => T.wood([170, 64, 42], 31, 128), repeat: 3, roughness: 0.38 },
        metal: { color: 0x283553, metalness: 0.9, roughness: 0.22 },
      },
      {
        id: 'nickel',
        name: 'Nickel',
        rarity: 1,
        metal: { color: 0xcfd3d8, metalness: 1, roughness: 0.16 },
        metalDark: { color: 0x8e9399, metalness: 1, roughness: 0.25 },
        wood: { color: 0x161616, roughness: 0.35 },
      },
      {
        id: 'damast',
        name: 'Damaszener',
        rarity: 2,
        metal: { tex: () => T.damascus('#2e333b', '#b4bbc6', 5), repeat: 2, metalness: 0.95, roughness: 0.25 },
        wood: { tex: () => T.wood([62, 38, 27], 12, 128), repeat: 3, roughness: 0.32 },
      },
      {
        id: 'gold',
        name: 'Gold & Elfenbein',
        rarity: 3,
        metal: GOLD,
        metalDark: GOLD_DARK,
        wood: { color: 0xefe7d2, roughness: 0.3 },
      },
    ],
    revolver: [
      {
        id: 'hirsch',
        name: 'Hirschhorn',
        rarity: 0,
        wood: { tex: () => T.camo(['#cdb894', '#a88e66', '#e5d6b8', '#8d7550'], 3, { count: 120, minR: 3, maxR: 11 }), repeat: 2, roughness: 0.55 },
        metal: { color: 0x3b3f46, metalness: 0.8, roughness: 0.42 },
      },
      {
        id: 'schwarzchrom',
        name: 'Schwarzchrom',
        rarity: 1,
        metal: { color: 0x15171b, metalness: 1, roughness: 0.08 },
        wood: { color: 0x8f1d1d, roughness: 0.3 },
      },
      {
        id: 'gravur',
        name: 'Silbergravur',
        rarity: 2,
        metal: { tex: () => T.engraving('#c3c8cf', '#4d535c', 7), repeat: 1.5, metalness: 1, roughness: 0.22 },
        wood: { color: 0xf0e9d8, roughness: 0.3 },
      },
      {
        id: 'rosegold',
        name: 'Rosé-Gold',
        rarity: 3,
        metal: { color: 0xe0a08a, metalness: 1, roughness: 0.16 },
        metalDark: { color: 0xa86a58, metalness: 1, roughness: 0.24 },
        wood: { color: 0xf6f2ee, roughness: 0.15, emissive: 0x1a1410 },
      },
    ],
    g36: [
      {
        id: 'wueste',
        name: 'Wüste',
        rarity: 0,
        poly: { color: 0xb69c6e, roughness: 0.75 },
        polyDark: { color: 0x8a7550, roughness: 0.8 },
      },
      {
        id: 'flecktarn',
        name: 'Flecktarn',
        rarity: 1,
        poly: { tex: () => T.flecktarn(), repeat: 2, roughness: 0.8 },
      },
      {
        id: 'arktis',
        name: 'Arktis',
        rarity: 2,
        poly: { tex: () => T.digital(['#e9edf0', '#b9c2c9', '#8a959e', '#d2d9de'], 4, 8), repeat: 2, roughness: 0.7 },
        polyDark: { color: 0xc9d0d6, roughness: 0.7 },
      },
      {
        id: 'neon',
        name: 'Neon',
        rarity: 3,
        poly: { color: 0x111214, roughness: 0.4, glowTex: () => T.neonLines('#39ff7a'), glow: 0xffffff, glowIntensity: 1.4, repeat: 3 },
        polyDark: { color: 0x0c0d0e, roughness: 0.4 },
        mag: { color: 0x1f8f45, roughness: 0.25, opacity: 0.8, glow: 0x0f6a2c, glowIntensity: 0.8 },
      },
    ],
    kr86: [
      {
        id: 'birke',
        name: 'Birke',
        rarity: 0,
        wood: { tex: () => T.wood([226, 204, 165], 41, 256), repeat: 4, roughness: 0.5 },
      },
      {
        id: 'waldtarn',
        name: 'Waldtarn',
        rarity: 1,
        wood: { tex: () => T.camo(['#4b5a33', '#2c3a22', '#6d6a42', '#1f1f17'], 9, { count: 70, minR: 10, maxR: 30 }), repeat: 3, roughness: 0.8 },
        metal: { color: 0x3a3f33, metalness: 0.4, roughness: 0.6 },
      },
      {
        id: 'ebenholz',
        name: 'Ebenholz',
        rarity: 2,
        wood: { tex: () => T.wood([60, 40, 32], 14, 256), repeat: 4, roughness: 0.3 },
        metal: { color: 0x1d2a46, metalness: 0.9, roughness: 0.22 },
      },
      {
        id: 'koenigsgold',
        name: 'Königsgold',
        rarity: 3,
        metal: GOLD,
        metalDark: GOLD_DARK,
        wood: { tex: () => T.wood([140, 52, 26], 27, 256), repeat: 4, roughness: 0.25 },
      },
    ],
    birdshot: [
      {
        id: 'jagdgruen',
        name: 'Jagdgrün',
        rarity: 0,
        metal: { color: 0x2e4a33, metalness: 0.6, roughness: 0.4 },
        wood: { tex: () => T.wood([150, 128, 80], 5, 128), repeat: 3, roughness: 0.5 },
      },
      {
        id: 'gravur',
        name: 'Jagdgravur',
        rarity: 1,
        metalBright: { tex: () => T.engraving('#c9cdd3', '#555b63', 11), repeat: 1, metalness: 1, roughness: 0.2 },
        metal: { color: 0x2b2f36, metalness: 0.9, roughness: 0.3 },
      },
      {
        id: 'bernstein',
        name: 'Bernstein',
        rarity: 2,
        wood: { tex: () => T.wood([235, 140, 40], 8, 128), repeat: 3, roughness: 0.12, glow: 0x2a1300, glowIntensity: 1 },
        metal: { color: 0x5b3b20, metalness: 1, roughness: 0.3 },
      },
      {
        id: 'platin',
        name: 'Platin',
        rarity: 3,
        metal: { color: 0xe8e8e6, metalness: 1, roughness: 0.1 },
        metalBright: { color: 0xf6f6f4, metalness: 1, roughness: 0.08 },
        wood: { color: 0x161412, roughness: 0.25 },
      },
    ],
    sg21: [
      {
        id: 'blaze',
        name: 'Signal-Orange',
        rarity: 0,
        poly: { color: 0xe8661a, roughness: 0.6 },
        polyDark: { color: 0xb34c10, roughness: 0.65 },
      },
      {
        id: 'holzfaeller',
        name: 'Holzfäller',
        rarity: 1,
        poly: { tex: () => T.plaid(['#a3201b', '#1a1a1a', '#d33b2c']), repeat: 3, roughness: 0.85 },
      },
      {
        id: 'moos',
        name: 'Moos',
        rarity: 2,
        poly: { tex: () => T.camo(['#5b6b2e', '#3b4a1f', '#8a8f4a', '#2a2f18'], 21, { count: 80, minR: 6, maxR: 22 }), repeat: 2.5, roughness: 0.9 },
      },
      {
        id: 'lava',
        name: 'Lava',
        rarity: 3,
        poly: { tex: () => T.lava('map', 13), glowTex: () => T.lava('glow', 13), glow: 0xffffff, glowIntensity: 1.6, repeat: 2, roughness: 0.7 },
        metal: { color: 0x1a1a1a, metalness: 0.6, roughness: 0.5 },
        metalDark: { color: 0x121212, metalness: 0.6, roughness: 0.5 },
      },
    ],
    // Geheim-Skins: jeder hat am Automaten 0,99 % Chance pro Dreh
    phantom: [
      {
        id: 'galaxie',
        name: 'Galaxie',
        rarity: 4,
        poly: { tex: () => T.galaxy('map', 3), glowTex: () => T.galaxy('glow', 3), glow: 0xffffff, glowIntensity: 1.1, repeat: 2, roughness: 0.3 },
        polyDark: { color: 0x120a2a, roughness: 0.4, metalness: 0.3 },
        energy: { color: 0xffb8ff, glow: 0xff4dff, glowIntensity: 2.4 },
      },
      {
        id: 'regenbogen',
        name: 'Regenbogen',
        rarity: 4,
        poly: { tex: () => T.rainbow(), glowTex: () => T.rainbow(), glow: 0xffffff, glowIntensity: 0.45, repeat: 1.5, roughness: 0.25 },
        polyDark: { color: 0xf4f4f4, roughness: 0.3 },
        energy: { color: 0xffffff, glow: 0xffffff, glowIntensity: 2.2 },
      },
      {
        id: 'diamant',
        name: 'Diamant',
        rarity: 4,
        poly: { color: 0xdff6ff, metalness: 1, roughness: 0.05 },
        polyDark: { color: 0x8fd0ff, metalness: 1, roughness: 0.1 },
        metal: { color: 0xffffff, metalness: 1, roughness: 0.04 },
        energy: { color: 0xc8fbff, glow: 0x7fe9ff, glowIntensity: 2.8 },
      },
    ],
  };

  SR.skinList = (weaponId) => SR.SKINS[weaponId] || [];
  SR.findSkin = (weaponId, skinId) => SR.skinList(weaponId).find((s) => s.id === skinId) || null;
  SR.SKIN_TOTAL = Object.keys(SR.SKINS).reduce((n, k) => n + SR.SKINS[k].length, 0);

  function makeMat(p) {
    const o = {
      color: p.color != null ? p.color : 0xffffff,
      metalness: p.metalness || 0,
      roughness: p.roughness != null ? p.roughness : 0.6,
    };
    if (p.tex) {
      o.map = p.tex();
      if (p.repeat) o.map.repeat.set(p.repeat, p.repeat);
    }
    if (p.glowTex) {
      o.emissiveMap = p.glowTex();
      if (p.repeat) o.emissiveMap.repeat.set(p.repeat, p.repeat);
    }
    if (p.glow != null) {
      o.emissive = p.glow;
      o.emissiveIntensity = p.glowIntensity != null ? p.glowIntensity : 1;
    }
    if (p.opacity != null) {
      o.transparent = true;
      o.opacity = p.opacity;
    }
    return new THREE.MeshStandardMaterial(o);
  }

  function shade(mat, k) {
    const m = mat.clone();
    m.color.multiplyScalar(k);
    return m;
  }

  function buildSkinMats(spec) {
    const out = {};
    if (spec.metal) {
      out.metal = makeMat(spec.metal);
      out.metalDark = spec.metalDark ? makeMat(spec.metalDark) : shade(out.metal, 0.55);
      out.metalBright = spec.metalBright ? makeMat(spec.metalBright) : shade(out.metal, 1.2);
    } else if (spec.metalBright) {
      out.metalBright = makeMat(spec.metalBright);
    }
    if (spec.wood) {
      out.wood = makeMat(spec.wood);
      out.woodDark = shade(out.wood, 0.6);
    }
    if (spec.poly) {
      out.poly = makeMat(spec.poly);
      out.polyDark = spec.polyDark ? makeMat(spec.polyDark) : shade(out.poly, 0.75);
      out.polyDS = out.poly.clone();
      out.polyDS.side = THREE.DoubleSide;
    }
    if (spec.mag) out.mag = makeMat(spec.mag);
    if (spec.energy) out.energy = makeMat(spec.energy);
    return out;
  }

  const cache = {};
  SR.getSkinMats = function (weaponId, skinId) {
    const key = weaponId + ':' + skinId;
    if (!cache[key]) {
      const spec = SR.findSkin(weaponId, skinId);
      cache[key] = spec ? buildSkinMats(spec) : {};
    }
    return cache[key];
  };

  // Skin auf ein Waffenmodell anwenden ('standard' oder unbekannt = Originalmaterialien)
  SR.applySkin = function (group, weaponId, skinId) {
    const mats = skinId && skinId !== 'standard' ? SR.getSkinMats(weaponId, skinId) : null;
    group.traverse((o) => {
      if (!o.isMesh) return;
      if (!o.userData.baseMat) o.userData.baseMat = o.material;
      const base = o.userData.baseMat;
      const role = base.userData && base.userData.role;
      o.material = (mats && role && mats[role]) || base;
    });
  };
})();
