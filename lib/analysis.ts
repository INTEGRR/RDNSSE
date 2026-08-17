import { Chess } from 'chess.js'

export type Color = 'w' | 'b'
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export const PIECE_VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }

export const PIECE_NAME_DE: Record<PieceType, string> = {
  p: 'Bauer', n: 'Springer', b: 'Läufer', r: 'Turm', q: 'Dame', k: 'König',
}

export interface BoardPiece {
  square: string
  type: PieceType
  color: Color
}

/** A single attack/defense relation onto a square. */
export interface Attack {
  from: string
  piece: PieceType
  color: Color
  /** true when the ray passes through at least one blocker (battery / x-ray) */
  xray: boolean
  /** blocker squares the ray passes through before reaching the target */
  through: string[]
}

export type ControlMode = 'count' | 'weighted'

export interface Edge {
  from: string
  to: string
  kind: 'defends' | 'attacks'
  xray: boolean
}

export interface SquareInfo {
  w: Attack[]
  b: Attack[]
}

export interface Analysis {
  fen: string
  turn: Color
  pieces: BoardPiece[]
  pieceAt: Map<string, BoardPiece>
  /** attacks onto each of the 64 squares, keyed by square name */
  control: Map<string, SquareInfo>
  edges: Edge[]
  /** static exchange evaluation: best material gain for the side capturing on that square (>0 = piece is winnable) */
  see: Map<string, number>
  /** betweenness centrality of each occupied square in the interaction graph (fragility, Barthélemy 2024) */
  centrality: Map<string, number>
  /** sum of centrality over pieces currently under attack */
  fragilityIndex: number
  hanging: BoardPiece[]
}

const FILES = 'abcdefgh'

export function sq(file: number, rank: number): string {
  return FILES[file] + (rank + 1)
}

export function sqCoords(square: string): [number, number] {
  return [FILES.indexOf(square[0]), parseInt(square[1], 10) - 1]
}

const KNIGHT_DELTAS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
const KING_DELTAS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]]

function onBoard(f: number, r: number): boolean {
  return f >= 0 && f < 8 && r >= 0 && r < 8
}

/** Can `piece` continue a ray in direction (df,dr) beyond a blocker of that type? (battery / x-ray) */
function slidesAlong(type: PieceType, df: number, dr: number): boolean {
  const diagonal = df !== 0 && dr !== 0
  if (type === 'q') return true
  if (type === 'b') return diagonal
  if (type === 'r') return !diagonal
  return false
}

/**
 * Compute every attack relation on the board, optionally tracing x-rays
 * through aligned sliders (batteries: e.g. doubled rooks, queen behind bishop —
 * of either color, so opposing line pieces on the same ray are seen too).
 */
function computeAttacks(pieces: BoardPiece[], pieceAt: Map<string, BoardPiece>, xrayEnabled: boolean): Map<string, SquareInfo> {
  const control = new Map<string, SquareInfo>()
  for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) control.set(sq(f, r), { w: [], b: [] })

  const add = (target: string, a: Attack) => {
    control.get(target)![a.color].push(a)
  }

  for (const p of pieces) {
    const [f, r] = sqCoords(p.square)
    if (p.type === 'p') {
      const dir = p.color === 'w' ? 1 : -1
      for (const df of [-1, 1]) {
        if (onBoard(f + df, r + dir)) {
          add(sq(f + df, r + dir), { from: p.square, piece: 'p', color: p.color, xray: false, through: [] })
        }
      }
    } else if (p.type === 'n' || p.type === 'k') {
      const deltas = p.type === 'n' ? KNIGHT_DELTAS : KING_DELTAS
      for (const [df, dr] of deltas) {
        if (onBoard(f + df, r + dr)) {
          add(sq(f + df, r + dr), { from: p.square, piece: p.type, color: p.color, xray: false, through: [] })
        }
      }
    } else {
      const dirs = p.type === 'b' ? DIAG : p.type === 'r' ? ORTHO : [...DIAG, ...ORTHO]
      for (const [df, dr] of dirs) {
        const through: string[] = []
        let cf = f + df
        let cr = r + dr
        while (onBoard(cf, cr)) {
          const target = sq(cf, cr)
          add(target, { from: p.square, piece: p.type, color: p.color, xray: through.length > 0, through: [...through] })
          const blocker = pieceAt.get(target)
          if (blocker) {
            if (!xrayEnabled || !slidesAlong(blocker.type, df, dr)) break
            through.push(target)
          }
          cf += df
          cr += dr
        }
      }
    }
  }
  return control
}

