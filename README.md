# Freiluft-Schießstand

Ein 3D-Schießstand-Spiel für den Browser (Three.js). Du stehst auf einem Betonplatz auf einem offenen
Gelände, vor dir liegt ein Tisch mit vier Waffen, rundherum stehen zwölf Mannscheiben in 12 bis 70 Metern
Entfernung.

## Spielen

`index.html` im Browser öffnen (Doppelklick reicht) und auf **Spiel starten** klicken.
Three.js wird vom CDN geladen; ohne Internet nimmt das Spiel automatisch die Kopie in `vendor/`.

Alternativ mit einem kleinen Webserver:

```bash
npx http-server -p 8080 .
# dann http://localhost:8080 öffnen
```

## Steuerung

| Taste | Aktion |
| --- | --- |
| Maus | umsehen und drehen |
| Linksklick | schießen (gedrückt halten = Dauerfeuer in der Kadenz der Waffe) |
| Rechtsklick | zielen (gedrückt halten) |
| E | Waffe vom Tisch nehmen, die du gerade anschaust (die alte Waffe kommt zurück auf den Tisch) |
| Q | Waffe zurück auf den Tisch legen |
| W A S D | auf dem Platz herumgehen |
| Pfeiltasten | drehen (Alternative zur Maus) |
| R | alle Scheiben wieder aufstellen |
| Esc | Pause |

## Regeln

- Man kann immer nur **eine** Waffe in der Hand halten.
- Alle Waffen haben **unendlich Munition**.
- **Kopftreffer**: Die Scheibe fällt sofort um.
- **Körpertreffer**: Die Scheibe fällt nach **6 Treffern** um.
- Liegen alle zwölf Scheiben, wird die Zeit angezeigt und eine neue Runde beginnt.

## Die Waffen

| Waffe | Kadenz | Besonderheit |
| --- | --- | --- |
| Mauser C96 | 923 Schuss/min | schießt am schnellsten |
| Double-Action-Revolver | 400 Schuss/min | langsamer als die C96, schneller als das G36; Trommel dreht sich |
| G36 | 286 Schuss/min | mittel schnell, Zieloptik mit Leuchtpunkt |
| KR86 | 52 Schuss/min | schießt am langsamsten, Zielfernrohr, Repetieren nach jedem Schuss |

Die Werte stehen in `js/weapons.js` (`interval` = Sekunden zwischen zwei Schüssen) und lassen sich dort leicht ändern.

## Dateien

- `index.html`, `css/style.css` – Seite, HUD und Startbildschirm
- `js/game.js` – Steuerung, Aufheben, Zielen, Schießen, Runden
- `js/weapons.js` – Waffenwerte und 3D-Modelle
- `js/targets.js` – Zielscheiben und Trefferregeln
- `js/world.js` – Gelände, Tisch, Bäume, Fahne
- `js/effects.js`, `js/audio.js`, `js/textures.js` – Effekte, Geräusche, Texturen (alles im Code erzeugt)
