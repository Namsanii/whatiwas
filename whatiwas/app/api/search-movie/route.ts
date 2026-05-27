import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')
  if (!query) return NextResponse.json({ items: [] })

  const res = await fetch(
    `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&api_key=${process.env.TMDB_API_KEY}&language=ko-KR&page=1`
  )
  const data = await res.json()
  const items = (data.results || []).slice(0, 5).map((m: any) => ({
    title: m.title,
    subtitle: m.release_date ? m.release_date.slice(0, 4) : '',
    cover: m.poster_path ? `https://image.tmdb.org/t/p/w200${m.poster_path}` : '',
  }))
  return NextResponse.json({ items })
}
