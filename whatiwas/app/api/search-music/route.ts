import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')
  if (!query) return NextResponse.json({ items: [] })

  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=5`
  )
  const data = await res.json()
  const items = (data.results || []).map((t: any) => ({
    title: t.trackName,
    subtitle: t.artistName,
    cover: t.artworkUrl100,
  }))
  return NextResponse.json({ items })
}
