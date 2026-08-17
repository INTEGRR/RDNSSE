'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import Board from '@/components/Board'
import {
  Analysis, ControlMode, GameRecord, PIECE_NAME_DE, START_FEN,
  analyze, applyUci, controlScores, gameFromSans, parsePgn, supportChain,
} from '@/lib/analysis'
import {
  CloudEval, LichessGameSummary, extractGameId, fetchCloudEval,
  fetchGamePgn, fetchUserGames, formatEval,
} from '@/lib/lichess'

const IMMORTAL_SANS = ('e4 e5 f4 exf4 Bc4 Qh4+ Kf1 b5 Bxb5 Nf6 Nf3 Qh6 d3 Nh5 Nh4 Qg5 Nf5 c6 g4 Nf6 ' +
  'Rg1 cxb5 h4 Qg6 h5 Qg5 Qf3 Ng8 Bxf4 Qf6 Nc3 Bc5 Nd5 Qxb2 Bd6 Bxg1 ' +
  'e5 Qxa1+ Ke2 Na6 Nxg7+ Kd8 Qf6+ Nxf6 Be7#').split(' ')

type Tab = 'lichess' | 'pgn' | 'fen'

export default function Page() {
  const [game, setGame] = useState<GameRecord | null>(null)
  const [ply, setPly] = useState(0)
  const [manualFen, setManualFen] = useState<string | null>(null)

  const [heatmap, setHeatmap] = useState(true)
  const [mode, setMode] = useState<ControlMode>('weighted')
  const [xray, setXray] = useState(true)
  const [tension, setTension] = useState(true)
  const [fragility, setFragility] = useState(true)
  const [flipped, setFlipped] = useState(false)

  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)

  const [cloud, setCloud] = useState<CloudEval | null>(null)
  const [cloudState, setCloudState] = useState<'idle' | 'loading' | 'missing' | 'error'>('idle')
  const [pvIndex, setPvIndex] = useState(0)
  const [forecastStep, setForecastStep] = useState(0)

  const [error, setError] = useState<string | null>(null)

  const baseFen = manualFen ?? (game ? game.fens[ply] : START_FEN)

  const forecast = useMemo(() => {
    if (!cloud || !cloud.pvs[pvIndex]) return null
    const uci = cloud.pvs[pvIndex].moves.split(' ').slice(0, 10)
    return applyUci(baseFen, uci)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud, pvIndex, baseFen])

  const fen = forecastStep > 0 && forecast ? forecast.fens[Math.min(forecastStep, forecast.fens.length) - 1] : baseFen

  const analysis: Analysis = useMemo(() => analyze(fen, xray), [fen, xray])
  const scores = useMemo(() => controlScores(analysis, mode, xray), [analysis, mode, xray])
  const support = useMemo(
    () => (selected ? supportChain(analysis, selected) : new Map()),
    [analysis, selected],
  )

  const legalTargets = useMemo(() => {
    if (!selected || forecastStep > 0) return []
    try {
      const chess = new Chess(fen)
      return chess.moves({ square: selected as never, verbose: true }).map(m => m.to as string)
    } catch {
      return []
    }
  }, [fen, selected, forecastStep])

  const jumpTo = useCallback((newPly: number) => {
    setPly(newPly)
    setManualFen(null)
    setSelected(null)
    setCloud(null)
    setCloudState('idle')
    setForecastStep(0)
    setLastMove(null)
  }, [])

  const loadGame = useCallback((g: GameRecord) => {
    setGame(g)
    jumpTo(g.fens.length - 1)
    setError(null)
  }, [jumpTo])

  const loadFen = useCallback((f: string) => {
    try {
      new Chess(f.trim())
      setGame(null)
      setPly(0)
      setManualFen(f.trim())
      setSelected(null)
      setCloud(null)
      setCloudState('idle')
      setForecastStep(0)
      setLastMove(null)
      setError(null)
    } catch (e) {
      setError('FEN ungültig: ' + (e as Error).message)
    }
  }, [])

  const onSquareClick = useCallback((square: string) => {
    if (forecastStep > 0) {
      setSelected(analysis.pieceAt.has(square) ? square : null)
      return
    }
    if (selected && legalTargets.includes(square)) {
      try {
        const chess = new Chess(fen)
        chess.move({ from: selected, to: square, promotion: 'q' })
        setManualFen(chess.fen())
        setLastMove({ from: selected, to: square })
        setSelected(null)
        setCloud(null)
        setCloudState('idle')
        return
      } catch {
        // not legal after all — fall through to selection
      }
    }
    setSelected(prev => (prev === square || !analysis.pieceAt.has(square) ? null : square))
  }, [analysis, fen, forecastStep, legalTargets, selected])

  // keyboard navigation through the game
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!game) return
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowLeft' && ply > 0) { e.preventDefault(); jumpTo(ply - 1) }
      if (e.key === 'ArrowRight' && ply < game.fens.length - 1) { e.preventDefault(); jumpTo(ply + 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [game, ply, jumpTo])

  const loadCloud = useCallback(async () => {
    setCloudState('loading')
    setForecastStep(0)
    setPvIndex(0)
    try {
      const result = await fetchCloudEval(baseFen)
      if (!result) {
        setCloud(null)
        setCloudState('missing')
      } else {
        setCloud(result)
        setCloudState('idle')
      }
    } catch {
      setCloud(null)
      setCloudState('error')
    }
  }, [baseFen])

  // aggregate metrics
  const spaceBalance = useMemo(() => {
    let sum = 0
    for (const s of scores.values()) sum += Math.sign(s.score)
    return sum
  }, [scores])

  const selectedPiece = selected ? analysis.pieceAt.get(selected) : undefined
  const hoverScore = hover ? scores.get(hover) : undefined

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <h1>FELDHERR</h1>
          <p className="tagline">Kontrolle · Deckung · Fragilität — wissenschaftliche Schach-Positionsanalyse</p>
        </div>
        <div className="topbar-meta mono">
          {game ? `${game.white} – ${game.black} · ${game.result}` : 'Freie Stellung'}
          {manualFen && game && <span className="badge badge-warn">abweichend</span>}
          {forecastStep > 0 && <span className="badge badge-forecast">Prognose +{forecastStep}</span>}
        </div>
      </header>

      <div className="layout">
        <section className="board-col">
          <Board
            analysis={analysis}
            scores={scores}
            heatmap={heatmap}
            fragility={fragility}
            tension={tension}
            selected={selected}
            support={support}
            legalTargets={legalTargets}
            lastMove={lastMove}
            flipped={flipped}
            onSquareClick={onSquareClick}
            onHover={setHover}
          />
          <div className="hoverbar mono">
            {hover && hoverScore
              ? `${hover} · Weiß ${hoverScore.w.toFixed(2)} vs. Schwarz ${hoverScore.b.toFixed(2)}` +
                (hoverScore.contested ? ' · umkämpft' : '') +
                (analysis.pieceAt.get(hover) ? ` · ${PIECE_NAME_DE[analysis.pieceAt.get(hover)!.type]} (${analysis.pieceAt.get(hover)!.color === 'w' ? 'Weiß' : 'Schwarz'})` : '')
              : 'Feld überfahren für Kontrollwerte · Figur anklicken für Deckungsnetz · Zug ziehen per Klick'}
          </div>

          <div className="movenav">
            <div className="movenav-buttons">
              <button onClick={() => jumpTo(0)} disabled={!game || ply === 0} title="Anfang">⏮</button>
              <button onClick={() => jumpTo(ply - 1)} disabled={!game || ply === 0} title="Zurück">◀</button>
              <button onClick={() => jumpTo(ply + 1)} disabled={!game || ply >= (game?.fens.length ?? 1) - 1} title="Vor">▶</button>
              <button onClick={() => game && jumpTo(game.fens.length - 1)} disabled={!game || ply >= (game?.fens.length ?? 1) - 1} title="Ende">⏭</button>
              <button onClick={() => setFlipped(f => !f)} title="Brett drehen">⟲</button>
              {manualFen && game && <button onClick={() => jumpTo(ply)}>zurück zur Partie</button>}
            </div>
            {game && (
              <ol className="movelist">
                {game.sans.map((san, i) => (
                  <li key={i}>
                    {i % 2 === 0 && <span className="movenum mono">{Math.floor(i / 2) + 1}.</span>}
                    <button
                      className={ply === i + 1 && !manualFen ? 'move current' : 'move'}
                      onClick={() => jumpTo(i + 1)}
                    >
                      {san}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <aside className="side-col">
          <ImportCard onGame={loadGame} onFen={loadFen} onError={setError} />
          {error && <div className="card error-card">{error}</div>}

          <div className="card">
            <h2>Analyse-Ebenen</h2>
            <div className="toggles">
              <Toggle label="Kontroll-Heatmap" on={heatmap} set={setHeatmap} />
              <Toggle label="Spannungsmarker" on={tension} set={setTension} />
              <Toggle label="Röntgen / Batterien" on={xray} set={setXray} />
              <Toggle label="Fragilitäts-Halos" on={fragility} set={setFragility} />
            </div>
            <div className="mode-row">
              <span className="label">Gewichtung</span>
              <div className="seg">
                <button className={mode === 'weighted' ? 'on' : ''} onClick={() => setMode('weighted')}>gewichtet 1/√Wert</button>
                <button className={mode === 'count' ? 'on' : ''} onClick={() => setMode('count')}>Angreiferzahl</button>
              </div>
            </div>
            <div className="legend">
              <div className="legend-scale">
                <span className="mono">Schwarz</span>
                <div className="scale-bar" />
                <span className="mono">Weiß</span>
              </div>
              <div className="legend-items mono">
                <span><i className="sym sym-tension" /> umkämpft</span>
                <span><i className="sym sym-halo" /> Netz-Zentralität</span>
                <span><i className="sym sym-def" /> deckt</span>
                <span><i className="sym sym-att" /> greift an</span>
              </div>
            </div>
            <dl className="metrics mono">
              <div><dt>Raumbilanz</dt><dd>{spaceBalance > 0 ? '+' : ''}{spaceBalance} Felder</dd></div>
              <div><dt>Fragilitätsindex</dt><dd>{analysis.fragilityIndex.toFixed(3)}</dd></div>
              <div><dt>Am Zug</dt><dd>{analysis.turn === 'w' ? 'Weiß' : 'Schwarz'}</dd></div>
            </dl>
            {analysis.hanging.length > 0 && (
              <div className="weak">
                <h3>Schwachstellen (Abtauschanalyse)</h3>
                <ul>
                  {analysis.hanging.map(p => (
                    <li key={p.square}>
                      <button className="weak-btn" onClick={() => setSelected(p.square)}>
                        {PIECE_NAME_DE[p.type]} {p.square} ({p.color === 'w' ? 'Weiß' : 'Schwarz'}) · SEE +{analysis.see.get(p.square)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {selectedPiece && (
            <div className="card">
              <h2>{PIECE_NAME_DE[selectedPiece.type]} auf {selected} <span className="dim">({selectedPiece.color === 'w' ? 'Weiß' : 'Schwarz'})</span></h2>
              <PieceDetail analysis={analysis} square={selected!} supportSize={support.size} />
            </div>
          )}

          <div className="card">
            <h2>Prognose <span className="dim">Stockfish-Cloud</span></h2>
            {cloudState === 'idle' && !cloud && (
              <button className="primary" onClick={loadCloud}>Engine-Varianten laden</button>
            )}
            {cloudState === 'loading' && <p className="dim">Lade Cloud-Bewertung …</p>}
            {cloudState === 'missing' && <p className="dim">Für diese Stellung liegt keine Cloud-Bewertung vor (seltene Stellung). <button className="linkish" onClick={loadCloud}>erneut versuchen</button></p>}
            {cloudState === 'error' && <p className="dim">Cloud-Analyse nicht erreichbar. <button className="linkish" onClick={loadCloud}>erneut versuchen</button></p>}
            {cloud && (
              <>
                <p className="dim mono">Tiefe {cloud.depth} · {Math.round(cloud.knodes / 1000)}M Knoten</p>
                <div className="pvs">
                  {cloud.pvs.map((pv, i) => (
                    <button
                      key={i}
                      className={i === pvIndex ? 'pv on' : 'pv'}
                      onClick={() => { setPvIndex(i); setForecastStep(0) }}
                    >
                      <span className="mono eval">{formatEval(pv)}</span>
                      <span className="pv-moves mono">{pv.moves.split(' ').slice(0, 6).join(' ')}…</span>
                    </button>
                  ))}
                </div>
                {forecast && forecast.fens.length > 0 && (
                  <div className="forecast-slider">
                    <label className="label" htmlFor="fc">Heatmap in die Zukunft schieben: {forecastStep === 0 ? 'jetzt' : `+${forecastStep} Halbzüge`}</label>
                    <input
                      id="fc" type="range" min={0} max={forecast.fens.length} value={forecastStep}
                      onChange={e => { setForecastStep(parseInt(e.target.value, 10)); setSelected(null) }}
                    />
                    {forecastStep > 0 && (
                      <p className="mono dim fc-line">{forecast.sans.slice(0, forecastStep).join(' ')}</p>
                    )}
                  </div>
                )}
                <button className="linkish" onClick={loadCloud}>neu laden für aktuelle Stellung</button>
              </>
            )}
          </div>

          <div className="card sources">
            <h2>Methodik</h2>
            <ul>
              <li>Feldkontrolle & Raumbilanz nach dem Ansatz von <a href="https://arxiv.org/abs/2304.11425" target="_blank" rel="noreferrer">de Sousa & Barthelemy 2023</a></li>
              <li>Fragilität als Betweenness-Zentralität im Interaktionsgraphen: <a href="https://arxiv.org/abs/2410.02333" target="_blank" rel="noreferrer">Barthelemy 2024</a></li>
              <li>Schwachstellen per statischer Abtauschbewertung (SEE, Schachprogrammierungs-Standard)</li>
              <li>Engine-Prognose: <a href="https://lichess.org/api" target="_blank" rel="noreferrer">Lichess Cloud-Eval</a> (Stockfish)</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button className={on ? 'toggle on' : 'toggle'} onClick={() => set(!on)} aria-pressed={on}>
      <i className="knob" />{label}
    </button>
  )
}

function PieceDetail({ analysis, square, supportSize }: { analysis: Analysis; square: string; supportSize: number }) {
  const piece = analysis.pieceAt.get(square)!
  const info = analysis.control.get(square)!
  const defenders = info[piece.color].filter(a => !a.xray)
  const xrayDefenders = info[piece.color].filter(a => a.xray)
  const attackers = info[piece.color === 'w' ? 'b' : 'w'].filter(a => !a.xray)
  const xrayAttackers = info[piece.color === 'w' ? 'b' : 'w'].filter(a => a.xray)
  const see = analysis.see.get(square)
  const centrality = analysis.centrality.get(square) ?? 0

  const describe = (list: typeof defenders) =>
    list.length === 0 ? '—' : list.map(a => `${PIECE_NAME_DE[a.piece]} ${a.from}`).join(', ')

  return (
    <dl className="piece-detail">
      <div><dt>Direkt gedeckt von</dt><dd>{describe(defenders)}{xrayDefenders.length > 0 && <span className="dim"> (+{xrayDefenders.length} röntgen)</span>}</dd></div>
      <div><dt>Angegriffen von</dt><dd>{describe(attackers)}{xrayAttackers.length > 0 && <span className="dim"> (+{xrayAttackers.length} röntgen)</span>}</dd></div>
      <div><dt>Deckungsnetz gesamt</dt><dd>{supportSize} {supportSize === 1 ? 'Figur' : 'Figuren'} (grüne Pfeile, Tiefe per Helligkeit)</dd></div>
      {see !== undefined && (
        <div>
          <dt>Abtausch hier (SEE)</dt>
          <dd className={see > 0 ? 'bad' : 'good'}>
            {see > 0 ? `+${see} für den Gegner — hängt!` : see === 0 ? '±0 — ausgeglichen' : `${see} für den Gegner — sicher gedeckt`}
          </dd>
        </div>
      )}
      <div><dt>Netz-Zentralität</dt><dd>{centrality.toFixed(3)} {centrality > 0.1 ? '· Schlüsselfigur des Stellungsgerüsts' : ''}</dd></div>
    </dl>
  )
}

function ImportCard({ onGame, onFen, onError }: {
  onGame: (g: GameRecord) => void
  onFen: (fen: string) => void
  onError: (msg: string | null) => void
}) {
  const [tab, setTab] = useState<Tab>('lichess')
  const [gameInput, setGameInput] = useState('')
  const [userInput, setUserInput] = useState('')
  const [userGames, setUserGames] = useState<LichessGameSummary[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [pgnText, setPgnText] = useState('')
  const [fenText, setFenText] = useState('')

  const loadById = async () => {
    const id = extractGameId(gameInput)
    if (!id) { onError('Keine gültige Lichess-Partie-URL oder -ID erkannt.'); return }
    setBusy(true)
    try {
      const pgn = await fetchGamePgn(id)
      onGame(parsePgn(pgn))
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const loadUser = async () => {
    if (!userInput.trim()) return
    setBusy(true)
    setUserGames(null)
    try {
      const games = await fetchUserGames(userInput.trim())
      setUserGames(games)
      onError(games.length === 0 ? 'Keine Partien für diesen Account gefunden.' : null)
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const pickUserGame = (g: LichessGameSummary) => {
    try {
      onGame(gameFromSans(g.moves.split(' ').filter(Boolean), {
        white: g.white, black: g.black,
        result: g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '½-½',
        event: `Lichess ${g.speed}`,
      }))
    } catch {
      onError('Partie konnte nicht rekonstruiert werden (Variante?).')
    }
  }

  return (
    <div className="card">
      <h2>Stellung laden</h2>
      <div className="seg tabs">
        <button className={tab === 'lichess' ? 'on' : ''} onClick={() => setTab('lichess')}>Lichess</button>
        <button className={tab === 'pgn' ? 'on' : ''} onClick={() => setTab('pgn')}>PGN</button>
        <button className={tab === 'fen' ? 'on' : ''} onClick={() => setTab('fen')}>FEN</button>
      </div>

      {tab === 'lichess' && (
        <div className="stack">
          <div className="inline">
            <input
              value={gameInput}
              onChange={e => setGameInput(e.target.value)}
              placeholder="Partie-URL oder ID, z. B. lichess.org/AbCdEfGh"
              onKeyDown={e => e.key === 'Enter' && loadById()}
            />
            <button className="primary" onClick={loadById} disabled={busy}>laden</button>
          </div>
          <div className="inline">
            <input
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              placeholder="… oder Lichess-Nutzername"
              onKeyDown={e => e.key === 'Enter' && loadUser()}
            />
            <button className="primary" onClick={loadUser} disabled={busy}>Partien</button>
          </div>
          {busy && <p className="dim">Lade …</p>}
          {userGames && userGames.length > 0 && (
            <ul className="gamelist">
              {userGames.map(g => (
                <li key={g.id}>
                  <button onClick={() => pickUserGame(g)}>
                    <span>{g.white} – {g.black}</span>
                    <span className="mono dim">{g.speed} · {g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '½'} · {new Date(g.createdAt).toLocaleDateString('de-DE')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'pgn' && (
        <div className="stack">
          <textarea
            value={pgnText}
            onChange={e => setPgnText(e.target.value)}
            placeholder="PGN hier einfügen …"
            rows={5}
          />
          <div className="inline">
            <button
              className="primary"
              onClick={() => {
                try { onGame(parsePgn(pgnText)); onError(null) } catch (e) { onError('PGN konnte nicht gelesen werden: ' + (e as Error).message) }
              }}
            >
              analysieren
            </button>
            <button onClick={() => { setPgnText(''); onGame(gameFromSans(IMMORTAL_SANS, { white: 'Anderssen', black: 'Kieseritzky', result: '1-0', event: 'Die Unsterbliche, London 1851' })) }}>
              Beispiel: Unsterbliche Partie
            </button>
          </div>
        </div>
      )}

      {tab === 'fen' && (
        <div className="stack">
          <input
            value={fenText}
            onChange={e => setFenText(e.target.value)}
            placeholder="FEN, z. B. r1bqkbnr/pppp1ppp/2n5/…"
            onKeyDown={e => e.key === 'Enter' && onFen(fenText)}
          />
          <div className="inline">
            <button className="primary" onClick={() => onFen(fenText)}>analysieren</button>
            <button onClick={() => onFen(START_FEN)}>Grundstellung</button>
          </div>
        </div>
      )}
    </div>
  )
}
