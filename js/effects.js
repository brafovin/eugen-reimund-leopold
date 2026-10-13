// Einschlag-Effekte (Splitter, Staub) und ausgeworfene Hülsen.
(function () {
  'use strict';
  const SR = (window.SR = window.SR || {});

  const SURFACE = {
    grass: { color: 0x6b5a3a, dust: 0x9a8a68, count: 7, speed: 2.2 },
    gravel: { color: 0x8a7d66, dust: 0xb5a88d, count: 8, speed: 2.6 },
    concrete: { color: 0x9a978f, dust: 0xc8c5bd, count: 8, speed: 3.0 },
    wood: { color: 0x8a6238, dust: 0xc6a77c, count: 6, speed: 2.0 },
    target: { color: 0xd8bd88, dust: 0xe6d3a8, count: 6, speed: 1.6 },
    steel: { color: 0xffc46b, dust: 0xbab6ad, count: 9, speed: 4.5 },
    cloth: { color: 0x8d8774, dust: 0xb9b2a0, count: 5, speed: 1.4 },
  };
  SR.SURFACE = SURFACE;

  SR.createEffects = function (scene, vmScene) {
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();

    // --- Splitter ---
    const N = 420;
    const debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), N);
    debris.frustumCulled = false;
    debris.castShadow = false;
    const parts = [];
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = 0; i < N; i++) {
      debris.setMatrixAt(i, dummy.matrix);
      debris.setColorAt(i, col.set(0xffffff));
      parts.push({ life: 0, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), size: 0.02 });
    }
    scene.add(debris);
    let nextPart = 0;

    // --- Staubwölkchen ---
    const softTex = SR.tex.soft();
    const puffs = [];
    for (let i = 0; i < 40; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false;
      scene.add(s);
      puffs.push({ sprite: s, life: 0, max: 1, size: 1, rise: 0.3 });
    }
    let nextPuff = 0;

    // --- Hülsen (im Waffen-Blickfeld) ---
    const brass = new THREE.MeshStandardMaterial({ color: 0xcaa047, metalness: 1, roughness: 0.3 });
    const hullMats = {}; // farbige Schrotpatronen-Hülsen
    const shellGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
    const shells = [];
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(shellGeo, brass);
      m.visible = false;
      vmScene.add(m);
      shells.push({ mesh: m, life: 0, vel: new THREE.Vector3(), spin: new THREE.Vector3() });
    }
    let nextShell = 0;

    // lite: kleiner Einschlag für einzelne Schrotkugeln
    function impact(point, normal, surfaceName, scale, lite) {
      const s = SURFACE[surfaceName] || SURFACE.grass;
      const k = scale || 1;
      const n = normal || new THREE.Vector3(0, 1, 0);
      const count = lite ? 2 : s.count;
      for (let i = 0; i < count; i++) {
        const p = parts[nextPart];
        debris.setColorAt(nextPart, col.set(s.color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.1));
        nextPart = (nextPart + 1) % N;
        p.pos.copy(point).addScaledVector(n, 0.01);
        p.vel
          .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
          .multiplyScalar(1.4)
          .add(n)
          .normalize()
          .multiplyScalar(s.speed * (0.5 + Math.random()) * k);
        p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        p.spin.set(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10);
        p.size = (0.012 + Math.random() * 0.02) * Math.sqrt(k);
        p.max = p.life = 0.5 + Math.random() * 0.5;
      }
      debris.instanceColor.needsUpdate = true;
      if (lite && Math.random() < 0.6) return;

      const pf = puffs[nextPuff];
      nextPuff = (nextPuff + 1) % puffs.length;
      pf.sprite.position.copy(point).addScaledVector(n, 0.05);
      pf.sprite.material.color.set(s.dust);
      pf.sprite.visible = true;
      pf.size = (lite ? 0.22 : 0.35) * k;
      pf.max = pf.life = 0.9;
      pf.sprite.material.rotation = Math.random() * 6;
    }

    // --- Energiestrahlen (Phantom-X) ---
    const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).rotateX(Math.PI / 2);
    const beams = [];
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(
        beamGeo,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false })
      );
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      beams.push({ mesh: m, life: 0, max: 1, len: 1 });
    }
    let nextBeam = 0;
    // width: Grundbreite, life: Sekunden sichtbar (Strahlen wachsen beim Verblassen leicht)
    function beam(from, to, color, width, life) {
      const b = beams[nextBeam];
      nextBeam = (nextBeam + 1) % beams.length;
      b.len = from.distanceTo(to);
      b.mesh.position.copy(from).add(to).multiplyScalar(0.5);
      b.mesh.lookAt(to);
      b.mesh.material.color.set(color);
      b.mesh.visible = true;
      b.width = width || 0.006;
      b.max = b.life = life || 0.14;
    }
    // Leuchtspur der Gegner-Schüsse: dünn und kurz
    function tracer(from, to, color) {
      beam(from, to, color || 0xffd27a, 0.007, 0.07);
    }

    // pos/dir im Kamera-Raum (vmScene)
    function ejectShell(pos, dir, r, len, color) {
      const s = shells[nextShell];
      nextShell = (nextShell + 1) % shells.length;
      if (color) {
        if (!hullMats[color]) hullMats[color] = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
        s.mesh.material = hullMats[color];
      } else {
        s.mesh.material = brass;
      }
      s.mesh.position.copy(pos);
      s.mesh.scale.set(r, len, r);
      s.mesh.rotation.set(Math.PI / 2, 0, Math.random());
      s.mesh.visible = true;
      s.vel.copy(dir);
      s.spin.set(Math.random() * 30 - 15, Math.random() * 30 - 15, Math.random() * 30 - 15);
      s.life = 0.7;
    }

    function update(dt) {
      let any = false;
      for (let i = 0; i < N; i++) {
        const p = parts[i];
        if (p.life <= 0) continue;
        p.life -= dt;
        any = true;
        if (p.life <= 0) {
          dummy.scale.setScalar(0);
        } else {
          p.vel.y -= 9.8 * dt;
          p.pos.addScaledVector(p.vel, dt);
          if (p.pos.y < 0.01) {
            p.pos.y = 0.01;
            p.vel.multiplyScalar(0.3);
            p.vel.y = Math.abs(p.vel.y) * 0.3;
          }
          p.rot.x += p.spin.x * dt;
          p.rot.y += p.spin.y * dt;
          p.rot.z += p.spin.z * dt;
          dummy.position.copy(p.pos);
          dummy.rotation.copy(p.rot);
          dummy.scale.setScalar(p.size * Math.min(1, (p.life / p.max) * 2));
        }
        dummy.updateMatrix();
        debris.setMatrixAt(i, dummy.matrix);
      }
      if (any) debris.instanceMatrix.needsUpdate = true;

      puffs.forEach((pf) => {
        if (pf.life <= 0) return;
        pf.life -= dt;
        if (pf.life <= 0) {
          pf.sprite.visible = false;
          return;
        }
        const k = 1 - pf.life / pf.max;
        pf.sprite.scale.setScalar(pf.size * (0.4 + k * 1.8));
        pf.sprite.position.y += dt * 0.25;
        pf.sprite.material.opacity = 0.55 * (1 - k) * Math.min(1, k * 8);
      });

      beams.forEach((b) => {
        if (b.life <= 0) return;
        b.life -= dt;
        if (b.life <= 0) {
          b.mesh.visible = false;
          return;
        }
        const k = b.life / b.max;
        const w = b.width + (1 - k) * b.width * 2;
        b.mesh.scale.set(w, w, b.len);
        b.mesh.material.opacity = k;
      });

      shells.forEach((s) => {
        if (s.life <= 0) return;
        s.life -= dt;
        if (s.life <= 0) {
          s.mesh.visible = false;
          return;
        }
        s.vel.y -= 4.5 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
        s.mesh.rotation.x += s.spin.x * dt;
        s.mesh.rotation.y += s.spin.y * dt;
        s.mesh.rotation.z += s.spin.z * dt;
      });
    }

    return { impact, ejectShell, beam, tracer, update };
  };
})();
