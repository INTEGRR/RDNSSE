# Trödelradar — Dorfflohmarkt Barkhausen

Navigations-PWA für den Dorfflohmarkt (13. September 2026, 10–16 Uhr):
alle Verkaufs-Höfe auf der Karte, sortiert nach Nähe, mit Live-Kompasspfeil
zum ausgewählten Stand. Läuft ohne Datenbank, deployt statisch auf Vercel.

## Features

- **Karte** (Leaflet + OpenStreetMap): alle Höfe nummeriert, eigene Position live
- **In der Nähe**: Liste nach Entfernung sortiert, mit Richtungspfeil, Distanz und Fußweg-Schätzung
- **Kompass-Navigation**: Stand antippen → großer Pfeil zeigt die Richtung
  (iOS: `webkitCompassHeading` nach Permission-Tap, Android: `deviceorientationabsolute`,
  Fallback: GPS-Bewegungsrichtung), bei < 25 m Ankunfts-Screen
- **Abhaken**: besuchte Höfe markieren (localStorage), Fortschritt im Header
- **PWA**: installierbar (Manifest), Service Worker cacht App-Shell und Karten-Kacheln —
  funktioniert im Funkloch auf dem Dorf weiter, wo man schon war

## Standdaten

`public/stands.json` — aktuell **Demo-Daten** (`"demo": true`, Banner in der App).
Echte Höfe einspielen:

1. Adressliste als Textdatei, pro Zeile: `Name | Straße Nr, PLZ Ort | Notiz`
2. `node scripts/geocode.mjs hoefe.txt` — geocodiert über OSM Nominatim und
   schreibt `public/stands.json` (setzt `demo: false`)
3. Alternativ Koordinaten direkt in die JSON eintragen (`lat`/`lng`)

Quelle der Höfe: geteilte Google-Maps-Liste „Dorfflohmarkt Barkhausen“ (46 Orte).

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
```

Hinweis: Kompass und GPS brauchen HTTPS (auf localhost erlaubt der Browser beides).

## Deployment

Vercel erkennt Vite automatisch — Repo importieren oder `dist/` statisch hosten. Fertig.
