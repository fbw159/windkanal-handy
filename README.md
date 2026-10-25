# Taschen-Windkanal

Windkanal fürs Handy: **https://fbw159.github.io/windkanal-handy/**

Ein Fingertipp, und der Wind weht um einen Käfer, einen Hai, eine Rakete oder eine selbst gemalte Form. Zu sehen sind Rauchfäden, Geschwindigkeit, Druck oder Wirbel, dazu der Luftwiderstandsbeiwert c<sub>W</sub> und der Auftriebsbeiwert c<sub>A</sub>. Über fünfzig Beispielformen sind eingebaut, nichts muss geladen werden. Läuft auf iPhone (Safari) und Android (Chrome), auch als App auf dem Startbildschirm und ohne Netz.

## Bedienung

- Form antippen, Wind (1–60 m/s) am Schieber einstellen. Frei schwebende Formen lassen sich neigen (−30° … 30°).
- Knopf links unten wechselt die Darstellung: Rauch, Tempo, Druck, Wirbel.
- „Selber malen“: mit dem Finger ins Bild malen, dann „Fertig“.
- „?“ erklärt alles und stellt das Gitter ein (grob / normal / fein). Läuft das normale Gitter auf dem Gerät zu langsam, schaltet die App nach drei Sekunden selbst auf grob.
- „3D“ erscheint nur auf Handys, die WebGPU können, und öffnet die große Fassung mit einem passenden 3D-Modell.

## Was dahinter steckt

- Ebene Strömung (ein Querschnitt) mit der Lattice-Boltzmann-Methode (D2Q9), gerechnet in WebGL2 auf der Grafikkarte des Handys. Der Rechenkern ist ein Fragment-Shader mit vier Gleitkomma-Zieltexturen; die Verteilungen liegen in Texturen, jeder Zeitschritt ist ein Durchlauf über das Gitter.
- Stoß: regularisiertes BGK (nur der Spannungsanteil des Nichtgleichgewichts bleibt), Wirbelviskosität nach Smagorinsky (C = 0,12) für Wirbel, die kleiner als eine Zelle sind. Wirkliche Zähigkeit der Luft; das Gitter löst Reynoldszahlen bis etwa 30 je Zelle der größten Modellabmessung auf, höchstens 6000. Darüber bleibt die Rechnung zäher als die Wirklichkeit, und im Bild steht „Gitter: …“.
- Wand: Rückprall an der halben Zelle, Kraft aus dem Impulsaustausch (ohne den Ruhedruck, damit Räder auf dem Boden keine Scheinkraft erzeugen). Eingeklemmte Richtungspaare (Spalt von einer Zelle) werden gemittelt.
- Einlass mit vorgegebenem Wind ein Stück links außerhalb des Bilds, Auslass mit vorgegebenem Druck. Dämpfungszonen an Einlass, Auslass und Decke (bei freien Formen auch am Boden) und eine sehr schwache Dichtedämpfung im ganzen Kanal schlucken Druckwellen, die sonst endlos hin und her liefen. Der Körper wird beim Start über 400 Schritte von durchlässig auf dicht gefahren (teilweiser Rückprall), damit kein Druckstoß entsteht.
- Bodenformen (Fahrzeuge, Gebäude) stehen auf einem haftenden Boden, freie Formen schweben zwischen glatten Wänden.
- Rauch: mitgeführter Farbstoff, am Einlass in Fäden eingespeist.
- Die Beiwerte sind auf die Stirnhöhe bezogen (beim Tragflügel auf die Flügeltiefe) und gelten für den Querschnitt, nicht für den ganzen Körper. Sie zeigen Unterschiede zwischen Formen gut, sind aber keine Messwerte: In der Ebene fehlt die dritte Richtung, in der die Luft ausweichen kann, und der Kanal ist schmal.

Prüfung (grobes Gitter, ohne Grafikkarte gerechnet, deshalb nur bis 3000 Schritte): Zylinder bei Re 100, Versperrung 16 % → c<sub>W</sub> 1,46 (Messwert frei 1,33; im engen Kanal etwas höher). Bei der Reynoldszahl des Gitters (1000–3000): Kreis ≈ 1,0, Quadrat ≈ 1,9, Platte quer ≈ 1,4 (noch fallend), Tropfen ≈ 0,8–1,0, Käfer ≈ 1,5 mit Auftrieb ≈ 1,6, Tragflügel 0° (auf die Tiefe bezogen) 0,09. Zweidimensionale Rechnungen mit laminarer Grenzschicht geben für schlanke Körper zu viel Widerstand (Ablösung an der dicksten Stelle, zusammenhängende Wirbel) und für stumpfe eher zu wenig; die Rangfolge Platte > Quadrat > Kreis stimmt, der Tropfen bleibt hinter seinem Ruf. Die Dämpfung im Kanal ändert die Beiwerte nicht (Kreis mit/ohne: 1,07/1,10).

## Aufbau

- `src/` – Quellen: `00_util.js` (Hilfen), `10_shapes.js` (Formen als SVG-Pfade in einem Kasten 200 × 100), `20_gl.js` (WebGL-Rechenkern und Shader), `30_app.js` (Bedienung), `page.html`, `style.css`, `sw.js` (Vorrat für die Nutzung ohne Netz), `luts.txt` (Farbtabellen).
- Veröffentlicht wird der Zweig `gh-pages` (GitHub Pages schaltet sich bei diesem Zweignamen von selbst ein). Nach Änderungen also `git push origin main main:gh-pages`.
- `python3 build.py` baut daraus `index.html` und `sw.js`. Die Seite ist eine einzige Datei ohne Bibliotheken und ohne Server; für die App auf dem Startbildschirm kommen Manifest, Symbole und der Service Worker dazu.
- `test/` – Prüfskripte mit Playwright (headless, ohne Grafikkarte langsam): `cd.py` (Beiwert einer Form), `ft.py` (Kraftverlauf), `long.py` (lange Läufe), `sweep.py` (alle Formen), `vis.py` (Bilder der vier Darstellungen), `pt.py`/`rho.py` (Druck und Dichte im Kanal), `sheet.py` (Übersicht aller Formen), `icons.py` (App-Symbole).
- Prüfschnittstelle im Browser: `window.WH` (Formen setzen, Schritte treiben, Kräfte lesen); Startparameter `?form=kaefer&gitter=grob`.

Die große Fassung mit 3D-Modellen (WebGPU): [fbw159.github.io/windkanal](https://fbw159.github.io/windkanal/).
