// Pfeile und Bolzen: fliegen mit Schwerkraft, bleiben in Zielen und im Boden stecken.
// Wohin ein Pfeil trifft, entscheidet das Spiel über hooks.trace (Spieler-Pfeile gegen die Welt, Gegner-Pfeile gegen den Spieler).
(function () {
  'use strict';
  const SR = (window.SR = window.SR || {});
  const V3 = THREE.Vector3;
  const FWD = new V3(0, 0, -1);

  let template = null;
  function buildTemplate() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0xc8a46a, roughness: 0.7 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xb5bac0, metalness: 1, roughness: 0.3 });
    const fletch = new THREE.MeshStandardMaterial({ color: 0xd9d4c4, roughness: 0.9, side: THREE.DoubleSide });
    const red = new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.9, side: THREE.DoubleSide });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.72, 6).rotateX(Math.PI / 2), wood);
    shaft.position.z = 0.34;
    g.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.05, 8).rotateX(-Math.PI / 2), steel);
    tip.position.z = -0.045;
    g.add(tip);
    for (let i = 0; i < 3; i++) {
      // Feder: Fläche in der Ebene aus Pfeilachse (Z) und radialer Richtung (Y), dann um die Achse gedreht
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.018).rotateY(Math.PI / 2).translate(0, 0.01, 0), i === 0 ? red : fletch);
      f.position.z = 0.64;
      f.rotation.z = (i * Math.PI * 2) / 3;
      g.add(f);
    }
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    return g;
  }

  SR.createProjectiles = function (scene, hooks) {
    if (!template) template = buildTemplate();
    const list = [];
    const MAX_STUCK = 60;
    const p0 = new V3();
    const dir = new V3();
    const q = new THREE.Quaternion();

    // owner: 'player' | 'enemy'; vel in m/s; dmg und data gehören dem Aufrufer
    function fire(o) {
      const mesh = template.clone(true);
      mesh.scale.setScalar(o.scale || 1);
      scene.add(mesh);
      const a = {
        mesh,
        pos: o.pos.clone(),
        vel: o.vel.clone(),
        gravity: o.gravity != null ? o.gravity : 6.5,
        owner: o.owner,
        dmg: o.dmg || 0,
        data: o.data || null,
        life: 6,
        stuck: false,
        stuckT: 0,
      };
      mesh.position.copy(a.pos);
      q.setFromUnitVectors(FWD, dir.copy(a.vel).normalize());
      mesh.quaternion.copy(q);
      list.push(a);
      return a;
    }

    function update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const a = list[i];
        if (a.stuck) {
          a.stuckT += dt;
          if (a.stuckT > 25 || (a.stuckT > 20 && !a.mesh.parent)) remove(i);
          continue;
        }
        a.life -= dt;
        if (a.life <= 0 || a.pos.y < -5) {
          remove(i);
          continue;
        }
        // Teilschritte, damit schnelle Pfeile dünne Ziele nicht überspringen
        const steps = Math.max(1, Math.ceil((a.vel.length() * dt) / 4));
        const h = dt / steps;
        let done = false;
        for (let s = 0; s < steps && !done; s++) {
          p0.copy(a.pos);
          a.vel.y -= a.gravity * h;
          a.pos.addScaledVector(a.vel, h);
          const len = p0.distanceTo(a.pos);
          if (len < 1e-5) continue;
          dir.subVectors(a.pos, p0).divideScalar(len);
          const hit = hooks.trace(a, p0, dir, len);
          if (hit) {
            a.stuck = true;
            a.stuckT = 0;
            a.pos.copy(hit.point);
            a.mesh.position.copy(hit.point).addScaledVector(dir, 0.1);
            q.setFromUnitVectors(FWD, dir);
            a.mesh.quaternion.copy(q);
            if (hit.object && hit.attach !== false) hit.object.attach(a.mesh);
            if (hooks.onHit) hooks.onHit(a, hit, dir);
            done = true;
          }
        }
        if (!a.stuck) {
          a.mesh.position.copy(a.pos);
          q.setFromUnitVectors(FWD, dir.copy(a.vel).normalize());
          a.mesh.quaternion.copy(q);
        }
      }
      // zu viele steckende Pfeile: älteste entfernen
      let stuck = 0;
      for (let i = 0; i < list.length; i++) if (list[i].stuck) stuck++;
      for (let i = 0; stuck > MAX_STUCK && i < list.length; i++) {
        if (list[i].stuck) {
          remove(i);
          i--;
          stuck--;
        }
      }
    }

    function remove(i) {
      const a = list[i];
      if (a.mesh.parent) a.mesh.parent.remove(a.mesh);
      list.splice(i, 1);
    }

    function clear(owner) {
      for (let i = list.length - 1; i >= 0; i--) if (!owner || list[i].owner === owner) remove(i);
    }

    return { fire, update, clear, list };
  };
})();
