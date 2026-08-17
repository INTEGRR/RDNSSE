'use client'

import type { ReactNode } from 'react'
import { Analysis, SquareScore, SupportNode, sq, sqCoords } from '@/lib/analysis'
import { PIECE_SVG } from '@/lib/pieces'

const S = 64
const M = 26
const BOARD = 8 * S
const VIEW = BOARD + 2 * M

export interface BoardProps {
  analysis: Analysis
  scores: Map<string, SquareScore>
  heatmap: boolean
  fragility: boolean
  tension: boolean
  selected: string | null
  support: Map<string, SupportNode>
  legalTargets: string[]
  lastMove: { from: string; to: string } | null
  flipped: boolean
  onSquareClick: (square: string) => void
  onHover: (square: string | null) => void
}

function heatColor(score: number): string {
  // diverging: blue = white controls, red = black controls, neutral = bare board
  return score > 0 ? '#3987e5' : '#e66767'
}

export default function Board(props: BoardProps) {
  const { analysis, scores, heatmap, fragility, tension, selected, support, legalTargets, lastMove, flipped, onSquareClick, onHover } = props

  const xy = (square: string): [number, number] => {
    const [f, r] = sqCoords(square)
    const x = M + (flipped ? 7 - f : f) * S
    const y = M + (flipped ? r : 7 - r) * S
    return [x, y]
  }
  const center = (square: string): [number, number] => {
    const [x, y] = xy(square)
    return [x + S / 2, y + S / 2]
  }

  let maxAbs = 0
  for (const s of scores.values()) maxAbs = Math.max(maxAbs, Math.abs(s.score))
  let maxCentrality = 0
  for (const c of analysis.centrality.values()) maxCentrality = Math.max(maxCentrality, c)

  const squares = []
  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      const name = sq(f, r)
      const [x, y] = xy(name)
      const dark = (f + r) % 2 === 0
      const score = scores.get(name)!
      const intensity = maxAbs > 0 ? Math.abs(score.score) / maxAbs : 0
      squares.push(
        <g key={name}>
          <rect x={x} y={y} width={S} height={S} fill={dark ? 'var(--sq-dark)' : 'var(--sq-light)'} />
          {lastMove && (lastMove.from === name || lastMove.to === name) && (
            <rect x={x} y={y} width={S} height={S} fill="#eda100" opacity={0.18} />
          )}
          {heatmap && intensity > 0.001 && (
            <rect
              x={x + 2} y={y + 2} width={S - 4} height={S - 4} rx={5}
              fill={heatColor(score.score)}
              opacity={0.1 + 0.5 * intensity}
            />
          )}
          {heatmap && tension && score.contested && (
            <path
              d={`M ${x + S - 13} ${y + 7} l 6 0 l 0 6`}
              stroke="var(--ink-soft)" strokeWidth={2.5} fill="none" strokeLinecap="round"
            />
          )}
        </g>,
      )
    }
  }

  const coords = []
  for (let i = 0; i < 8; i++) {
    const file = 'abcdefgh'[flipped ? 7 - i : i]
    const rank = flipped ? i + 1 : 8 - i
    coords.push(
      <text key={'f' + i} x={M + i * S + S / 2} y={VIEW - 7} className="coord">{file}</text>,
      <text key={'r' + i} x={M / 2} y={M + i * S + S / 2 + 4} className="coord">{rank}</text>,
    )
  }

  // fragility halos (betweenness centrality)
  const halos = fragility
    ? analysis.pieces
        .filter(p => (analysis.centrality.get(p.square) ?? 0) > 0.001)
        .map(p => {
          const c = analysis.centrality.get(p.square)!
          const rel = maxCentrality > 0 ? c / maxCentrality : 0
          const [cx, cy] = center(p.square)
          return (
            <circle
              key={'halo' + p.square}
              cx={cx} cy={cy} r={S * 0.28 + rel * S * 0.2}
              fill="none" stroke="#9085e9" strokeWidth={2 + rel * 2.5}
              opacity={0.25 + rel * 0.55} strokeDasharray="3 5" strokeLinecap="round"
            />
          )
        })
    : []

  // arrows for the selected piece: defenders (green, by depth) and attackers (red)
  const arrows: ReactNode[] = []
  if (selected && analysis.pieceAt.has(selected)) {
    const piece = analysis.pieceAt.get(selected)!
    for (const node of support.values()) {
      for (const via of node.via) {
        const [x1, y1] = center(node.square)
        const [x2, y2] = center(via)
        arrows.push(
          <Arrow
            key={`d${node.square}->${via}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            color="#17b26a"
            width={node.depth === 1 ? 5 : node.depth === 2 ? 3.5 : 2.5}
            opacity={node.depth === 1 ? 0.9 : node.depth === 2 ? 0.6 : 0.4}
            marker="arrow-def"
          />,
        )
      }
    }
    const enemies = analysis.control.get(selected)![piece.color === 'w' ? 'b' : 'w']
    for (const a of enemies) {
      const [x1, y1] = center(a.from)
      const [x2, y2] = center(selected)
      arrows.push(
        <Arrow
          key={`a${a.from}`}
          x1={x1} y1={y1} x2={x2} y2={y2}
          color="#e34948" width={a.xray ? 2.5 : 5} opacity={a.xray ? 0.45 : 0.9}
          dash={a.xray ? '6 6' : undefined}
          marker="arrow-att"
        />,
      )
    }
  }

  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="board" role="img" aria-label="Schachbrett mit Kontroll-Heatmap">
      <defs>
        <marker id="arrow-def" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#17b26a" />
        </marker>
        <marker id="arrow-att" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#e34948" />
        </marker>
      </defs>
      <rect x={0} y={0} width={VIEW} height={VIEW} rx={10} fill="var(--board-frame)" />
      {squares}
      {coords}
      {halos}
      {selected && analysis.pieceAt.has(selected) && (() => {
        const [x, y] = xy(selected)
        return <rect x={x + 1.5} y={y + 1.5} width={S - 3} height={S - 3} rx={6} fill="none" stroke="#eda100" strokeWidth={3} />
      })()}
      {analysis.pieces.map(p => {
        const [x, y] = xy(p.square)
        const svg = PIECE_SVG[(p.color === 'w' ? 'w' : 'b') + p.type.toUpperCase()]
        return (
          <g key={p.square + p.color + p.type} transform={`translate(${x + 2}, ${y + 2}) scale(${(S - 4) / 45})`} dangerouslySetInnerHTML={{ __html: svg }} />
        )
      })}
      {arrows}
      {legalTargets.map(t => {
        const [cx, cy] = center(t)
        const isCapture = analysis.pieceAt.has(t)
        return isCapture ? (
          <circle key={'t' + t} cx={cx} cy={cy} r={S * 0.44} fill="none" stroke="#eda100" strokeWidth={3.5} opacity={0.75} />
        ) : (
          <circle key={'t' + t} cx={cx} cy={cy} r={7.5} fill="#eda100" opacity={0.75} />
        )
      })}
      {/* hit targets on top */}
      {Array.from({ length: 64 }, (_, i) => {
        const name = sq(i % 8, Math.floor(i / 8))
        const [x, y] = xy(name)
        return (
          <rect
            key={'hit' + name}
            x={x} y={y} width={S} height={S} fill="transparent"
            style={{ cursor: 'pointer' }}
            onClick={() => onSquareClick(name)}
            onMouseEnter={() => onHover(name)}
            onMouseLeave={() => onHover(null)}
          />
        )
      })}
    </svg>
  )
}

function Arrow(props: { x1: number; y1: number; x2: number; y2: number; color: string; width: number; opacity: number; marker: string; dash?: string }) {
  const { x1, y1, x2, y2, color, width, opacity, marker, dash } = props
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  // shorten both ends so arrows don't sit on top of the pieces
  const t0 = 14 / len
  const t1 = (len - 20) / len
  return (
    <line
      x1={x1 + dx * t0} y1={y1 + dy * t0}
      x2={x1 + dx * t1} y2={y1 + dy * t1}
      stroke={color} strokeWidth={width} opacity={opacity}
      strokeLinecap="round" strokeDasharray={dash}
      markerEnd={`url(#${marker})`}
    />
  )
}
