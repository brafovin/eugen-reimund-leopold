// Gegner: Menschen mit den Waffen aus dem Spiel (nicht der Geheimwaffe), die auf Feldwegen patrouillieren,
// den Spieler entdecken, zielen und schießen. Jeder Gegner hat eine Lebensleiste (hp).
(function () {
  'use strict';
  const SR = (window.SR = window.SR || {});
  const V3 = THREE.Vector3;

  // Werte je Waffe. dmg = Schaden am Spieler pro Treffer (bei Schrot pro Kugel), sigma = Zielfehler (Bogenmaß, 1 sigma),
  // range = ab hier greift der Gegner an, react = Reaktionszeit, aimTime = Waffe heben, burst = Schüsse pro Salve.
  const TYPES = {
    c96: { outfit: 'gangster', hp: 90, speed: 1.5, range: 42, react: 0.7, aimTime: 0.35, interval: 0.14, burst: [3, 4], pause: [1.3, 2.2], dmg: 2.8, sigma: 0.024, lag: 0.25 },
    revolver: { outfit: 'cowboy', hp: 100, speed: 1.4, range: 48, react: 0.8, aimTime: 0.4, interval: 0.95, burst: [1, 2], pause: [1.0, 1.7], dmg: 8, sigma: 0.013, lag: 0.3 },
    g36: { outfit: 'soldier', hp: 110, speed: 1.5, range: 78, react: 0.7, aimTime: 0.45, interval: 0.14, burst: [3, 4], pause: [1.2, 2.0], dmg: 3.0, sigma: 0.012, lag: 0.3 },
    kr86: { outfit: 'sniper', hp: 70, speed: 1.0, range: 118, react: 1.0, aimTime: 0.6, interval: 1, burst: [1, 1], pause: [2.4, 3.4], dmg: 30, sigma: 0.003, telegraph: 1.0, lag: 0 },
    birdshot: { outfit: 'hunter', hp: 100, speed: 1.3, range: 52, react: 0.9, aimTime: 0.5, interval: 1, burst: [1, 1], pause: [1.6, 2.4], dmg: 2.4, pellets: 10, spread: 0.04, sigma: 0.014, lag: 0.3 },
    sg21: { outfit: 'lumberjack', hp: 135, speed: 1.4, run: 3.3, range: 24, react: 0.6, aimTime: 0.4, interval: 1, burst: [1, 1], pause: [1.3, 1.9], dmg: 2.8, pellets: 9, spread: 0.075, sigma: 0.02, charge: true, stop: 10, lag: 0.2 },
    bogen: { outfit: 'archer', hp: 85, speed: 1.4, range: 62, react: 0.9, aimTime: 0.4, interval: 1, burst: [1, 1], pause: [1.1, 1.8], dmg: 18, arrow: { speed: 56, draw: 0.85 }, lag: 0 },
    uz9: { outfit: 'bandit', hp: 80, speed: 1.6, run: 3.0, range: 36, react: 0.6, aimTime: 0.3, interval: 0.075, burst: [5, 8], pause: [1.4, 2.2], dmg: 2.0, sigma: 0.03, charge: true, stop: 13, lag: 0.25 },
    lever: { outfit: 'rancher', hp: 105, speed: 1.3, range: 72, react: 0.9, aimTime: 0.5, interval: 1, burst: [1, 1], pause: [1.3, 2.0], dmg: 12, sigma: 0.006, lag: 0.45 },
  };
  SR.ENEMY_TYPES = TYPES;

  // Wer läuft auf welchem Weg (Gegner mit fehlender Waffe werden übersprungen)
  const SQUADS = [
    { path: 'wald', list: ['c96', 'birdshot', 'bogen'] },
    { path: 'handel', list: ['g36', 'revolver', 'sg21'] },
    { path: 'feld', list: ['uz9', 'g36', 'lever'] },
    { path: 'grat', list: ['kr86'] },
  ];

  const rnd = (a, b) => a + Math.random() * (b - a);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(Math.PI * 2 * Math.random());
  const approach = (v, t, s) => (v < t ? Math.min(t, v + s) : Math.max(t, v - s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angDiff = (a, b) => {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };

  // Abstand eines Strahls (O + t·D, t ≥ 0) zu einer Strecke A–B; liefert {dist, t}
  const _E = new V3();
  const _W = new V3();
  const _c1 = new V3();
  const _c2 = new V3();
  function rayVsSegment(O, D, A, B) {
    _E.subVectors(B, A);
    _W.subVectors(O, A);
    const b = D.dot(_E);
    const c = _E.dot(_E);
    const d = D.dot(_W);
    const e = _E.dot(_W);
    let t = c > 1e-9 ? clamp(e / c, 0, 1) : 0;
    let s = 0;
    for (let i = 0; i < 3; i++) {
      s = Math.max(0, b * t - d);
      t = c > 1e-9 ? clamp((b * s + e) / c, 0, 1) : 0;
    }
    _c1.copy(O).addScaledVector(D, s);
    _c2.copy(A).addScaledVector(_E, t);
    return { dist: _c1.distanceTo(_c2), t: s };
  }

  SR.createEnemies = function (ctx) {
    SR.preparePaths();
    const list = [];
    const parts = []; // alle treffbaren Teile lebender Gegner
    let version = 0;
    const tmpM = new V3();
    const tmpT = new V3();
    const tmpD = new V3();
    const tmpR = new V3();
    const tmpU = new V3();
    const tmpA = new V3();
    const tmpB = new V3();
    const losOrigin = new V3();
    const UPV = new V3(0, 1, 0);
    // Wo der Spieler vor kurzem war: Gegner zielen mit Verzögerung, wer sich bewegt, wird seltener getroffen
    const hist = [];
    const lagPos = new V3();
    function lagged(now, lag, P) {
      if (!lag) return P.center;
      const t = now - lag;
      let pick = null;
      for (let i = hist.length - 1; i >= 0; i--) {
        if (hist[i].t <= t) {
          pick = hist[i];
          break;
        }
      }
      if (!pick) pick = hist[0];
      if (!pick) return P.center;
      return lagPos.set(pick.x, pick.y, pick.z);
    }

    function setParts(e, on) {
      e.human.hitParts.forEach((p) => {
        const i = parts.indexOf(p);
        if (on && i < 0) parts.push(p);
        if (!on && i >= 0) parts.splice(i, 1);
      });
      version++;
    }

    function place(e, fresh) {
      const P = e.path;
      e.dir = 1;
      // Gruppenmitglieder verteilen sich über den Weg, damit sie nicht aufeinander kleben
      e.s = fresh ? rnd(0, P.length * 0.18) : P.length * (0.06 + 0.2 * (e.slot || 0)) + rnd(0, 12);
      SR.pathPoint(P, e.s, tmpM);
      e.pos.set(tmpM.x, 0, tmpM.z);
      e.offPath = false;
    }

    function spawn(path, typeId, slot) {
      const T = TYPES[typeId];
      const def = SR.WEAPON_DEFS.find((d) => d.id === typeId);
      if (!T || !def || def.secret) return null;
      const human = SR.buildHuman({ def, outfit: T.outfit });
      const e = {
        type: typeId,
        slot,
        T,
        def,
        human,
        path,
        s: 0,
        dir: 1,
        pos: new V3(),
        yaw: 0,
        state: 'patrol',
        hp: T.hp,
        maxHp: T.hp,
        sightT: 0,
        loseT: 0,
        los: false,
        losT: Math.random() * 0.3,
        nextShot: 0,
        burstLeft: 0,
        lockPoint: null,
        telT: 0,
        drawT: -1,
        strafeDir: 1,
        strafeT: 0,
        engageT: 0,
        hunt: 0,
        hurtT: 99,
        offPath: false,
        deadT: 0,
        respawnAt: 0,
        waitT: 0,
        lastDist: 999,
      };
      human.hitParts.forEach((p) => {
        p.userData.enemy = e;
      });
      human.root.traverse((o) => {
        if (o.isMesh) o.userData.isEnemyPart = true;
      });
      place(e, false);
      human.root.position.set(e.pos.x, 0, e.pos.z);
      ctx.scene.add(human.root);
      setParts(e, true);
      list.push(e);
      return e;
    }

    SQUADS.forEach((sq) => {
      const path = SR.PATHS.find((p) => p.id === sq.path);
      let n = 0;
      sq.list.forEach((id) => {
        if (spawn(path, id, n)) n++;
      });
    });

    function hasLOS(e, P) {
      losOrigin.set(e.pos.x, 1.55, e.pos.z);
      tmpD.subVectors(P.center, losOrigin);
      const d = tmpD.length();
      tmpD.divideScalar(d);
      return !ctx.traceStatic(losOrigin, tmpD, d - 0.3);
    }

    function die(e, now) {
      e.state = 'dead';
      e.deadT = 0;
      e.respawnAt = now + 45;
      e.human.state.speed = 0;
      e.human.state.draw = 0;
      setParts(e, false);
    }

    function respawn(e) {
      e.hp = e.maxHp;
      e.state = 'patrol';
      e.sightT = 0;
      e.hunt = 0;
      e.deadT = 0;
      e.drawT = -1;
      e.telT = 0;
      e.human.state.dead = 0;
      e.human.state.aim = 0;
      place(e, true);
      setParts(e, true);
    }

    // Schaden durch den Spieler. Liefert { killed } oder null, wenn der Gegner schon liegt.
    function damage(e, amount, head, now) {
      if (e.state === 'dead') return null;
      e.hp -= amount;
      e.hurtT = 0;
      e.human.state.flinch = 1;
      e.hunt = 10;
      e.sightT = 99;
      if (e.hp <= 0) {
        e.hp = 0;
        die(e, now);
        return { killed: true };
      }
      return { killed: false };
    }

    // Spieler hat geschossen: Gegner in Hörweite werden aufmerksam und suchen ihn
    function noise(pos, radius) {
      list.forEach((e) => {
        if (e.state === 'dead') return;
        if (Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < radius && e.hunt < 4) e.hunt = 4;
      });
    }

    // ---- Schießen ----
    function enemyShot(e, P, now) {
      const T = e.T;
      const h = e.human;
      h.root.updateMatrixWorld(true);
      h.muzzleWorld(tmpM);
      const aimAt = e.lockPoint || lagged(now, T.lag, P);
      const D = tmpM.distanceTo(aimAt);
      h.state.kick = 1;
      // Zu Beginn eines Kampfes zielt der Gegner schlecht (Fehler ×3), nach ca. 2,5 s normal
      const warm = 1 + Math.max(0, 2.5 - e.engageT) * 0.8;

      if (T.arrow) {
        // Pfeil mit Flugbahn: hält vor, wo der Spieler steht (leicht oberhalb wegen der Schwerkraft)
        const tFlight = D / T.arrow.speed;
        tmpT.copy(aimAt);
        tmpT.y += 0.5 * 6.5 * tFlight * tFlight;
        const m = Math.abs(gauss()) * 0.012 * D * warm;
        const a = Math.random() * Math.PI * 2;
        tmpT.x += Math.cos(a) * m;
        tmpT.z += Math.sin(a) * m;
        tmpT.y += Math.sin(a) * m * 0.5;
        tmpD.subVectors(tmpT, tmpM).normalize();
        ctx.projectiles.fire({ pos: tmpM, vel: tmpD.clone().multiplyScalar(T.arrow.speed), owner: 'enemy', dmg: T.dmg, data: { enemy: e } });
        ctx.sound.bowShot(D, ctx.pan(tmpM));
        return;
      }

      // Zielfehler: seitlicher Versatz am Ziel, größer bei Entfernung und wenn der Spieler läuft
      tmpD.subVectors(aimAt, tmpM).normalize();
      tmpR.crossVectors(tmpD, UPV).normalize();
      tmpU.crossVectors(tmpR, tmpD).normalize();
      const m = Math.abs(gauss()) * T.sigma * (P.moving ? 1.3 : 1) * warm * D;
      const a = Math.random() * Math.PI * 2;
      tmpT.copy(aimAt).addScaledVector(tmpR, Math.cos(a) * m).addScaledVector(tmpU, Math.sin(a) * m);
      const baseDir = tmpA.subVectors(tmpT, tmpM).normalize().clone();

      const pellets = T.pellets || 1;
      let dmg = 0;
      let tracers = 0;
      for (let i = 0; i < pellets; i++) {
        tmpD.copy(baseDir);
        if (pellets > 1) {
          const sa = Math.random() * Math.PI * 2;
          const sr = Math.sqrt(Math.random()) * T.spread;
          tmpD.addScaledVector(tmpR, Math.cos(sa) * sr).addScaledVector(tmpU, Math.sin(sa) * sr).normalize();
        }
        const stat = ctx.traceStatic(tmpM, tmpD, 260);
        const dHit = stat ? stat.distance : Infinity;
        const rc = rayVsSegment(tmpM, tmpD, P.a, P.b);
        const hitP = rc.dist <= P.r && rc.t < dHit;
        // Leuchtspur endet kurz vor dem Spieler, damit sie nicht die ganze Sicht füllt
        const end = tmpB.copy(tmpM).addScaledVector(tmpD, hitP ? Math.max(0, rc.t - 2) : Math.min(dHit, 160));
        if (hitP) dmg += T.dmg;
        else if (stat) ctx.fx.impact(stat.point, stat.normal, stat.object.userData.surface || 'grass', 0.7 + dHit / 40, pellets > 1);
        if (tracers < 3) {
          ctx.fx.tracer(tmpM, end, 0xffd27a);
          tracers++;
        }
      }
      ctx.sound.enemyShot(e.def.sound, D, ctx.pan(tmpM));
      if (dmg > 0) ctx.hurtPlayer(dmg, e.pos);
    }

    // ---- KI ----
    function update(dt, now) {
      const P = ctx.playerBody();
      hist.push({ t: now, x: P.center.x, y: P.center.y, z: P.center.z });
      while (hist.length > 2 && hist[1].t < now - 1.5) hist.shift();
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        const h = e.human;
        const st = h.state;
        e.hurtT += dt;

        if (e.state === 'dead') {
          e.deadT += dt;
          st.dead = clamp(e.deadT / 0.8, 0, 1);
          st.flinch = 0;
          st.kick = 0;
          h.update(dt);
          if (e.deadT > 30) h.root.position.y = -Math.min(1.2, (e.deadT - 30) * 0.6);
          if (now >= e.respawnAt && e.deadT > 32) {
            h.root.position.y = 0;
            respawn(e);
          }
          continue;
        }

        const dx = P.center.x - e.pos.x;
        const dz = P.center.z - e.pos.z;
        const dist = Math.hypot(dx, dz);
        e.lastDist = dist;
        const T = e.T;

        // Sichtlinie (alle 0,25 s neu prüfen)
        e.losT -= dt;
        if (e.losT <= 0) {
          e.losT = 0.25;
          e.los = dist < 170 && hasLOS(e, P);
        }
        const inRange = dist <= T.range;
        const facing = Math.abs(angDiff(e.yaw, Math.atan2(-dx, -dz))) < 1.7;
        const canSee = e.los && inRange;

        if (e.state === 'patrol') {
          if (canSee && (facing || e.hunt > 0 || e.hurtT < 6)) e.sightT += dt;
          else e.sightT = Math.max(0, e.sightT - dt * 0.7);
          if (e.sightT >= T.react) {
            e.state = 'engage';
            e.engageT = 0;
            e.loseT = 0;
            e.burstLeft = 0;
            e.nextShot = now + T.aimTime + 0.2;
            e.strafeT = rnd(0.5, 1.5);
            e.strafeDir = Math.random() < 0.5 ? -1 : 1;
          }
        }

        let speed = 0;
        let wantYaw = e.yaw;
        if (e.state === 'patrol') {
          st.aim = approach(st.aim, 0, dt / 0.5);
          st.draw = approach(st.draw, 0, dt * 2);
          if (e.hunt > 0 && !canSee) {
            // gehört oder getroffen: Richtung Spieler suchen
            e.hunt -= dt;
            e.offPath = true;
            speed = T.run ? T.run * 0.6 : T.speed * 1.3;
            if (dist > 6) {
              e.pos.x += (dx / dist) * speed * dt;
              e.pos.z += (dz / dist) * speed * dt;
            } else speed = 0;
            wantYaw = Math.atan2(-dx, -dz);
          } else if (e.offPath) {
            // zurück auf den Weg
            const s0 = SR.pathNearest(e.path, e.pos.x, e.pos.z);
            SR.pathPoint(e.path, s0, tmpM);
            const bx = tmpM.x - e.pos.x;
            const bz = tmpM.z - e.pos.z;
            const bd = Math.hypot(bx, bz);
            speed = T.speed * 1.2;
            if (bd < 1.2) {
              e.offPath = false;
              e.s = s0;
              speed = 0;
            } else {
              e.pos.x += (bx / bd) * speed * dt;
              e.pos.z += (bz / bd) * speed * dt;
              wantYaw = Math.atan2(-bx, -bz);
            }
          } else if (e.waitT > 0) {
            e.waitT -= dt;
          } else {
            speed = T.speed;
            e.s += e.dir * speed * dt;
            if (e.s >= e.path.length) {
              e.s = e.path.length;
              e.dir = -1;
              e.waitT = rnd(2, 5);
            } else if (e.s <= 0) {
              e.s = 0;
              e.dir = 1;
              e.waitT = rnd(1, 3);
            }
            SR.pathPoint(e.path, e.s, tmpM);
            e.path.curve.getTangentAt(clamp(e.s / e.path.length, 0, 1), tmpT);
            e.pos.set(tmpM.x, 0, tmpM.z);
            wantYaw = Math.atan2(-tmpT.x * e.dir, -tmpT.z * e.dir);
            if (e.waitT > 0) speed = 0;
          }
          if (e.hunt > 0 && canSee) e.hunt -= dt * 0.5;
        } else {
          // ---- Kampf ----
          e.engageT += dt;
          if (canSee) e.loseT = 0;
          else e.loseT += dt;
          wantYaw = Math.atan2(-dx, -dz);
          st.aim = approach(st.aim, 1, dt / T.aimTime);
          st.pitch = clamp(Math.atan2(P.center.y - 1.4, Math.max(2, dist)), -0.5, 0.6);
          e.offPath = true;

          // Bewegung: Stürmer laufen heran, alle anderen weichen seitlich aus (Scharfschützen bleiben stehen)
          if (T.charge && dist > T.stop) {
            speed = T.run || 3;
            e.pos.x += (dx / dist) * speed * dt;
            e.pos.z += (dz / dist) * speed * dt;
          } else if (!T.telegraph && !T.arrow) {
            e.strafeT -= dt;
            if (e.strafeT <= 0) {
              e.strafeT = rnd(0.8, 2.2);
              e.strafeDir = Math.random() < 0.3 ? 0 : Math.random() < 0.5 ? -1 : 1;
            }
            if (e.strafeDir !== 0 && st.aim > 0.8) {
              speed = 1.1;
              e.pos.x += (-dz / dist) * e.strafeDir * speed * dt;
              e.pos.z += (dx / dist) * e.strafeDir * speed * dt;
            }
          }

          // Schießen
          if (canSee && st.aim > 0.9) {
            if (T.arrow) {
              if (e.drawT >= 0) {
                e.drawT += dt;
                st.draw = clamp(e.drawT / T.arrow.draw, 0, 1);
                if (e.drawT >= T.arrow.draw) {
                  enemyShot(e, P, now);
                  e.drawT = -1;
                  st.draw = 0;
                  e.nextShot = now + rnd(T.pause[0], T.pause[1]);
                }
              } else if (now >= e.nextShot) e.drawT = 0;
            } else if (now >= e.nextShot) {
              if (T.telegraph) {
                // Scharfschütze: Laser-Warnung, dann Schuss
                e.telT += dt;
                h.muzzleWorld(tmpM);
                // Der Laser folgt dem Spieler, bleibt aber die letzten 0,4 s stehen: wer sich dann bewegt, wird nicht getroffen
                if (e.telT < T.telegraph - 0.4 || !e.lockPoint) e.lockPoint = (e.lockPoint || new V3()).copy(P.center);
                ctx.fx.beam(tmpM, e.lockPoint, 0xff2a2a, 0.012, 0.06);
                if (e.telT >= T.telegraph) {
                  e.telT = 0;
                  enemyShot(e, P, now);
                  e.lockPoint = null;
                  e.nextShot = now + rnd(T.pause[0], T.pause[1]);
                }
              } else {
                if (e.burstLeft <= 0) e.burstLeft = Math.round(rnd(T.burst[0], T.burst[1]));
                enemyShot(e, P, now);
                e.burstLeft--;
                e.nextShot = now + (e.burstLeft > 0 ? T.interval : rnd(T.pause[0], T.pause[1]));
              }
            }
          } else {
            e.telT = 0;
            if (e.drawT >= 0 && !canSee) {
              e.drawT = -1;
              st.draw = 0;
            }
          }
          if (e.loseT > 3) {
            e.state = 'patrol';
            e.sightT = 0;
            e.drawT = -1;
            st.draw = 0;
            e.hunt = Math.max(e.hunt, 5);
          }
        }

        // Blickrichtung weich drehen, Animation
        e.yaw += clamp(angDiff(e.yaw, wantYaw), -4.5 * dt, 4.5 * dt);
        st.speed = approach(st.speed, speed, dt * 6);
        st.kick = Math.max(0, st.kick - dt * 7);
        st.flinch = Math.max(0, st.flinch - dt * 5);
        h.root.position.set(e.pos.x, 0, e.pos.z);
        h.root.rotation.y = e.yaw;
        h.update(dt);
      }
    }

    function reset(now) {
      list.forEach((e) => {
        if (e.state === 'dead') {
          e.human.root.position.y = 0;
          respawn(e);
        } else {
          e.hp = e.maxHp;
          e.state = 'patrol';
          e.sightT = 0;
          e.hunt = 0;
          e.drawT = -1;
          e.human.state.aim = 0;
          e.human.state.draw = 0;
          place(e, false);
        }
      });
    }

    return {
      list,
      parts,
      get version() {
        return version;
      },
      update,
      damage,
      noise,
      reset,
      rayVsSegment,
    };
  };
})();
