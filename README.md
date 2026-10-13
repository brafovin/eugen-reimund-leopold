# Freiluft-Schießstand

Ein 3D-Schießstand-Spiel für den Browser (Three.js). Du stehst auf einem Betonplatz auf einem offenen
Gelände, vor dir liegt ein Tisch mit sechs Waffen, rundherum stehen zwölf Mannscheiben in 12 bis 70 Metern
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
| E | Waffe vom Tisch nehmen, die du gerade anschaust (die alte Waffe kommt zurück auf den Tisch), oder den Skin-Automaten benutzen |
| Q | Waffe zurück auf den Tisch legen |
| W A S D | auf dem Platz herumgehen (im Liegen: robben) |
| Strg | hinlegen oder aufstehen (kurz antippen) |
| Pfeiltasten | drehen (Alternative zur Maus) |
| R | alle Scheiben wieder aufstellen |
| Esc | Pause |

## Regeln

- Man kann immer nur **eine** Waffe in der Hand halten.
- Alle Waffen haben **unendlich Munition**.
- **Kopftreffer**: Die Scheibe fällt sofort um.
- **Körpertreffer**: Die Scheibe fällt nach **6 Treffern** um.
- Umgefallene Scheiben stehen nach **5 Minuten** von selbst wieder auf (Anzeige oben links).
- Liegen alle zwölf Scheiben, wird die Zeit angezeigt und eine neue Runde beginnt.
- Im Liegen streut die Waffe nur halb so stark und springt weniger hoch. Waffen nehmen geht nur im Stehen.

## Taler und Skin-Automat

Jeder Treffer macht Schaden, und der Schaden wird dir als **Taler** gutgeschrieben (oben rechts):

| Treffer | Taler |
| --- | --- |
| Körpertreffer | 10 (Schrot anteilig: Birdshot-Kugel ≈ 3,4, Treewhacker-Kugel 10) |
| Kopftreffer | 60 |
| Scheibe umgeworfen | +20 |
| Weitschuss-Bonus | alles × (1 + Entfernung / 50 m), z. B. 70 m = 2,4-fach |

Hinten links auf dem Platz steht der **Skin-Automat**. Hinschauen und **E** drücken. Ein Dreh kostet 100 Taler.

| Ergebnis | Chance |
| --- | --- |
| Neuer Skin (3 gleiche Waffen) | 40 % |
| 250 Taler | 5 % |
| 100 Taler | 8 % |
| 50 Taler | 12 % |
| Niete | 35 % |

Bei einem Skin-Gewinn gibt es immer einen Skin, den du noch nicht hast. Die Seltenheit wird so ausgelost:
Gewöhnlich 50 %, Selten 30 %, Episch 15 %, Legendär 5 %. Im Automaten kannst du unter „Meine Skins“
jeden gewonnenen Skin ausrüsten. Geld und Skins werden im Browser gespeichert.

| Waffe | Gewöhnlich | Selten | Episch | Legendär |
| --- | --- | --- | --- | --- |
| Mauser C96 | Kirschholz | Nickel | Damaszener | Gold & Elfenbein |
| Revolver | Hirschhorn | Schwarzchrom | Silbergravur | Rosé-Gold |
| G36 | Wüste | Flecktarn | Arktis | Neon |
| KR86 | Birke | Waldtarn | Ebenholz | Königsgold |
| Birdshot | Jagdgrün | Jagdgravur | Bernstein | Platin |
| SG-21 Treewhacker | Signal-Orange | Holzfäller | Moos | Lava |

Die Skins stehen in `js/skins.js`, der Automat in `js/slot.js`.

## Die Waffen

| Waffe | Kadenz | Besonderheit |
| --- | --- | --- |
| Mauser C96 | 923 Schuss/min | schießt am schnellsten |
| Double-Action-Revolver | 400 Schuss/min | langsamer als die C96, schneller als das G36; Trommel dreht sich |
| G36 | 286 Schuss/min | mittel schnell, Zieloptik mit Leuchtpunkt |
| KR86 | 52 Schuss/min | schießt am langsamsten, Zielfernrohr, Repetieren nach jedem Schuss |
| Birdshot | 133 Schuss/min | Bockflinte mit 14 kleinen Schrotkugeln und enger Garbe – für **weite** Ziele |
| SG-21 Treewhacker | 75 Schuss/min | Pumpgun mit 12 groben Schrotkugeln und breiter Garbe – für **nahe** Ziele |

### Schrotflinten

Jeder Schuss verschießt viele Schrotkugeln. Der gestrichelte Kreis im Fadenkreuz zeigt, wie weit die Garbe
auseinandergeht. Trifft eine Kugel den Kopf, fällt die Scheibe um. Am Körper zählt bei der Treewhacker jede
Kugel als ein Treffer, beim feinen Vogelschrot der Birdshot zählen etwa drei Kugeln als ein Treffer.
Auf 12 m wirft die Treewhacker eine Scheibe meist mit einem Schuss um, auf 50 m trifft sie kaum noch.
Die Birdshot hält die Kugeln enger zusammen und trifft auch auf große Entfernung noch den Kopf.

Die Wartezeit bis zum Aufstehen steht in `js/targets.js` (`SR.TARGET_RESPAWN`, in Sekunden).
Die Waffenwerte stehen in `js/weapons.js` (`interval` = Sekunden zwischen zwei Schüssen) und lassen sich dort leicht ändern.

## Dateien

- `index.html`, `css/style.css` – Seite, HUD und Startbildschirm
- `js/game.js` – Steuerung, Aufheben, Zielen, Schießen, Runden
- `js/weapons.js` – Waffenwerte und 3D-Modelle
- `js/skins.js` – die 24 Waffen-Skins
- `js/slot.js` – Skin-Automat (3D-Modell und Bedienfeld)
- `js/targets.js` – Zielscheiben und Trefferregeln
- `js/world.js` – Gelände, Tisch, Bäume, Fahne
- `js/effects.js`, `js/audio.js`, `js/textures.js` – Effekte, Geräusche, Texturen (alles im Code erzeugt)
