// Waffenwand: Holzwand mit Dach, Regalbrett und Haken auf der rechten Seite der Betonplatte.
// Die Waffen selbst hängt das Spiel auf (game.js); hier stehen nur Wand, Dach, Schild und die Platz-Maße.
(function () {
  'use strict';
  const SR = (window.SR = window.SR || {});

  const WALL = { x: 3.78, z0: -1.15, z1: 3.55 }; // x = Vorderseite der Rückwand (zeigt nach -X zum Spieler)

  SR.WALL = {
    x: WALL.x,
    z0: WALL.z0,
    z1: WALL.z1,
    // Mittelpunkt-z jedes Platzes (Reihenfolge wie die Wandwaffen in SR.WEAPON_DEFS); der Bogen braucht mehr Platz
    slotZ: [-0.5, 0.38, 0.98, 1.6, 2.22, 2.84],
    // z-Mitte für Platz i von n Wandwaffen (bei genau 6 die handgesetzten Werte, sonst gleichmäßig verteilt)
    slotZFor(i, n) {
      if (n === 6) return this.slotZ[i];
      const a = this.z0 + 0.5;
      const b = this.z1 - 0.5;
      return n <= 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1);
    },
    rowY: 1.42, // Höhe der Mitte aufgehängter Langwaffen
    pistolY: 1.32,
  };

  SR.buildWall = function (scene, floorY) {
    const g = new THREE.Group();
    scene.add(g);
    const parts = [];
    const woodTex = SR.tex.wood([138, 98, 60], 41, 256);
    woodTex.repeat.set(1, 4);
    const darkTex = SR.tex.wood([88, 60, 38], 7, 256);
    darkTex.repeat.set(1, 3);
    const woodM = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.82 });
    const darkM = new THREE.MeshStandardMaterial({ map: darkTex, roughness: 0.8 });
    const steelM = new THREE.MeshStandardMaterial({ color: 0x3a3f3a, roughness: 0.5, metalness: 0.7 });
    const feltM = new THREE.MeshStandardMaterial({ color: 0x55603f, roughness: 1 });

    function add(geo, mat, x, y, z, rot) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.surface = 'wood';
      g.add(m);
      parts.push(m);
      return m;
    }
    const RB = (w, h, d) => SR.mk.roundedBoxGeo(w, h, d, 0.012);

    const len = WALL.z1 - WALL.z0;
    const zc = (WALL.z0 + WALL.z1) / 2;
    const top = floorY + 2.35;

    // Rückwand aus senkrechten Brettern, Filzfläche hinter den Waffen
    add(RB(0.06, 2.2, len), woodM, WALL.x + 0.03, floorY + 1.2, zc);
    add(RB(0.012, 1.2, len - 0.3), feltM, WALL.x - 0.004, floorY + 1.4, zc).userData.surface = 'wall';
    // Pfosten und Querbalken
    [WALL.z0, WALL.z1].forEach((z) => add(RB(0.16, 2.75, 0.16), darkM, WALL.x + 0.08, floorY + 1.375, z));
    add(RB(0.14, 0.14, len + 0.16), darkM, WALL.x + 0.07, top, zc);
    // Dach: schräge Bretter, Vorderkante tiefer
    const roof = add(RB(0.95, 0.05, len + 0.5), darkM, WALL.x - 0.12, floorY + 2.62, zc, [0, 0, 0.2]);
    roof.castShadow = true;
    // Streben
    [WALL.z0, WALL.z1].forEach((z) => add(RB(0.07, 0.07, 0.5), darkM, WALL.x - 0.03, floorY + 2.38, z, [0, 0, -0.9]));
    // Regalbrett für Namensschilder und Hakenleiste
    add(RB(0.2, 0.05, len - 0.2), darkM, WALL.x - 0.08, floorY + 0.62, zc);
    add(RB(0.035, 0.05, len - 0.4), steelM, WALL.x - 0.02, floorY + 1.88, zc);
    for (let z = WALL.z0 + 0.3; z < WALL.z1 - 0.2; z += 0.3) {
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6).rotateZ(Math.PI / 2), steelM, WALL.x - 0.045, floorY + 1.88, z);
    }

    // Schild
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.28),
      new THREE.MeshStandardMaterial({ map: SR.tex.label('WAFFENWAND', { w: 512, h: 96, bg: '#33261a', fg: '#e8d7a6', border: '#1c140d', font: '"Saira Stencil One", Impact, sans-serif', weight: '400', scale: 0.6 }), roughness: 0.8 })
    );
    sign.position.set(WALL.x - 0.02, floorY + 2.12, zc);
    sign.rotation.y = -Math.PI / 2;
    g.add(sign);

    // Lampe unter dem Dach, damit die Waffen im Dachschatten gut zu sehen sind
    const lamp = new THREE.PointLight(0xffe3b8, 1.6, 8, 2);
    lamp.position.set(WALL.x - 0.45, floorY + 2.25, zc);
    g.add(lamp);

    return { group: g, parts, wall: SR.WALL, floorY };
  };
})();