/**
 * Static exchange evaluation on `target` via the swap algorithm:
 * least-valuable attacker first, x-ray attackers unlocked as blockers vacate,
 * kings may only capture when the opponent has no reply.
 * Returns the best material gain for the side attacking the occupant.
 */
function staticExchange(target: string, victim: BoardPiece, control: SquareInfo, pieceAt: Map<string, BoardPiece>): number {
  const vacated = new Set<string>()
  const used = new Set<string>()

  const usable = (color: Color): Attack[] =>
    control[color].filter(a =>
      !used.has(a.from) &&
      pieceAt.get(a.from) !== undefined &&
      a.through.every(t => vacated.has(t)),
    )

  const attacker: Color = victim.color === 'w' ? 'b' : 'w'
  const gains: number[] = []
  let occupantValue = PIECE_VALUE[victim.type]
  let side: Color = attacker

  for (;;) {
    const candidates = usable(side).sort((a, b) => PIECE_VALUE[a.piece] - PIECE_VALUE[b.piece])
    if (candidates.length === 0) break
    const next = candidates[0]
    const opponent: Color = side === 'w' ? 'b' : 'w'
    if (next.piece === 'k') {
      // the king cannot capture into a defended square
      const replies = usable(opponent).filter(a => a.from !== next.from && (!a.through.includes(next.from) || vacated.has(next.from)))
      if (replies.length > 0) break
    }
    gains.push(occupantValue)
    used.add(next.from)
    vacated.add(next.from)
    occupantValue = PIECE_VALUE[next.piece]
    side = opponent
  }

  if (gains.length === 0) return 0
  // f(i) = gains[i] - max(0, f(i+1)): each recapture is optional, the fold keeps
  // the raw value of the initial capture so well-defended pieces score negative
  let score = gains[gains.length - 1]
  for (let i = gains.length - 2; i >= 0; i--) {
    score = gains[i] - Math.max(0, score)
  }
  return score
}

/** Brandes betweenness centrality on the (undirected) piece interaction graph. */
function betweenness(nodes: string[], edges: Edge[]): Map<string, number> {
  const adj = new Map<string, Set<string>>()
  for (const n of nodes) adj.set(n, new Set())
  for (const e of edges) {
    adj.get(e.from)?.add(e.to)
    adj.get(e.to)?.add(e.from)
  }
  const cb = new Map<string, number>()
  for (const n of nodes) cb.set(n, 0)

  for (const s of nodes) {
    const stack: string[] = []
    const pred = new Map<string, string[]>()
    const sigma = new Map<string, number>()
    const dist = new Map<string, number>()
    for (const n of nodes) {
      pred.set(n, [])
      sigma.set(n, 0)
      dist.set(n, -1)
    }
    sigma.set(s, 1)
    dist.set(s, 0)
    const queue: string[] = [s]
    while (queue.length) {
      const v = queue.shift()!
      stack.push(v)
      for (const w of adj.get(v)!) {
        if (dist.get(w)! < 0) {
          dist.set(w, dist.get(v)! + 1)
          queue.push(w)
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!)
          pred.get(w)!.push(v)
        }
      }
    }
    const delta = new Map<string, number>()
    for (const n of nodes) delta.set(n, 0)
    while (stack.length) {
      const w = stack.pop()!
      for (const v of pred.get(w)!) {
        delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!))
      }
      if (w !== s) cb.set(w, cb.get(w)! + delta.get(w)!)
    }
  }

  const n = nodes.length
  const norm = n > 2 ? (n - 1) * (n - 2) : 1
  for (const [k, v] of cb) cb.set(k, v / norm)
  return cb
}

export function analyze(fen: string, xrayEnabled: boolean): Analysis {
  const chess = new Chess(fen)
  const pieces: BoardPiece[] = []
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell) pieces.push({ square: cell.square, type: cell.type as PieceType, color: cell.color as Color })
    }
  }
  const pieceAt = new Map(pieces.map(p => [p.square, p]))
  const control = computeAttacks(pieces, pieceAt, xrayEnabled)

  const edges: Edge[] = []
  for (const p of pieces) {
    const info = control.get(p.square)!
    for (const color of ['w', 'b'] as Color[]) {
      for (const a of info[color]) {
        edges.push({
          from: a.from,
          to: p.square,
          kind: color === p.color ? 'defends' : 'attacks',
          xray: a.xray,
        })
      }
    }
  }

  const see = new Map<string, number>()
  const hanging: BoardPiece[] = []
  for (const p of pieces) {
    if (p.type === 'k') continue
    const gain = staticExchange(p.square, p, control.get(p.square)!, pieceAt)
    see.set(p.square, gain)
    if (gain > 0) hanging.push(p)
  }

  const nodes = pieces.map(p => p.square)
  const centrality = betweenness(nodes, edges.filter(e => !e.xray))

  let fragilityIndex = 0
  for (const p of pieces) {
    const attacked = control.get(p.square)![p.color === 'w' ? 'b' : 'w'].some(a => !a.xray)
    if (attacked) fragilityIndex += centrality.get(p.square) ?? 0
  }

  return {
    fen,
    turn: chess.turn() as Color,
    pieces,
    pieceAt,
    control,
    edges,
    see,
    centrality,
    fragilityIndex,
    hanging,
  }
}

