import type { LatLng } from './geo'

export interface Stand extends LatLng {
  id: string
  name: string
  note?: string
}

export interface EventInfo {
  name: string
  date: string
  start: string
  end: string
  listUrl?: string
}

export interface StandsFile {
  event: EventInfo
  demo?: boolean
  stands: Stand[]
}

export async function loadStands(): Promise<StandsFile> {
  const res = await fetch('/stands.json', { cache: 'no-cache' })
  if (!res.ok) throw new Error('stands.json nicht ladbar')
  return res.json()
}

const VISITED_KEY = 'troedelradar.visited'

export function loadVisited(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(VISITED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

export function saveVisited(v: Set<string>) {
  try {
    localStorage.setItem(VISITED_KEY, JSON.stringify([...v]))
  } catch {
    // storage unavailable (private mode) — visited state stays in memory
  }
}
