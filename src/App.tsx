import { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView'
import NearbyList from './components/NearbyList'
import CompassNav from './components/CompassNav'
import { useGeolocation } from './lib/useGeolocation'
import { useHeading } from './lib/useHeading'
import { loadStands, loadVisited, saveVisited, type StandsFile } from './lib/stands'

type Tab = 'map' | 'nearby'

export default function App() {
  const [data, setData] = useState<StandsFile | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [tab, setTab] = useState<Tab>('map')
  const [target, setTarget] = useState<string | null>(null)
  const [visited, setVisited] = useState<Set<string>>(() => loadVisited())

  const geo = useGeolocation()
  const { heading, needsPermission, requestPermission } = useHeading(geo.course)

  useEffect(() => {
    loadStands().then(setData).catch(() => setLoadError(true))
  }, [])

  const numbers = useMemo(() => {
    const m = new Map<string, number>()
    data?.stands.forEach((s, i) => m.set(s.id, i + 1))
    return m
  }, [data])

  const toggleVisited = (id: string) => {
    setVisited(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveVisited(next)
      return next
    })
  }

  if (loadError) return <div className="boot">Standdaten nicht ladbar — bitte neu laden.</div>
  if (!data) return <div className="boot">Lade Höfe …</div>

  const targetStand = target ? data.stands.find(s => s.id === target) : null
  const openCount = data.stands.length - [...visited].filter(v => data.stands.some(s => s.id === v)).length

  return (
    <div className="app">
      <header className="head">
        <div className="head-brand">
          <img src="/icon.svg" alt="" width={34} height={34} />
          <div>
            <h1>Trödelradar</h1>
            <small>{data.event.name} · {new Date(data.event.date + 'T00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })} · {data.event.start}–{data.event.end} Uhr</small>
          </div>
        </div>
        <div className="head-stats">
          <strong>{openCount}</strong>
          <small>von {data.stands.length} offen</small>
        </div>
      </header>

      {data.demo && (
        <div className="demo-banner">Demo-Daten — die echten Höfe kommen, sobald die Liste importiert ist.</div>
      )}
      {geo.error && <div className="geo-banner">{geo.error}</div>}

      <main className="main">
        {tab === 'map' ? (
          <MapView
            stands={data.stands}
            visited={visited}
            pos={geo.pos}
            accuracy={geo.accuracy}
            onSelect={setTarget}
          />
        ) : (
          <NearbyList
            stands={data.stands}
            numbers={numbers}
            visited={visited}
            pos={geo.pos}
            heading={heading}
            onSelect={setTarget}
            onToggleVisited={toggleVisited}
          />
        )}
      </main>

      <nav className="tabbar">
        <button className={tab === 'map' ? 'on' : ''} onClick={() => setTab('map')}>🗺️ Karte</button>
        <button className={tab === 'nearby' ? 'on' : ''} onClick={() => { setTab('nearby'); if (needsPermission) requestPermission() }}>📍 In der Nähe</button>
      </nav>

      {targetStand && (
        <CompassNav
          stand={targetStand}
          pos={geo.pos}
          heading={heading}
          needsCompassPermission={needsPermission}
          onRequestCompass={requestPermission}
          visited={visited.has(targetStand.id)}
          onToggleVisited={() => toggleVisited(targetStand.id)}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  )
}