/** Weight of one attack for the weighted control score: cheap pieces control squares more credibly. */
function attackWeight(a: Attack, mode: ControlMode): number {
  const base = mode === 'count' ? 1 : 1 / Math.sqrt(PIECE_VALUE[a.piece])
  return a.xray ? base * 0.5 : base
}

export interface SquareScore {
  score: number // >0 white dominates, <0 black dominates
  w: number
  b: number
  contested: boolean
}

export function controlScores(analysis: Analysis, mode: ControlMode, includeXray: boolean): Map<string, SquareScore> {
  const out = new Map<string, SquareScore>()
  for (const [square, info] of analysis.control) {
    const wAtt = includeXray ? info.w : info.w.filter(a => !a.xray)
    const bAtt = includeXray ? info.b : info.b.filter(a => !a.xray)
    const w = wAtt.reduce((s, a) => s + attackWeight(a, mode), 0)
    const b = bAtt.reduce((s, a) => s + attackWeight(a, mode), 0)
    out.set(square, { score: w - b, w, b, contested: wAtt.length > 0 && bAtt.length > 0 })
  }
  return out
}

export interface SupportNode {
  square: string
  depth: number
  via: string[]
}

/** Transitive defense chain of a piece: depth 1 = direct defenders, depth 2 = their defenders, … */
export function supportChain(analysis: Analysis, square: string, maxDepth = 4): Map<string, SupportNode> {
  const result = new Map<string, SupportNode>()
  const target = analysis.pieceAt.get(square)
  if (!target) return result
  let frontier = [square]
  const seen = new Set([square])
  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const next: string[] = []
    for (const cur of frontier) {
      for (const e of analysis.edges) {
        if (e.kind !== 'defends' || e.to !== cur) continue
        const defender = analysis.pieceAt.get(e.from)
        if (!defender || defender.color !== target.color) continue
        if (seen.has(e.from)) continue
        seen.add(e.from)
        result.set(e.from, { square: e.from, depth, via: [cur] })
        next.push(e.from)
      }
    }
    frontier = next
  }
  return result
}

export interface GameRecord {
  white: string
  black: string
  result: string
  event: string
  sans: string[]
  fens: string[] // fens[0] = start, fens[i] = position after move i
}

export function parsePgn(pgn: string): GameRecord {
  const chess = new Chess()
  chess.loadPgn(pgn)
  const header = chess.getHeaders()
  const verbose = chess.history({ verbose: true })
  const fens = [verbose.length ? verbose[0].before : chess.fen(), ...verbose.map(m => m.after)]
  return {
    white: header.White ?? 'Weiß',
    black: header.Black ?? 'Schwarz',
    result: header.Result ?? '*',
    event: header.Event ?? '',
    sans: verbose.map(m => m.san),
    fens,
  }
}

export function gameFromSans(sans: string[], meta: Partial<GameRecord> = {}): GameRecord {
  const chess = new Chess()
  const fens = [chess.fen()]
  const played: string[] = []
  for (const san of sans) {
    chess.move(san)
    played.push(san)
    fens.push(chess.fen())
  }
  return {
    white: meta.white ?? 'Weiß',
    black: meta.black ?? 'Schwarz',
    result: meta.result ?? '*',
    event: meta.event ?? '',
    sans: played,
    fens,
  }
}

/** Apply a sequence of UCI moves (e.g. an engine PV) to a FEN, returning each resulting FEN. */
export function applyUci(fen: string, uciMoves: string[]): { fens: string[]; sans: string[] } {
  const chess = new Chess(fen)
  const fens: string[] = []
  const sans: string[] = []
  for (const uci of uciMoves) {
    try {
      const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined })
      fens.push(chess.fen())
      sans.push(move.san)
    } catch {
      break
    }
  }
  return { fens, sans }
}
