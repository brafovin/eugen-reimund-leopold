// Umgebung: Himmel, Wiese, Schützenstand, Tisch, Bäume, Fahne.
(function () {
  'use strict';
  const SR = (window.SR = window.SR || {});

  const PAD_TOP = 0.1;
  const TABLE = { z: -1.15, width: 3.2, depth: 1.36, height: 0.85 };

  function mesh(geo, mat, x, y, z, opts) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    if (!opts || opts.shadow !== false) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    return m;
  }

  function skyMaterial(sunDir) {
    return new THREE.ShaderMaterial({
      uniforms: {
        top: { value: new THREE.Color(0x2f6fbf) },
        horizon: { value: new THREE.Color(0xcfe0ea) },
        bottom: { value: new THREE.Color(0x8a9a72) },
        sunDir: { value: sunDir },
      },
      vertexShader:
        'varying vec3 vDir;\n' +
        'void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir;\n' +
        'varying vec3 vDir;\n' +
        'void main(){\n' +
        '  vec3 d = normalize(vDir);\n' +
        '  float h = d.y;\n' +
        '  vec3 col = h > 0.0 ? mix(horizon, top, pow(h, 0.6)) : mix(horizon, bottom, pow(min(-h * 4.0, 1.0), 0.6));\n' +
        '  float s = max(dot(d, normalize(sunDir)), 0.0);\n' +
        '  col += vec3(1.0, 0.92, 0.75) * pow(s, 900.0) * 3.0 + vec3(1.0, 0.85, 0.6) * pow(s, 12.0) * 0.18;\n' +
        '  gl_FragColor = vec4(col, 1.0);\n' +
        '  #include <encodings_fragment>\n' +
        '}',
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
  }

  SR.buildWorld = function (scene, renderer) {
    const shootables = [];
    const sunDir = new THREE.Vector3(-0.45, 0.72, 0.55).normalize();
    const R = SR.rng(42);

    // Himmel
    const skyMat = skyMaterial(sunDir);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat);
    sky.renderOrder = -1;
    scene.add(sky);
    scene.fog = new THREE.Fog(0xcfe0ea, 140, 620);

    // Licht
    const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5d6b3c, 0.45);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.25);
    sun.position.copy(sunDir).multiplyScalar(60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -40;
    sc.right = 40;
    sc.top = 40;
    sc.bottom = -40;
    sc.near = 1;
    sc.far = 160;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);
    scene.add(sun.target);

    // Boden
    const grassTex = SR.tex.grass();
    grassTex.repeat.set(260, 260);
    const ground = mesh(
      new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, metalness: 0 }),
      0, 0, 0
    );
    ground.castShadow = false;
    ground.userData.surface = 'grass';
    scene.add(ground);
    shootables.push(ground);

    // Kiesfläche um den Stand
    const gravelTex = SR.tex.gravel();
    gravelTex.repeat.set(6, 6);
    const gravel = mesh(
      new THREE.CircleGeometry(8, 48).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: gravelTex, roughness: 1 }),
      0, 0.01, 0.4
    );
    gravel.castShadow = false;
    gravel.userData.surface = 'gravel';
    scene.add(gravel);
    shootables.push(gravel);

    // Betonplatte (der Platz, auf dem man steht)
    const concTex = SR.tex.concrete();
    concTex.repeat.set(3, 3);
    const pad = mesh(
      new THREE.BoxGeometry(7.2, PAD_TOP, 6.0),
      new THREE.MeshStandardMaterial({ map: concTex, roughness: 0.92 }),
      0, PAD_TOP / 2, 0.6
    );
    pad.userData.surface = 'concrete';
    scene.add(pad);
    shootables.push(pad);

    // Tisch
    const woodTex = SR.tex.wood([150, 104, 62], 17, 256);
    woodTex.repeat.set(2, 1);
    const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.7 });
    const steelLeg = new THREE.MeshStandardMaterial({ color: 0x3a3f3a, roughness: 0.6, metalness: 0.6 });
    const topY = PAD_TOP + TABLE.height;
    const tableGroup = new THREE.Group();
    scene.add(tableGroup);
    const top = mesh(new THREE.BoxGeometry(TABLE.width, 0.05, TABLE.depth), woodMat, 0, topY - 0.025, TABLE.z);
    tableGroup.add(top);
    const apron = mesh(new THREE.BoxGeometry(TABLE.width - 0.06, 0.12, 0.03), woodMat, 0, topY - 0.11, TABLE.z + TABLE.depth / 2 - 0.03);
    tableGroup.add(apron);
    const legGeo = new THREE.BoxGeometry(0.06, TABLE.height - 0.05, 0.06);
    [-1, 1].forEach((sx) =>
      [-1, 1].forEach((sz) => {
        tableGroup.add(
          mesh(legGeo, steelLeg, sx * (TABLE.width / 2 - 0.08), PAD_TOP + (TABLE.height - 0.05) / 2, TABLE.z + sz * (TABLE.depth / 2 - 0.08))
        );
      })
    );
    const matTex = SR.tex.rubberMat();
    const rubber = mesh(
      new THREE.BoxGeometry(TABLE.width - 0.12, 0.006, TABLE.depth - 0.12),
      new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.95 }),
      0, topY + 0.003, TABLE.z
    );
    tableGroup.add(rubber);
    tableGroup.traverse((o) => {
      if (o.isMesh) {
        o.userData.surface = 'wood';
        shootables.push(o);
      }
    });

    // Rote Fahne (auf Schießständen das Zeichen für „Es wird geschossen")
    const pole = mesh(new THREE.CylinderGeometry(0.03, 0.04, 4.2, 10), steelLeg, 3.4, 2.1 + PAD_TOP, -2.2);
    scene.add(pole);
    const flagGeo = new THREE.PlaneGeometry(1.0, 0.62, 14, 6);
    flagGeo.translate(0.5, 0, 0);
    const flagBase = flagGeo.attributes.position.array.slice();
    const flag = mesh(
      flagGeo,
      new THREE.MeshStandardMaterial({ color: 0xc8302a, roughness: 0.85, side: THREE.DoubleSide }),
      3.43, 3.85 + PAD_TOP, -2.2
    );
    flag.rotation.y = 0.6;
    scene.add(flag);

    // Hügel am Horizont
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x5f7a46, roughness: 1 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + R() * 0.5;
      const d = 420 + R() * 160;
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), hillMat);
      hill.scale.set(120 + R() * 120, 22 + R() * 30, 90 + R() * 80);
      hill.position.set(Math.sin(a) * d, -6, -Math.cos(a) * d);
      hill.rotation.y = R() * Math.PI;
      scene.add(hill);
    }

    // Bäume (instanziert für gute Leistung)
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const N = 200;
    const trunkMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.16, 0.28, 1, 7).translate(0, 0.5, 0),
      new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 }),
      N
    );
    const leafGeo = new THREE.IcosahedronGeometry(1, 1);
    const coneGeo = new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0);
    const leafMesh = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), N);
    const coneMesh = new THREE.InstancedMesh(coneGeo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), N);
    let nl = 0;
    let nc = 0;
    for (let i = 0; i < N; i++) {
      const a = R() * Math.PI * 2;
      const d = 95 + Math.pow(R(), 0.7) * 230;
      const x = Math.sin(a) * d;
      const z = -Math.cos(a) * d;
      const h = 3 + R() * 5;
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, R() * 6, 0);
      dummy.scale.set(1 + R() * 0.5, h, 1 + R() * 0.5);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);
      if (R() < 0.55) {
        const r = 2.2 + R() * 2.2;
        dummy.position.set(x, h + r * 0.55, z);
        dummy.scale.set(r, r * (1.1 + R() * 0.4), r);
        dummy.updateMatrix();
        leafMesh.setMatrixAt(nl, dummy.matrix);
        leafMesh.setColorAt(nl, col.setHSL(0.24 + R() * 0.06, 0.38 + R() * 0.2, 0.22 + R() * 0.12));
        nl++;
      } else {
        const r = 1.6 + R() * 1.4;
        dummy.position.set(x, h * 0.45, z);
        dummy.scale.set(r, h * 1.6 + R() * 4, r);
        dummy.updateMatrix();
        coneMesh.setMatrixAt(nc, dummy.matrix);
        coneMesh.setColorAt(nc, col.setHSL(0.3 + R() * 0.05, 0.35 + R() * 0.15, 0.16 + R() * 0.08));
        nc++;
      }
    }
    leafMesh.count = nl;
    coneMesh.count = nc;
    scene.add(trunkMesh, leafMesh, coneMesh);

    // Büsche
    const bushes = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }),
      70
    );
    for (let i = 0; i < 70; i++) {
      const a = R() * Math.PI * 2;
      const d = 80 + R() * 40;
      const s = 0.8 + R() * 1.4;
      dummy.position.set(Math.sin(a) * d, s * 0.35, -Math.cos(a) * d);
      dummy.rotation.set(R(), R() * 6, R());
      dummy.scale.set(s * 1.4, s * 0.8, s * 1.2);
      dummy.updateMatrix();
      bushes.setMatrixAt(i, dummy.matrix);
      bushes.setColorAt(i, col.setHSL(0.22 + R() * 0.08, 0.35 + R() * 0.2, 0.2 + R() * 0.12));
    }
    scene.add(bushes);

    // Umgebungs-Reflexionen für Metall (aus einem kleinen Himmel erzeugt)
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat));
    const envGround = new THREE.Mesh(
      new THREE.CircleGeometry(45, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x55683a })
    );
    envGround.position.y = -2;
    envScene.add(envGround);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envMap = pmrem.fromScene(envScene, 0.02, 0.1, 200).texture;
    scene.environment = envMap;
    pmrem.dispose();

    function update(t) {
      const p = flagGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = flagBase[i * 3];
        const y = flagBase[i * 3 + 1];
        p.array[i * 3 + 2] = Math.sin(x * 5.5 - t * 6 + y * 1.5) * 0.09 * x + Math.sin(x * 9 - t * 9) * 0.02 * x;
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
    };
  };
})();
