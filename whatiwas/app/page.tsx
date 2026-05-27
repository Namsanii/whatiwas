'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const categories = ['Books', 'Music', 'Movies'] as const
type Category = typeof categories[number]

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
  season: string
  url: string
}

export default function Home() {
  const [items, setItems] = useState<Item[]>([])
  const [photos, setPhotos] = useState<SeasonPhoto[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showPhotoForm, setShowPhotoForm] = useState(false)
  const [activeCategory, setActiveCategory] = useState<Category>('Books')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [memo, setMemo] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [photoYear, setPhotoYear] = useState(new Date().getFullYear())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingMemo, setEditingMemo] = useState('')
  const [uploading, setUploading] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)
  const [detailItem, setDetailItem] = useState<Item | null>(null)
  const photoFileInputRef = useRef<HTMLInputElement>(null)

  const allYears = [...new Set([
    ...items.map(i => Number(i.year)),
    ...photos.map(p => Number(p.year))
  ])].sort((a, b) => b - a)

  useEffect(() => { fetchItems(); fetchPhotos() }, [])

  const fetchItems = async () => {
    const { data } = await supabase.from('items').select('*').order('year', { ascending: false })
    if (data) setItems(data.map((i: any) => ({ ...i, year: parseInt(i.year) })) as Item[])
  }

  const fetchPhotos = async () => {
    const { data } = await supabase.from('season_photos').select('*').order('id', { ascending: true })
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
    const count = items.filter(i => i.category === activeCategory && Number(i.year) === year).length
    if (count >= 5) {
      alert(`You can only add up to 5 ${activeCategory} per year.`)
      return
    }
    const { data } = await supabase.from('items').insert({
      title: selected.title,
      subtitle: selected.subtitle,
      cover: selected.cover,
      year,
      category: activeCategory,
      memo,
    }).select()
    if (data) setItems(prev => [...prev, { ...data[0], year: parseInt(data[0].year) } as Item])
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
    setDetailItem(null)
  }

  const deletePhoto = async (id: string) => {
    await supabase.from('season_photos').delete().eq('id', id)
    setPhotos(prev => prev.filter(p => p.id !== id))
  }

  const saveMemo = async (id: string) => {
    await supabase.from('items').update({ memo: editingMemo }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, memo: editingMemo } : i))
    if (detailItem?.id === id) setDetailItem(prev => prev ? { ...prev, memo: editingMemo } : null)
    setEditingId(null)
  }

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const yearPhotos = photos.filter(p => Number(p.year) === photoYear)
    if (yearPhotos.length >= 5) {
      alert('You can only add up to 5 photos per year.')
      return
    }
    setUploading(true)
    const slot = yearPhotos.length + 1
    const path = `public/${photoYear}/photo_${slot}.jpg`
    const { error } = await supabase.storage.from('photo').upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('photo').getPublicUrl(path)
      const url = urlData.publicUrl
      const { data } = await supabase.from('season_photos').insert({ year: photoYear, season: `photo_${slot}`, url }).select()
      if (data) setPhotos(prev => [...prev, data[0] as SeasonPhoto])
    }
    setUploading(false)
    setShowPhotoForm(false)
    if (photoFileInputRef.current) photoFileInputRef.current.value = ''
  }

  const getPlaceholder = (cat: Category) => {
    if (cat === 'Books') return 'Year you read it'
    if (cat === 'Music') return 'Year you listened to it'
    return 'Year you watched it'
  }

  return (
    <main className="min-h-screen bg-[#f7f6f3]">
      <div className="max-w-2xl mx-auto px-6 py-12">

        <div className="mb-8">
          <h1 className="text-xl font-medium tracking-tight text-[#1a1a1a]">whatiwas</h1>
          <p className="text-xs text-[#999] mt-1">A personal archive of taste across the years.</p>
        </div>

        <div className="flex gap-3 mb-8 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setYear(new Date().getFullYear()); setShowForm(true) }}
              className="text-xs px-4 py-2 rounded-full border border-[#ddd] text-[#555] hover:border-[#999] hover:text-[#1a1a1a] transition-colors"
            >
              + {cat}
            </button>
          ))}
          <button
            onClick={() => setShowPhotoForm(true)}
            className="text-xs px-4 py-2 rounded-full border border-[#ddd] text-[#555] hover:border-[#999] hover:text-[#1a1a1a] transition-colors"
          >
            + Photo
          </button>
        </div>

        <div className="border-t border-[#e5e5e5] mb-10" />

        <input ref={photoFileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFileChange} />

        {allYears.length === 0 && (
          <div className="text-sm text-[#bbb] py-8 text-center">Start by adding a book, song, or movie.</div>
        )}

        {allYears.map(y => (
          <div key={y} className="mb-16">
            <div className="text-lg font-medium text-[#1a1a1a] mb-6">{y}</div>

            {photos.filter(p => Number(p.year) === y).length > 0 && (
              <div className="flex gap-2 mb-8 flex-wrap">
                {photos.filter(p => Number(p.year) === y).map(photo => (
                  <div key={photo.id} className="relative group w-24 h-24 rounded-lg overflow-hidden cursor-pointer" onClick={() => setLightboxPhoto(photo.url)}>
                    <img src={photo.url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={(e) => { e.stopPropagation(); deletePhoto(photo.id) }}
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-6">
              {categories.map(cat => (
                <div key={cat}>
                  <div className="text-xs font-medium text-[#1a1a1a] mb-3">{cat}</div>
                  <div className="space-y-2">
                    {items.filter(i => i.category === cat && Number(i.year) === y).map(item => (
                      <div key={item.id} className="group cursor-pointer" onClick={() => setDetailItem(item)}>
                        <div className="flex gap-2 items-start">
                          {item.cover && <img src={item.cover} alt="" className="w-6 h-9 object-cover rounded flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-[#1a1a1a] truncate">{item.title}</div>
                            <div className="text-xs text-[#999] truncate">{item.subtitle}</div>
                            {item.memo && <div className="text-xs text-[#777] italic mt-0.5 truncate">{item.memo}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {items.filter(i => i.category === cat && Number(i.year) === y).length === 0 && (
                      <div className="text-xs text-[#ddd]">—</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* 사진 라이트박스 */}
        {lightboxPhoto && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setLightboxPhoto(null)}>
            <img src={lightboxPhoto} alt="" className="max-w-full max-h-full object-contain rounded-lg" style={{ maxWidth: '90vw', maxHeight: '90vh' }} />
          </div>
        )}

        {/* 콘텐츠 상세 팝업 */}
        {detailItem && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => { setDetailItem(null); setEditingId(null) }}>
            <div className="bg-white w-full max-w-md rounded-2xl p-6 mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-4 items-start">
                  {detailItem.cover && <img src={detailItem.cover} alt="" className="w-16 h-24 object-cover rounded-lg" />}
                  <div>
                    <div className="text-sm font-medium text-[#1a1a1a]">{detailItem.title}</div>
                    <div className="text-xs text-[#999] mt-1">{detailItem.subtitle}</div>
                    <div className="text-xs text-[#bbb] mt-1">{detailItem.category} · {detailItem.year}</div>
                  </div>
                </div>
                <button onClick={() => { setDetailItem(null); setEditingId(null) }} className="text-[#999] text-xs">✕</button>
              </div>

              {editingId === detailItem.id ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full text-sm bg-[#f7f6f3] rounded-lg px-3 py-2 outline-none resize-none"
                    rows={3}
                    value={editingMemo}
                    onChange={e => setEditingMemo(e.target.value)}
                    autoFocus
                    placeholder="Add a note..."
                  />
                  <div className="flex gap-2">
                    <button onClick={() => saveMemo(detailItem.id)} className="flex-1 text-sm bg-[#1a1a1a] text-white rounded-lg py-2">Save</button>
                    <button onClick={() => setEditingId(null)} className="flex-1 text-sm text-[#999] rounded-lg py-2 border border-[#e5e5e5]">Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  {detailItem.memo ? (
                    <div className="text-sm text-[#555] italic mb-3 bg-[#f7f6f3] rounded-lg px-3 py-2">{detailItem.memo}</div>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingId(detailItem.id); setEditingMemo(detailItem.memo || '') }}
                      className="flex-1 text-xs text-[#555] rounded-lg py-2 border border-[#e5e5e5] hover:bg-[#f7f6f3]"
                    >
                      {detailItem.memo ? 'Edit note' : '+ Add note'}
                    </button>
                    <button
                      onClick={() => deleteItem(detailItem.id)}
                      className="text-xs text-[#ccc] hover:text-red-400 rounded-lg py-2 px-3 border border-[#e5e5e5]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 콘텐츠 추가 모달 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
            <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-3 mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">Add to {activeCategory}</span>
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

        {/* 사진 추가 모달 */}
        {showPhotoForm && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setShowPhotoForm(false)}>
            <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-3 mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">Add Photo</span>
                <button onClick={() => setShowPhotoForm(false)} className="text-[#999] text-xs">Cancel</button>
              </div>
              <input
                type="number"
                className="w-full text-sm bg-[#f7f6f3] rounded-lg px-3 py-2 outline-none"
                placeholder="Year"
                value={photoYear}
                onChange={e => setPhotoYear(parseInt(e.target.value))}
              />
              <button
                onClick={() => photoFileInputRef.current?.click()}
                className="w-full text-sm bg-[#1a1a1a] text-white rounded-lg py-2"
              >
                {uploading ? 'Uploading...' : 'Choose Photo'}
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}