# Taschen-Windkanal

Windkanal fürs Handy: **https://fbw159.github.io/windkanal-handy/**

Ein Fingertipp, und der Wind weht um einen Käfer, einen Hai, eine Rakete oder eine selbst gemalte Form. Zu sehen sind Rauchfäden, Geschwindigkeit, Druck oder Wirbel, dazu der Luftwiderstandsbeiwert c<sub>W</sub> und der Auftriebsbeiwert c<sub>A</sub>. Über fünfzig Beispielformen sind eingebaut, nichts muss geladen werden. Läuft auf iPhone (Safari) und Android (Chrome), auch als App auf dem Startbildschirm und ohne Netz.

## Bedienung

- Form antippen, Wind (1–60 m/s) am Schieber einstellen. Frei schwebende Formen lassen sich neigen (−30° … 30°).
- Knopf links unten wechselt die Darstellung: Rauch, Tempo, Druck, Wirbel.
- „Selber malen“: mit dem Finger ins Bild malen, dann „Fertig“.
- „?“ erklärt alles und stellt das Gitter ein (grob / normal / fein). Läuft das normale Gitter auf dem Gerät zu langsam, schaltet die App nach drei Sekunden selbst auf grob.

## Was dahinter steckt

- Ebene Strömung (ein Querschnitt) mit der Lattice-Boltzmann-Methode (D2Q9), gerechnet in WebGL2 auf der Grafikkarte des Handys. Der Rechenkern ist ein Fragment-Shader mit vier Gleitkomma-Zieltexturen; die Verteilungen liegen in Texturen, jeder Zeitschritt ist ein Durchlauf über das Gitter.
- Stoß: regularisiertes BGK (nur der Spannungsanteil des Nichtgleichgewichts bleibt), Wirbelviskosität nach Smagorinsky (C = 0,12) für Wirbel, die kleiner als eine Zelle sind. Wirkliche Zähigkeit der Luft; das Gitter löst Reynoldszahlen bis etwa 30 je Zelle der größten Modellabmessung auf, höchstens 6000. Darüber bleibt die Rechnung zäher als die Wirklichkeit, und im Bild steht „Gitter: …“.
- Wand an der echten Stelle: Für jede Verbindung zwischen einer freien und einer festen Zelle wird am Umriss der Form abgetastet, wo genau die Wand liegt (auf 1/256 Zelle), und der Rückprall danach interpoliert (Bouzidi). Kraft aus dem Impulsaustausch, ohne den Ruhedruck (sonst drückt er auf den offenen Radaufstand). Eingeklemmte Richtungspaare (Spalt von einer Zelle) werden gemittelt. Selbst gemalte Formen haben die Wand auf der halben Zelle.
- Wandgesetz bei hoher Reynoldszahl: Die dünne turbulente Grenzschicht eines Autos oder Flugzeugs (Millimeter) kann kein Handygitter auflösen; eine haftende Wand bremst die Wandzelle dann viel stärker, als die wirkliche Wandschubspannung es täte, die Strömung löst an jeder Rundung ab. Deshalb bewegt sich die Wand bei turbulenter Reynoldszahl (Umschlag 2·10⁵ bis 6·10⁵, Anzeige „laminar / Umschlag / turbulent“) rechnerisch so weit mit der Strömung mit, dass der Impulsaustausch gerade die Schubspannung des logarithmischen Wandgesetzes ergibt. Dreht sich die Oberfläche stärker als etwa 30° vom Wind weg (Zylinder hinter 120°, steiles Heck, Kanten), löst auch die turbulente Grenzschicht ab, und die Wand wird dort wieder haftend. Kleine Dinge (Ei, Korken, Tasse) bleiben laminar.
- Einlass mit vorgegebenem Wind ein Stück links außerhalb des Bilds, Auslass mit vorgegebenem Druck. Dämpfungszonen (Einlass: nur die Geschwindigkeit; Auslass und Decke, bei freien Formen auch Boden: die Dichte) und eine sehr schwache Dichtedämpfung auf den Kanalmittelwert schlucken Druckwellen, die sonst endlos hin und her liefen. Der Körper wird beim Start über 400 Schritte von durchlässig auf dicht gefahren (teilweiser Rückprall), damit kein Druckstoß entsteht.
- Boden: Gebäude stehen auf haftendem Boden; bei Fahrzeugen bewegt sich die Straße mit der Luft, der Boden ist glatt. Freie Formen schweben zwischen glatten Wänden.
- Rauch: mitgeführter Farbstoff, am Einlass in Fäden eingespeist.
- Die Beiwerte sind auf die Stirnhöhe bezogen (beim Tragflügel auf die Flügeltiefe) und gelten für den Querschnitt, nicht für den ganzen Körper. Sie zeigen Unterschiede zwischen Formen gut, sind aber keine Messwerte: In der Ebene fehlt die dritte Richtung, in der die Luft ausweichen kann, und der Kanal ist schmal.

