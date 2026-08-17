# FELDHERR — wissenschaftliche Schach-Positionsanalyse

Ein Analyse-Tool für Schachstellungen und ganze Partien, das zwei Fragen sichtbar macht,
die klassische Engines nur implizit beantworten:

1. **Wer beherrscht welches Feld?** — eine Kontroll-Heatmap über das ganze Brett
2. **Wer deckt wen?** — das Deckungs- und Angriffsnetz jeder einzelnen Figur

Läuft komplett ohne Datenbank und deployt mit einem Klick auf Vercel.

## Features

### Kontroll-Heatmap („Vorherrschaft“)
Für jedes der 64 Felder wird berechnet, wie stark Weiß und Schwarz es kontrollieren.
Blau = weiße Dominanz, Rot = schwarze Dominanz, neutrale Felder bleiben unbemalt;
ein Eckmarker kennzeichnet umkämpfte Felder (beide Seiten greifen zu).
Zwei Gewichtungen sind wählbar:

- **Angreiferzahl** — reine Differenz der Angreifer, wie im Raumkontroll-Modell von
  de Sousa & Barthelemy ([arXiv:2304.11425](https://arxiv.org/abs/2304.11425))
- **gewichtet 1/√Wert** — billige Figuren kontrollieren glaubwürdiger: ein von einem
  Bauern gedecktes Feld ist faktisch tabu, ein nur von der Dame „kontrolliertes“ kaum

Optional werden **Röntgen-/Batterieangriffe** mitgezählt (Doppeltürme, Dame hinter
Läufer — durchgezählte Linien mit halbem Gewicht, gestrichelt dargestellt).

### Deckungsnetz
Klick auf eine Figur zeigt ihr komplettes Beziehungsgeflecht:

- direkte Verteidiger und deren Verteidiger, transitiv bis Tiefe 4
  (grüne Pfeile, mit der Tiefe abnehmende Deckkraft)
- alle Angreifer (rote Pfeile, Röntgenangriffe gestrichelt)
- **statische Abtauschbewertung (SEE)**: das Standard-Swap-Verfahren der
  Schachprogrammierung beantwortet „lohnt es sich, hier zu schlagen?“ —
  Figuren mit positivem SEE für den Gegner werden als **Schwachstellen** gelistet
- **Netz-Zentralität**: die Betweenness-Zentralität der Figur im Interaktionsgraphen
  der Stellung. Nach Barthelemy ([arXiv:2410.02333](https://arxiv.org/abs/2410.02333))
  markieren zentrale, angegriffene Figuren die *Fragilität* einer Stellung — die
  violetten Halos zeigen, welche Figuren das Stellungsgerüst tragen. Der
  **Fragilitätsindex** summiert die Zentralität aller angegriffenen Figuren.

### Prognose (Blick in die Zukunft)
Über die Lichess-Cloud-Eval-API (Stockfish, oft Tiefe 40+) werden bis zu drei
Hauptvarianten geladen. Ein Schieberegler bewegt die Heatmap entlang der Variante
in die Zukunft: man sieht, wie sich die Vorherrschaft in den nächsten Halbzügen
verschiebt.

### Import
- **Lichess**: Partie-URL/ID oder Nutzername (letzte 30 Partien), über die offene Lichess-API
- **PGN**: einfügen und analysieren (Beispiel an Bord: die Unsterbliche Partie 1851)
- **FEN**: beliebige Stellung direkt laden
- Züge lassen sich per Klick direkt auf dem Brett ausprobieren („was wäre wenn“),
  Navigation durch die Partie per Pfeiltasten

## Entwicklung

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # Produktions-Build
```

## Deployment auf Vercel

Repo bei Vercel importieren — fertig. Keine Umgebungsvariablen, keine Datenbank.
Die drei API-Routen (`/api/lichess/*`, `/api/cloud-eval`) sind schlanke Proxies zur
öffentlichen Lichess-API und laufen als Serverless Functions.

## Technik

- [Next.js 15](https://nextjs.org) (App Router) + React 19, TypeScript
- [chess.js](https://github.com/jhlywa/chess.js) für Regeln, PGN/FEN
- Eigene Analyse-Engine in `lib/analysis.ts`: Angriffskarten mit Röntgenstrahlen,
  SEE-Swap-Algorithmus, Brandes-Betweenness auf dem Interaktionsgraphen
- Brett als pures SVG, Figurensatz: Cburnett
  ([Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces),
  CC BY-SA 3.0)

## Roadmap-Ideen

- Lokales Stockfish (WASM) als Fallback, wenn die Cloud eine Stellung nicht kennt
- Heatmap-Verlauf als Animation über die ganze Partie („Kontroll-Film“)
- Fragilitäts-Zeitreihe: an welchem Zug kippte die Partie?
