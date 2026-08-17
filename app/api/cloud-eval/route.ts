import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const fen = req.nextUrl.searchParams.get('fen')
  const multiPv = Math.min(parseInt(req.nextUrl.searchParams.get('multiPv') ?? '3', 10) || 3, 5)
  if (!fen) {
    return NextResponse.json({ error: 'FEN fehlt' }, { status: 400 })
  }
  const res = await fetch(
    `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=${multiPv}`,
    { cache: 'no-store' },
  )
  if (!res.ok) {
    return NextResponse.json({ error: 'Keine Cloud-Bewertung für diese Stellung' }, { status: res.status })
  }
  return NextResponse.json(await res.json())
}
