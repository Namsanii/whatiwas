'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const categories = ['Books', 'Music', 'Movies'] as const
type Category = typeof categories[number]
const seasons = ['Spring', 'Summer', 'Fall', 'Winter'] as const
type Season = typeof seasons[number]

type Item = {
  id: string
  title: string
  subtitle: string
  cover?: string
  year: number
  category: Category
  memo: string
}

type SeasonPhoto = {
  id: string
  year: number
  season: Season
  url: string
}

export default function Home() {
  const [items, setItems] = useState<Item[]>([])
  const [photos, setPhotos] = useState<SeasonPhoto[]>([])
  const [showForm, setShowForm] = useState(false)
  const [activeCategory, setActiveCategory] = useState<Category>('Books')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [memo, setMemo] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingMemo, setEditingMemo] = useState('')
  const [uploading, setUploading] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingUpload, setPendingUpload] = useState<{year: number, season: Season} | null>(null)

  const allYears = [...new Set([
    ...items.map(i => Number(i.year)),
    ...photos.map(p => Number(p.year))
  ])].sort((a, b) => b - a)

  useEffect(() => { fetchItems(); fetchPhotos() }, [])

  const fetchItems = async () => {
    const { data } = await supabase.from('items').select('*').order('year', { ascending: false })
    if (data) setItems(data as Item[])
  }

  const fetchPhotos = async () => {
    const { data } = await supabase.from('season_photos').select('*')
    if (data) setPhotos(data as SeasonPhoto[])
  }

  const search = async () => {
    if (!query) return
    setSearching(true)
    setResults([])
    setSelected(null)
    const endpoint = activeCategory === 'Music' ? '/api/search-music' : activeCategory === 'Movies' ? '/api/search-movie' : '/api/search'
    const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`)
    const data = await res.json()
    setResults(data.items || [])
    setSearching(false)
  }

  const addItem = async () => {
    if (!selected) return
    const { data } = await supabase.from('items').insert({
      title: selected.title,
      subtitle: selected.subtitle,
      cover: selected.cover,
      year,
      category: activeCategory,
      memo,
    }).select()
    if (data) setItems(prev => [...prev, data[0] as Item])
    setShowForm(false)
    setQuery('')
    setResults([])
    setSelected(null)
    setMemo('')
    setYear(new Date().getFullYear())
  }

  const deleteItem = async (id: string) => {
    await supabase.from('items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const saveMemo = async (id: string) => {
    await supabase.from('items').update({ memo: editingMemo }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, memo: editingMemo } : i))
    setEditingId(null)
  }

  const uploadPhoto = async (file: File, year: number, season: Season) => {
    setUploading(`${year}-${season}`)
    const ext = file.name.split('.').pop()
const path = `public/${year}/${season}.jpg`
    const { error } = await supabase.storage.from('photo').upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('photo').getPublicUrl(path)
      const url = urlData.publicUrl
      const existing = photos.find(p => p.year === year && p.season === season)
      if (existing) {
        await supabase.from('season_photos').update({ url }).eq('id', existing.id)
        setPhotos(prev => prev.map(p => p.id === existing.id ? { ...p, url } : p))
      } else {
        const { data } = await supabase.from('season_photos').insert({ year, season, url }).select()
        if (data) setPhotos(prev => [...prev, data[0] as SeasonPhoto])
      }
    }
    setUploading(null)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pendingUpload) return
    await uploadPhoto(file, pendingUpload.year, pendingUpload.season)
    setPendingUpload(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const getYears = (cat: Category) => {
    const filtered = items.filter(i => i.category === cat)
    return [...new Set(filtered.map(i => i.year))].sort((a, b) => b - a)
  }

  const getPlaceholder = (cat: Category) => {
    if (cat === 'Books') return 'Year you read it'
    if (cat === 'Music') return 'Year you listened to it'
    return 'Year you watched it'
  }

  const getPhoto = (year: number, season: Season) => photos.find(p => p.year === year && p.season === season)

  return (
    <main className="min-h-screen bg-[#f7f6f3]">
      <div className="max-w-2xl mx-auto px-6 py-12">

        <div className="mb-12">
          <h1 className="text-xl font-medium tracking-tight text-[#1a1a1a]">whatiwas</h1>
          <p className="text-xs text-[#999] mt-1">A personal archive of taste across the years.</p>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

        {allYears.map(y => (
          <div key={y} className="mb-16">
            <div className="text-lg font-medium text-[#1a1a1a] mb-6">{y}</div>

            {/* 계절 사진 */}
            <div className="grid grid-cols-4 gap-2 mb-8">
              {seasons.map(season => {
                const photo = getPhoto(y, season)
                const isUploading = uploading === `${y}-${season}`
                return (
                  <div key={season} className="relative">
                    <div
                      className="aspect-square rounded-lg overflow-hidden bg-[#ebebeb] cursor-pointer"
                      onClick={() => { setPendingUpload({ year: y, season }); fileInputRef.current?.click() }}
                    >
                      {photo ? (
                        <img src={photo.url} alt={season} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {isUploading ? (
                            <span className="text-xs text-[#999]">...</span>
                          ) : (
                            <span className="text-xs text-[#bbb]">+</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 카테고리별 항목 */}
            <div className="grid grid-cols-3 gap-6">
              {categories.map(cat => (
                <div key={cat}>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-medium text-[#1a1a1a]">{cat}</span>
                    <button
                      onClick={() => { setActiveCategory(cat); setYear(y); setShowForm(true) }}
                      className="text-xs text-[#bbb] hover:text-[#555]"
                    >+</button>
                  </div>
                  <div className="space-y-2">
                    {items.filter(i => i.category === cat && i.year === y).map(item => (
                      <div key={item.id} className="group">
                        <div className="flex gap-2 items-start">
                          {item.cover && <img src={item.cover} alt="" className="w-6 h-9 object-cover rounded flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-[#1a1a1a] truncate">{item.title}</div>
                            <div className="text-xs text-[#999] truncate">{item.subtitle}</div>
                            {editingId === item.id ? (
                              <div className="mt-1">
                                <textarea
                                  className="w-full text-xs bg-[#f0efe9] rounded px-2 py-1 outline-none resize-none"
                                  rows={2}
                                  value={editingMemo}
                                  onChange={e => setEditingMemo(e.target.value)}
                                  autoFocus
                                />
                                <div className="flex gap-1 mt-1">
                                  <button onClick={() => saveMemo(item.id)} className="text-xs bg-[#1a1a1a] text-white rounded px-2 py-0.5">Save</button>
                                  <button onClick={() => setEditingId(null)} className="text-xs text-[#999] rounded px-2 py-0.5 border border-[#e5e5e5]">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {item.memo && <div className="text-xs text-[#777] italic mt-0.5">{item.memo}</div>}
                                <button
                                  onClick={() => { setEditingId(item.id); setEditingMemo(item.memo || '') }}
                                  className="text-xs text-[#bbb] hover:text-[#777] opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  {item.memo ? 'edit note' : '+ note'}
                                </button>
                              </>
                            )}
                          </div>
                          <button onClick={() => deleteItem(item.id)} className="text-[#ccc] hover:text-[#999] text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {allYears.length === 0 && (
          <div className="text-sm text-[#bbb] py-8 text-center">Start by adding a book, song, or movie.</div>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
            <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-3 mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">Add to {activeCategory} · {year}</span>
                <button onClick={() => setShowForm(false)} className="text-[#999] text-xs">Cancel</button>
              </div>

              <div className="flex gap-2">
                <input
                  className="flex-1 text-sm bg-[#f7f6f3] rounded-lg px-3 py-2 outline-none placeholder:text-[#bbb]"
                  placeholder="Search..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && search()}
                />
                <button onClick={search} className="text-sm bg-[#1a1a1a] text-white rounded-lg px-4 py-2">
                  {searching ? '...' : 'Search'}
                </button>
              </div>

              {results.length > 0 && !selected && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {results.map((r, i) => (
                    <div key={i} onClick={() => setSelected(r)} className="flex gap-3 items-center p-2 rounded-lg hover:bg-[#f7f6f3] cursor-pointer">
                      {r.cover && <img src={r.cover} alt="" className="w-8 h-11 object-cover rounded" />}
                      <div>
                        <div className="text-sm font-medium text-[#1a1a1a]">{r.title}</div>
                        <div className="text-xs text-[#999]">{r.subtitle}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selected && (
                <div className="space-y-3">
                  <div className="flex gap-3 items-center p-2 bg-[#f7f6f3] rounded-lg">
                    {selected.cover && <img src={selected.cover} alt="" className="w-8 h-11 object-cover rounded" />}
                    <div>
                      <div className="text-sm font-medium text-[#1a1a1a]">{selected.title}</div>
                      <div className="text-xs text-[#999]">{selected.subtitle}</div>
                    </div>
                  </div>
                  <input type="number" className="w-full text-sm bg-[#f7f6f3] rounded-lg px-3 py-2 outline-none" placeholder={getPlaceholder(activeCategory)} value={year} onChange={e => setYear(parseInt(e.target.value))} />
                  <input className="w-full text-sm bg-[#f7f6f3] rounded-lg px-3 py-2 outline-none placeholder:text-[#bbb]" placeholder="Notes (optional)" value={memo} onChange={e => setMemo(e.target.value)} />
                  <div className="flex gap-2">
                    <button onClick={addItem} className="flex-1 text-sm bg-[#1a1a1a] text-white rounded-lg py-2">Add</button>
                    <button onClick={() => setSelected(null)} className="flex-1 text-sm text-[#999] rounded-lg py-2 border border-[#e5e5e5]">Search again</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}