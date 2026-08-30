#!/usr/bin/env node
/**
 * Adressen → public/stands.json
 *
 * Eingabe: eine Textdatei, pro Zeile ein Stand:
 *   Name des Standes | Straße Hausnr, PLZ Ort | optionale Notiz
 * Zeilen mit führendem # werden ignoriert.
 *
 * Geocoding über OSM Nominatim (1 Request/Sekunde, User-Agent Pflicht).
 *
 * Aufruf: node scripts/geocode.mjs hoefe.txt
 */
import { readFileSync, writeFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('Aufruf: node scripts/geocode.mjs <adressliste.txt>')
  process.exit(1)
}

const lines = readFileSync(file, 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('#'))

const sleep = ms => new Promise(r => setTimeout(r, ms))
const stands = []
let failures = 0

for (const [i, line] of lines.entries()) {
  const [name, address, note] = line.split('|').map(s => s?.trim())
  if (!name || !address) {
    console.warn(`Zeile übersprungen (Format?): ${line}`)
    continue
  }
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=de&q=${encodeURIComponent(address)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'troedelradar-import/1.0' } })
  const hits = res.ok ? await res.json() : []
  if (hits.length === 0) {
    console.error(`✗ nicht gefunden: ${name} — ${address}`)
    failures++
  } else {
    stands.push({
      id: `s${i + 1}`,
      name,
      lat: parseFloat(hits[0].lat),
      lng: parseFloat(hits[0].lon),
      ...(note ? { note } : {}),
    })
    console.log(`✓ ${name} → ${hits[0].lat}, ${hits[0].lon}`)
  }
  await sleep(1100)
}

const existing = JSON.parse(readFileSync('public/stands.json', 'utf8'))
const out = { ...existing, demo: false, stands }
writeFileSync('public/stands.json', JSON.stringify(out, null, 2) + '\n')
console.log(`\n${stands.length} Stände geschrieben, ${failures} Fehlschläge → public/stands.json`)
