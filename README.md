# Freiluft-Schießstand

Ein 3D-Schießstand-Spiel für den Browser (Three.js). Du stehst auf einem Betonplatz auf einem offenen
Gelände. Vor dir liegt ein Tisch mit Waffen (plus einer Geheimwaffe, die man erst gewinnen muss), rechts hängt eine
Waffenwand mit weiteren Waffen. Rundherum stehen zwölf Mannscheiben in 12 bis 70 Metern Entfernung, einige fahren auf
Schienen hin und her. Auf Feldwegen laufen Gegner mit Waffen und schießen auf dich.

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
| Linksklick | schießen (gedrückt halten = Dauerfeuer in der Kadenz der Waffe). **Bogen:** gedrückt halten = spannen, loslassen = schießen |
| Rechtsklick | zielen (gedrückt halten) |
| E | Waffe vom Tisch oder von der Waffenwand nehmen, die du gerade anschaust (die alte Waffe kommt zurück), oder den Skin-Automaten benutzen |
| Q | Waffe zurücklegen (an ihren Platz auf Tisch oder Wand) |
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

## Gegner, Lebensleiste und bewegliche Ziele

- **Lebensleiste** unten in der Mitte (100 Leben). Wirst du getroffen, blitzt der Bildschirmrand rot auf, ein roter Pfeil zeigt,
  woher geschossen wurde. Nach 6 Sekunden ohne Treffer wachsen die Leben langsam nach. Bei 0 fällst du um und stehst nach
  ein paar Sekunden wieder am Schießstand auf (die Gegner sind dann zurückgesetzt, dein Geld bleibt).
- **Gegner** sind Menschen mit den Waffen aus dem Spiel (nie mit der Geheimwaffe). Sie laufen auf vier Feldwegen
  (Waldweg, Handelsroute, Feldweg, Höhenpfad), entdecken dich in Reichweite ihrer Waffe, zielen und schießen. Über
  getroffenen Gegnern erscheint eine Lebensleiste.
  - **Gangster (C96)**: schnelle Salven, mittlere Reichweite
  - **Cowboy (Revolver)**: langsame, kräftige Schüsse
  - **Soldat (G36)**: Salven, große Reichweite
  - **Scharfschütze (KR86)**: ein roter Laser warnt kurz vor dem Schuss, bewegen hilft
  - **Jäger (Birdshot)**: Schrotgarbe auf mittlere Entfernung
  - **Holzfäller (SG-21 Treewhacker)**: rennt auf dich zu und schießt aus der Nähe
  - **Bogenschütze**: Pfeile mit sichtbarer Flugbahn, man kann ausweichen
  - **Bandit (UZ-9)**: rennt heran, lange Feuerstöße
  - **Rancher (Büffeljäger)**: genaue Einzelschüsse aus großer Entfernung
- Zu Beginn eines Kampfes zielen Gegner schlecht, und wer läuft oder liegt, wird seltener getroffen.
- **Taler für Gegner**: wie bei Scheiben (Körper 35 bis 45, Kopf 50, Phantom-X Kopf 100) plus 100 Taler für jeden besiegten
  Gegner. Besiegte Gegner stehen nach etwa 45 Sekunden wieder auf dem Weg.
- **Bewegliche Ziele**: sechs der zwölf Scheiben fahren auf Schienen hin und her.

## Taler und Skin-Automat

Jeder Treffer bringt **Taler** (oben rechts):

| Treffer | Taler |
| --- | --- |
| Kopftreffer | 50 (mit der Phantom-X: 100) |
| Körpertreffer | zufällig 35 bis 45 (feiner Vogelschrot der Birdshot zählt anteilig, etwa 3 Kugeln = 1 Treffer) |

Hinten links auf dem Platz steht der **Skin-Automat**. Hinschauen und **E** drücken. Ein Dreh kostet 100 Taler.

| Ergebnis | Chance |
| --- | --- |
| Geheimwaffe Phantom-X (3 Geheim-Symbole) | 4,99 % |
| Geheim-Skin „Galaxie“ | 0,99 % |
| Geheim-Skin „Regenbogen“ | 0,99 % |
| Geheim-Skin „Diamant“ | 0,99 % |
| Neuer Skin (3 gleiche Waffen) | 40 % |
| 250 Taler | 5 % |
| 100 Taler | 8 % |
| 50 Taler | 12 % |
| Niete | 27,04 % |

Bei einem normalen Skin-Gewinn gibt es immer einen Skin, den du noch nicht hast. Die Seltenheit wird so ausgelost:
Gewöhnlich 50 %, Selten 30 %, Episch 15 %, Legendär 5 %. Gewinnst du die Geheimwaffe oder einen Geheim-Skin
ein zweites Mal, gibt es stattdessen 500 bzw. 250 Taler. Im Automaten kannst du unter „Meine Skins“ jeden
gewonnenen Skin ausrüsten. Geld, Skins und die Geheimwaffe werden im Browser gespeichert.

### Geheimwaffe: Phantom-X

Ein Energiegewehr, das es **nur am Skin-Automaten** gibt. Bis du es gewonnen hast, steht auf dem Tisch nur „? ? ?“.
Danach liegt es ganz rechts auf dem Tisch.

- 600 Schuss/min, schießt einen leuchtenden Energiestrahl, keine Streuung beim Zielen
- ein Kopfschuss bringt **100 Taler** (statt 50)
- jeder Körpertreffer zählt doppelt: 3 Treffer werfen eine Scheibe um
- Holo-Visier mit Leuchtpunkt
- drei Geheim-Skins: Galaxie, Regenbogen, Diamant (je 0,99 % pro Dreh)

| Waffe | Gewöhnlich | Selten | Episch | Legendär |
| --- | --- | --- | --- | --- |
| Mauser C96 | Kirschholz | Nickel | Damaszener | Gold & Elfenbein |
| Revolver | Hirschhorn | Schwarzchrom | Silbergravur | Rosé-Gold |
| G36 | Wüste | Flecktarn | Arktis | Neon |
| KR86 | Birke | Waldtarn | Ebenholz | Königsgold |
| Birdshot | Jagdgrün | Jagdgravur | Bernstein | Platin |
| SG-21 Treewhacker | Signal-Orange | Holzfäller | Moos | Lava |
| Phantom-X (geheim) | – | – | – | Galaxie, Regenbogen, Diamant (Seltenheit „Geheim“) |

Die Skins stehen in `js/skins.js`, der Automat in `js/slot.js`.

## Die Waffen

| Waffe | Kadenz | Besonderheit |
| --- | --- | --- |
| Mauser C96 | 545 Schuss/min | schnelle Pistole, aber langsamer als UZ-9 und Sägewerk MG |
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
