import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Stand } from '../lib/stands'
import type { LatLng } from '../lib/geo'

interface Props {
  stands: Stand[]
  visited: Set<string>
  pos: LatLng | null
  accuracy: number | null
  onSelect: (id: string) => void
}

export default function MapView({ stands, visited, pos, accuracy, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef<Map<string, L.Marker>>(new Map())
  const userMarker = useRef<L.Marker | null>(null)
  const accCircle = useRef<L.Circle | null>(null)
  const didFit = useRef(false)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: false, attributionControl: true })
    L.control.zoom({ position: 'bottomright' }).addTo(m)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    m.setView([52.247, 8.877], 15)
    map.current = m
    return () => {
      m.remove()
      map.current = null
      markers.current.clear()
      userMarker.current = null
      accCircle.current = null
      didFit.current = false
    }
  }, [])

  // stand markers
  useEffect(() => {
    const m = map.current
    if (!m) return
    markers.current.forEach(mk => mk.remove())
    markers.current.clear()
    stands.forEach((s, i) => {
      const done = visited.has(s.id)
      const icon = L.divIcon({
        className: '',
        html: `<div class="pin ${done ? 'pin-done' : ''}">${i + 1}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      })
      const mk = L.marker([s.lat, s.lng], { icon, title: s.name })
        .addTo(m)
        .on('click', () => onSelectRef.current(s.id))
      markers.current.set(s.id, mk)
    })
    if (!didFit.current && stands.length > 0) {
      m.fitBounds(L.latLngBounds(stands.map(s => [s.lat, s.lng])), { padding: [40, 40] })
      didFit.current = true
    }
  }, [stands, visited])

  // user position
  useEffect(() => {
    const m = map.current
    if (!m || !pos) return
    const ll: L.LatLngExpression = [pos.lat, pos.lng]
    if (!userMarker.current) {
      const icon = L.divIcon({ className: '', html: '<div class="me"><div class="me-dot"></div></div>', iconSize: [26, 26], iconAnchor: [13, 13] })
      userMarker.current = L.marker(ll, { icon, zIndexOffset: 1000 }).addTo(m)
      accCircle.current = L.circle(ll, { radius: accuracy ?? 30, weight: 1, color: '#2a78d6', fillOpacity: 0.08 }).addTo(m)
    } else {
      userMarker.current.setLatLng(ll)
      accCircle.current?.setLatLng(ll)
      if (accuracy != null) accCircle.current?.setRadius(accuracy)
    }
  }, [pos, accuracy])

  const locate = () => {
    if (map.current && pos) map.current.flyTo([pos.lat, pos.lng], Math.max(map.current.getZoom(), 16))
  }

  return (
    <div className="map-wrap">
      <div ref={el} className="map" />
      <button className="fab" onClick={locate} disabled={!pos} title="Auf meine Position zentrieren">◎</button>
    </div>
  )
}
