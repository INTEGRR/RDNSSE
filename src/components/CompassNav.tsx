import type { Stand } from '../lib/stands'
import type { LatLng } from '../lib/geo'
import { angleDelta, bearingDeg, cardinal, distanceM, formatDistance, walkMinutes } from '../lib/geo'

interface Props {
  stand: Stand
  pos: LatLng | null
  heading: number | null
  needsCompassPermission: boolean
  onRequestCompass: () => void
  visited: boolean
  onToggleVisited: () => void
  onClose: () => void
}

export default function CompassNav(props: Props) {
  const { stand, pos, heading, needsCompassPermission, onRequestCompass, visited, onToggleVisited, onClose } = props
  const dist = pos ? distanceM(pos, stand) : null
  const bearing = pos ? bearingDeg(pos, stand) : null
  const rotation = bearing != null && heading != null ? angleDelta(bearing, heading) : null
  const arrived = dist != null && dist < 25

  return (
    <div className="nav-overlay">
      <header className="nav-head">
        <button className="nav-close" onClick={onClose}>‹ zurück</button>
        <div className="nav-title">
          <strong>{stand.name}</strong>
          {stand.note && <small>{stand.note}</small>}
        </div>
      </header>

      <div className="nav-body">
        {arrived ? (
          <div className="arrived">
            <div className="arrived-emoji">🎉</div>
            <h2>Angekommen!</h2>
            <p>Viel Spaß beim Stöbern.</p>
          </div>
        ) : (
          <div className="compass">
            <div className="compass-ring">
              <div
                className="compass-arrow"
                style={rotation != null ? { transform: `rotate(${rotation}deg)` } : { opacity: 0.25 }}
              >
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <path d="M50 6 L72 74 L50 58 L28 74 Z" fill="currentColor" />
                </svg>
              </div>
            </div>
            <div className="compass-read">
              {dist != null ? (
                <>
                  <div className="compass-dist">{formatDistance(dist)}</div>
                  <div className="compass-sub">
                    ~{walkMinutes(dist)} min zu Fuß
                    {bearing != null && <> · Richtung {cardinal(bearing)}</>}
                  </div>
                </>
              ) : (
                <div className="compass-sub">Warte auf GPS …</div>
              )}
              {rotation == null && bearing != null && (
                needsCompassPermission ? (
                  <button className="primary" onClick={onRequestCompass}>Kompass aktivieren</button>
                ) : (
                  <p className="hint">
                    Kein Kompass verfügbar — Pfeil erscheint, sobald du dich bewegst (GPS-Richtung).
                    Bis dahin: Richtung {cardinal(bearing)} halten.
                  </p>
                )
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="nav-foot">
        <button className={visited ? 'big-check done' : 'big-check'} onClick={onToggleVisited}>
          {visited ? '✓ besucht' : 'als besucht abhaken'}
        </button>
      </footer>
    </div>
  )
}
