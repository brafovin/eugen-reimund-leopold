// Feldwege, auf denen die Gegner patrouillieren. Koordinaten in Metern (x nach rechts, z nach hinten; der Spieler steht bei 0/0,
// die Scheiben liegen vor ihm bei negativem z). Jeder Weg ist eine Linie aus Wegpunkten.
(function () {
  'use strict';
  const SR = (window.SR = window.SR || {});

  SR.PATHS = [
    { id: 'wald', name: 'Waldweg', width: 3.2, pts: [[-125, -100], [-88, -74], [-58, -50], [-42, -24]] },
    { id: 'handel', name: 'Handelsroute', width: 3.6, pts: [[112, -122], [78, -88], [52, -58], [38, -34]] },
    { id: 'feld', name: 'Feldweg', width: 3.0, pts: [[135, 62], [96, 46], [66, 30], [48, 16]] },
    { id: 'grat', name: 'Höhenpfad', width: 2.6, pts: [[-70, -96], [-34, -91], [2, -99], [36, -94], [70, -100]] },
  ];

  // Abstand eines Punktes zum nächsten Weg (für Bäume, Gras usw.: nichts auf den Weg setzen)
  SR.pathDistance = function (x, z) {
    let best = Infinity;
    SR.PATHS.forEach((p) => {
      for (let i = 0; i < p.pts.length - 1; i++) {
        const ax = p.pts[i][0];
        const az = p.pts[i][1];
        const bx = p.pts[i + 1][0];
        const bz = p.pts[i + 1][1];
        const dx = bx - ax;
        const dz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
        best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)) - p.width / 2);
      }
    });
    return best;
  };
})();
