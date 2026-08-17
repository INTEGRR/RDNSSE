import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params
  if (!/^[a-zA-Z0-9_-]{2,30}$/.test(username)) {
    return NextResponse.json({ error: 'Ungültiger Nutzername' }, { status: 400 })
  }
  const res = await fetch(
    `https://lichess.org/api/games/user/${username}?max=30&moves=true`,
    { headers: { Accept: 'application/x-ndjson' }, cache: 'no-store' },
  )
  if (!res.ok) {
    return NextResponse.json({ error: 'Spieler nicht gefunden' }, { status: res.status })
  }
  const ndjson = await res.text()
  return new NextResponse(ndjson, { headers: { 'Content-Type': 'application/x-ndjson' } })
}
