import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')
  if (!query) return NextResponse.json({ items: [] })

  const res = await fetch(
    `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${process.env.ALADIN_API_KEY}&Query=${encodeURIComponent(query)}&QueryType=Title&MaxResults=5&SearchTarget=Book&output=js&Version=20131101`
  )
  const data = await res.json()
  const items = (data.item || []).map((item: any) => ({
    title: item.title,
    subtitle: item.author,
    cover: item.cover,
    year: item.pubDate ? parseInt(item.pubDate.slice(0, 4)) : new Date().getFullYear(),
  }))
  return NextResponse.json({ items })
}
