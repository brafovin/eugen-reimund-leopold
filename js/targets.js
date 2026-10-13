// Zielscheiben (Mannscheiben) rund um den Stand.
// Kopftreffer: fällt sofort um. Körpertreffer: fällt nach 6 Treffern um.
(function () {
  'use strict';
  const SR = (window.SR = window.SR || {});

  const BODY_HITS_NEEDED = 6;
  SR.BODY_HITS_NEEDED = BODY_HITS_NEEDED;

  // [Richtung in Grad (0 = geradeaus, im Uhrzeigersinn), Entfernung in Metern]
  const LAYOUT = [
    [0, 12],
    [-28, 22],
    [24, 30],
    [6, 55],
    [62, 16],
    [100, 35],
    [140, 22],
    [180, 48],
    [220, 14],
    [258, 28],
    [298, 70],
    [332, 40],
  ];

  const BODY = [
    ['M', -0.29, 0],
    ['L', 0.29, 0],
    ['L', 0.29, 0.5],
    ['Q', 0.29, 0.69, 0.13, 0.735],
    ['L', 0.075, 0.758],
    ['L', 0.062, 0.8],
    ['L', -0.062, 0.8],
    ['L', -0.075, 0.758],
    ['L', -0.13, 0.735],
    ['Q', -0.29, 0.69, -0.29, 0.5],
  ];
  const HEAD = { x: 0, y: 0.935, r: 0.135 };
  const BOARD_DEPTH = 0.018;

  function trace(p, X, Y) {
    BODY.forEach((c) => {
      if (c[0] === 'M') p.moveTo(X(c[1]), Y(c[2]));
      else if (c[0] === 'L') p.lineTo(X(c[1]), Y(c[2]));
      else p.quadraticCurveTo(X(c[1]), Y(c[2]), X(c[3]), Y(c[4]));
    });
    p.closePath();
  }

  let shared = null;
  function getShared() {
    if (shared) return shared;
    const id = (v) => v;
    const bodyShape = new THREE.Shape();
    trace(bodyShape, id, id);
    const headShape = new THREE.Shape();
    headShape.absarc(HEAD.x, HEAD.y, HEAD.r, 0, Math.PI * 2, false);
    const ext = { depth: BOARD_DEPTH, bevelEnabled: false, curveSegments: 14 };

    const tex = SR.tex.target((g, X, Y) => trace(g, X, Y), HEAD);
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
    const edge = new THREE.MeshStandardMaterial({ color: 0x8d7449, roughness: 1 });

    // Einschussloch: dunkle Mitte, ausgefranster heller Rand
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(245,232,200,0.9)';
    g.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 22 + (i % 2 ? 6 : 0) + Math.random() * 4;
      g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    g.fill();
    g.fillStyle = '#0e0b08';
    g.beginPath();
    g.arc(32, 32, 15, 0, Math.PI * 2);
    g.fill();
    const holeTex = new THREE.CanvasTexture(c);
    holeTex.encoding = THREE.sRGBEncoding;

    shared = {
      bodyGeo: new THREE.ExtrudeGeometry(bodyShape, ext),
      headGeo: new THREE.ExtrudeGeometry(headShape, ext),
      mats: [face, edge],
      wood: new THREE.MeshStandardMaterial({ map: SR.tex.wood([120, 92, 60], 21, 128), roughness: 0.9 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x45494a, roughness: 0.6, metalness: 0.7 }),
      holeGeo: new THREE.PlaneGeometry(0.02, 0.02),
      holeMat: new THREE.MeshBasicMaterial({
        map: holeTex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    };
    return shared;
  }

  function part(mesh, target, kind, surface) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.target = target;
    mesh.userData.part = kind;
    mesh.userData.surface = surface;
    return mesh;
  }

  class Target {
    constructor(scene, angleDeg, dist, index) {
      const S = getShared();
      this.index = index;
      this.dist = dist;
      this.state = 'up';
      this.angle = 0;
      this.vel = 0;
      this.kick = 0;
      this.hits = 0;
      this.holes = [];
      this.parts = [];
      this.landed = false;

      const a = THREE.MathUtils.degToRad(angleDeg);
      const root = (this.root = new THREE.Group());
      root.position.set(Math.sin(a) * dist, 0, -Math.cos(a) * dist);
      scene.add(root);
      root.lookAt(0, 0, 0);

      const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.36), S.steel);
      base.position.set(0, 0.025, -0.02);
      root.add(part(base, this, 'frame', 'steel'));
      this.parts.push(base);

      const pivot = (this.pivot = new THREE.Group());
      pivot.position.set(0, 0.05, 0);
      root.add(pivot);
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 10).rotateZ(Math.PI / 2), S.steel);
      hinge.position.set(0, 0.0, -0.035);
      pivot.add(hinge);

      [-0.2, 0.2].forEach((x) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.9, 0.04), S.wood);
        leg.position.set(x, 0.45, -0.035);
        pivot.add(part(leg, this, 'frame', 'wood'));
        this.parts.push(leg);
      });
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.03), S.wood);
      bar.position.set(0, 0.87, -0.045);
      pivot.add(part(bar, this, 'frame', 'wood'));
      this.parts.push(bar);

      const board = (this.board = new THREE.Group());
      board.position.set(0, 0.85, 0);
      pivot.add(board);
      const body = new THREE.Mesh(S.bodyGeo, S.mats);
      board.add(part(body, this, 'body', 'target'));
      const head = new THREE.Mesh(S.headGeo, S.mats);
      board.add(part(head, this, 'head', 'target'));
      this.parts.push(body, head);

      // Entfernungsschild
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 0.04), S.wood);
      post.position.set(0.85, 0.275, 0);
      root.add(part(post, this, 'frame', 'wood'));
      this.parts.push(post);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.21),
        new THREE.MeshStandardMaterial({ map: SR.tex.label(dist + ' m', { w: 256, h: 128 }), roughness: 0.9 })
      );
      sign.position.set(0.85, 0.6, 0.025);
      root.add(part(sign, this, 'frame', 'wood'));
      this.parts.push(sign);
    }

    // Liefert das Ergebnis des Treffers oder null, wenn die Scheibe schon liegt.
    hit(kind) {
      if (this.state !== 'up') return null;
      if (kind === 'head') {
        this.knockDown(3.4);
        return { type: 'head' };
      }
      if (kind === 'body') {
        this.hits++;
        if (this.hits >= BODY_HITS_NEEDED) {
          this.knockDown(2.4);
          return { type: 'bodyDown', hits: this.hits };
        }
        this.kick = Math.min(0.12, this.kick + 0.07);
        return { type: 'body', hits: this.hits };
      }
      return null;
    }

    knockDown(impulse) {
      this.state = 'falling';
      this.vel = impulse;
    }

    addHole(hit, radius) {
      const n = hit.face ? hit.face.normal : null;
      if (!n || Math.abs(n.z) < 0.5) return;
      const local = this.board.worldToLocal(hit.point.clone());
      const S = getShared();
      const h = new THREE.Mesh(S.holeGeo, S.holeMat);
      h.position.copy(local);
      h.position.z = n.z > 0 ? BOARD_DEPTH + 0.0008 : -0.0008;
      if (n.z < 0) h.rotation.y = Math.PI;
      h.rotation.z = Math.random() * Math.PI;
      h.scale.setScalar(radius / 0.0047);
      this.board.add(h);
      this.holes.push(h);
      if (this.holes.length > 60) this.board.remove(this.holes.shift());
    }

    reset() {
      if (this.state === 'up' && this.hits === 0 && this.holes.length === 0) return;
      this.holes.forEach((h) => this.board.remove(h));
      this.holes = [];
      this.hits = 0;
      if (this.state === 'up') return;
      this.state = 'rising';
      this.riseT = 0;
      this.startAngle = this.angle;
      SR.sound.rise();
    }

    get standing() {
      return this.state === 'up';
    }

    update(dt) {
      const REST = Math.PI / 2 - 0.035;
      if (this.state === 'falling') {
        this.vel += (16 * Math.sin(this.angle) + 2.5) * dt;
        this.angle += this.vel * dt;
        if (this.angle >= REST) {
          this.angle = REST;
          if (this.vel > 1.4) {
            if (!this.landed) SR.sound.fall(this.dist);
            this.landed = true;
            this.vel = -this.vel * 0.25;
          } else {
            this.vel = 0;
            this.state = 'down';
          }
        }
      } else if (this.state === 'rising') {
        this.riseT += dt / 0.9;
        const k = Math.min(1, this.riseT);
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const e = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
        this.angle = this.startAngle * (1 - e);
        if (k >= 1) {
          this.angle = 0;
          this.state = 'up';
          this.landed = false;
        }
      }
      this.kick *= Math.exp(-dt * 9);
      this.pivot.rotation.x = -(this.angle + this.kick);
    }
  }

  SR.createTargets = function (scene) {
    return LAYOUT.map((l, i) => new Target(scene, l[0], l[1], i));
  };
})();
