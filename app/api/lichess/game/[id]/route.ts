import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!/^[a-zA-Z0-9]{8,12}$/.test(id)) {
    return NextResponse.json({ error: 'Ungültige Partie-ID' }, { status: 400 })
  }
  const res = await fetch(`https://lichess.org/game/export/${id}?evals=0&clocks=0`, {
    headers: { Accept: 'application/x-chess-pgn' },
    cache: 'no-store',
  })
  if (!res.ok) {
    return NextResponse.json({ error: 'Partie nicht gefunden' }, { status: res.status })
  }
  const pgn = await res.text()
  return new NextResponse(pgn, { headers: { 'Content-Type': 'application/x-chess-pgn' } })
}
