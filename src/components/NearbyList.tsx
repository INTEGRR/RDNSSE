import type { Stand } from '../lib/stands'
import type { LatLng } from '../lib/geo'
import { bearingDeg, cardinal, distanceM, formatDistance, walkMinutes, angleDelta } from '../lib/geo'

interface Props {
  stands: Stand[]
  numbers: Map<string, number>
  visited: Set<string>
  pos: LatLng | null
  heading: number | null
  onSelect: (id: string) => void
  onToggleVisited: (id: string) => void
}

export default function NearbyList({ stands, numbers, visited, pos, heading, onSelect, onToggleVisited }: Props) {
  const rows = stands
    .map(s => ({
      stand: s,
      dist: pos ? distanceM(pos, s) : null,
      bearing: pos ? bearingDeg(pos, s) : null,
    }))
    .sort((a, b) => {
      const va = visited.has(a.stand.id) ? 1 : 0
      const vb = visited.has(b.stand.id) ? 1 : 0
      if (va !== vb) return va - vb
      return (a.dist ?? Infinity) - (b.dist ?? Infinity)
    })

  return (
    <div className="list">
      {!pos && <p className="hint">Warte auf GPS … Standort-Zugriff erlauben, dann sortiert sich die Liste nach Nähe.</p>}
      {rows.map(({ stand, dist, bearing }) => {
        const done = visited.has(stand.id)
        return (
          <div key={stand.id} className={done ? 'row row-done' : 'row'}>
            <button className="row-main" onClick={() => onSelect(stand.id)}>
              <span className="row-num">{numbers.get(stand.id)}</span>
              <span className="row-text">
                <strong>{stand.name}</strong>
                {stand.note && <small>{stand.note}</small>}
              </span>
              <span className="row-dist">
                {dist != null && bearing != null ? (
                  <>
                    <span
                      className="row-arrow"
                      style={heading != null ? { transform: `rotate(${angleDelta(bearing, heading)}deg)` } : undefined}
                    >
                      {heading != null ? '↑' : cardinal(bearing)}
                    </span>
                    <strong>{formatDistance(dist)}</strong>
                    <small>~{walkMinutes(dist)} min</small>
                  </>
                ) : (
                  <small>—</small>
                )}
              </span>
            </button>
            <button
              className="row-check"
              onClick={() => onToggleVisited(stand.id)}
              title={done ? 'Als offen markieren' : 'Als besucht abhaken'}
            >
              {done ? '✓' : '○'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