## Prüfung

Fälle mit bekannter Lösung (`test/bench.py`, laminar, ohne Wirbelviskosität, ohne Grafikkarte gerechnet):

| Fall | Ergebnis | Soll |
|---|---|---|
| Rohrströmung zwischen haftenden Wänden (Parabel, Druckabfall) | Profilfehler 0,05 %, Druckgefälle +0,4 % | – |
| Zylinder im Kanal, Re 20, stationär (Schäfer/Turek 2D-1, 20 Zellen Durchmesser) | c<sub>W</sub> 5,74, c<sub>A</sub> 0,015, Δp 2,915 | 5,57–5,59 / 0,0104–0,0110 / 2,93–2,94 |
| Zylinder im Kanal, Re 100, Wirbelstraße (Schäfer/Turek 2D-2) | c<sub>W,max</sub> 3,29, c<sub>A,max</sub> 0,86, Strouhal 0,297 | 3,22–3,24 / 0,99–1,01 / 0,295–0,305 |

Beispielformen (grobes Gitter, 3000 Schritte, Mittel über das letzte Drittel): __BEISPIELE__

## Aufbau

- `src/` – Quellen: `00_util.js` (Hilfen), `10_shapes.js` (Formen als SVG-Pfade in einem Kasten 200 × 100), `20_gl.js` (WebGL-Rechenkern und Shader), `30_app.js` (Bedienung), `page.html`, `style.css`, `sw.js` (Vorrat für die Nutzung ohne Netz), `luts.txt` (Farbtabellen).
- Veröffentlicht wird der Zweig `gh-pages` (GitHub Pages schaltet sich bei diesem Zweignamen von selbst ein). Nach Änderungen also `git push origin main main:gh-pages`.
- `python3 build.py` baut daraus `index.html` und `sw.js`. Die Seite ist eine einzige Datei ohne Bibliotheken und ohne Server; für die App auf dem Startbildschirm kommen Manifest, Symbole und der Service Worker dazu.
- `test/` – Prüfskripte mit Playwright (headless, ohne Grafikkarte langsam): `bench.py` (Fälle mit bekannter Lösung), `cd.py` (Beiwert einer Form), `ft.py` (Kraftverlauf), `long.py` (lange Läufe mehrerer Formen), `sweep.py` (alle Formen), `vis.py` (Bilder der vier Darstellungen), `pt.py`/`rho.py` (Druck und Dichte im Kanal), `sheet.py` (Übersicht aller Formen), `icons.py` (App-Symbole).
- Prüfschnittstelle im Browser: `window.WH` (Formen setzen, Schritte treiben, Kräfte lesen, eigenes Gitter und eigene Maske mit Innen-Test, Werte überschreiben, Felder lesen); Startparameter `?form=kaefer&gitter=grob`, nur zum Prüfen `&turb=0/1`, `&remax=`, `&sg=`, `&sw=`, `&sep=`, `&smax=`.

Die große Fassung mit 3D-Modellen (WebGPU): [fbw159.github.io/windkanal](https://fbw159.github.io/windkanal/).
