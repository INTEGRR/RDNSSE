export interface LichessGameSummary {
  id: string
  white: string
  black: string
  winner?: 'white' | 'black'
  speed: string
  moves: string
  createdAt: number
  status: string
}

export interface CloudEvalPv {
  moves: string
  cp?: number
  mate?: number
}

export interface CloudEval {
  depth: number
  knodes: number
  pvs: CloudEvalPv[]
}

/** Extract a Lichess game id from a pasted URL or raw id. */
export function extractGameId(input: string): string | null {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/lichess\.org\/(?:game\/export\/)?([a-zA-Z0-9]{8,12})/)
  if (urlMatch) return urlMatch[1].slice(0, 8)
  if (/^[a-zA-Z0-9]{8,12}$/.test(trimmed)) return trimmed.slice(0, 8)
  return null
}

export async function fetchGamePgn(id: string): Promise<string> {
  const res = await fetch(`/api/lichess/game/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(`Partie ${id} nicht gefunden (${res.status})`)
  return res.text()
}

export async function fetchUserGames(username: string): Promise<LichessGameSummary[]> {
  const res = await fetch(`/api/lichess/user/${encodeURIComponent(username)}`)
  if (!res.ok) throw new Error(`Spieler „${username}“ nicht gefunden (${res.status})`)
  const text = await res.text()
  const games: LichessGameSummary[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const g = JSON.parse(line)
      const name = (p: { user?: { name?: string }; aiLevel?: number } | undefined) =>
        p?.user?.name ?? (p?.aiLevel !== undefined ? `Stockfish Lvl ${p.aiLevel}` : 'Anonym')
      games.push({
        id: g.id,
        white: name(g.players?.white),
        black: name(g.players?.black),
        winner: g.winner,
        speed: g.speed,
        moves: g.moves ?? '',
        createdAt: g.createdAt,
        status: g.status,
      })
    } catch {
      // skip malformed ndjson lines
    }
  }
  return games
}

export async function fetchCloudEval(fen: string, multiPv = 3): Promise<CloudEval | null> {
  const res = await fetch(`/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=${multiPv}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Cloud-Analyse fehlgeschlagen (${res.status})`)
  return res.json()
}

/** Lichess cloud-eval reports cp/mate from White's perspective. */
export function formatEval(pv: CloudEvalPv): string {
  if (pv.mate !== undefined) return `#${pv.mate}`
  if (pv.cp === undefined) return '–'
  const val = (pv.cp / 100).toFixed(2)
  return pv.cp > 0 ? `+${val}` : val
}
