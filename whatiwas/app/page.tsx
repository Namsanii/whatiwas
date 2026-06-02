'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

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
  month: number
  day: number
  category: Category
  memo: string
  user_id: string
  created_at: string
}

type SeasonPhoto = {
  id: string
  year: number
  season: string
  url: string
  user_id: string
}

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Item[]>([])
  const [photos, setPhotos] = useState<SeasonPhoto[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showPhotoForm, setShowPhotoForm] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [activeCategory, setActiveCategory] = useState<Category>('Books')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [memo, setMemo] = useState('')
  const [photoYear, setPhotoYear] = useState(new Date().getFullYear())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingMemo, setEditingMemo] = useState('')
  const [uploading, setUploading] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)
  const [detailItem, setDetailItem] = useState<Item | null>(null)
  const photoFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) { fetchItems(); fetchPhotos() }
  }, [session])

  const fetchItems = async () => {
    const { data } = await supabase.from('items').select('*').order('created_at', { ascending: false })
    if (data) setItems(data as Item[])
  }

  const fetchPhotos = async () => {
    const { data } = await supabase.from('season_photos').select('*').order('id', { ascending: true })
    if (data) setPhotos(data as SeasonPhoto[])
  }

  const allYears = [...new Set(items.map(i => new Date(i.created_at).getFullYear()))].sort((a, b) => b - a)

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
    if (!selected || !session) return
    const now = new Date()
    const { data } = await supabase.from('items').insert({
      title: selected.title,
      subtitle: selected.subtitle,
      cover: selected.cover,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      category: activeCategory,
      memo,
      user_id: session.user.id,
    }).select()
    if (data) setItems(prev => [data[0] as Item, ...prev])
    setShowForm(false)
    setQuery('')
    setResults([])
    setSelected(null)
    setMemo('')
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
    if (!file || !session) return
    const yearPhotos = photos.filter(p => Number(p.year) === photoYear)
    if (yearPhotos.length >= 5) {
      alert('You can only add up to 5 photos per year.')
      return
    }
    setUploading(true)
    const slot = yearPhotos.length + 1
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `public/${session.user.id}/${photoYear}/photo_${slot}.${ext}`
    const { error } = await supabase.storage.from('photo').upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('photo').getPublicUrl(path)
      const url = urlData.publicUrl
      const { data } = await supabase.from('season_photos').insert({ year: photoYear, season: `photo_${slot}`, url, user_id: session.user.id }).select()
      if (data) setPhotos(prev => [...prev, data[0] as SeasonPhoto])
    }
    setUploading(false)
    setShowPhotoForm(false)
    if (photoFileInputRef.current) photoFileInputRef.current.value = ''
  }

  const formatDate = (item: Item) => {
    if (item.created_at) {
      const d = new Date(item.created_at)
      return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`
    }
    return `${item.year}`
  }

  if (loading) return <div className="min-h-screen bg-[#f7f6f3] flex items-center justify-center"><div className="text-sm text-[#999]">Loading...</div></div>

  if (!session) return (
    <div className="min-h-screen bg-[#f7f6f3] flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm mx-4 shadow-sm">
        <h1 className="text-xl font-medium text-[#1a1a1a] mb-1">whatiwas</h1>
        <p className="text-xs text-[#999] mb-6">A personal archive of taste across the years.</p>
        <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} providers={['google']} onlyThirdPartyProviders queryParams={{ access_type: 'offline', prompt: 'select_account' }} />
      </div>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#f7f6f3] pb-20">
      <div className="max-w-2xl mx-auto px-6 py-12">

        <div className="mb-8">
          <h1 className="text-xl font-medium tracking-tight text-[#1a1a1a]">whatiwas</h1>
          <p className="text-xs text-[#999] mt-1">A personal archive of taste across the years.</p>
        </div>

        <div className="flex gap-3 mb-8 flex-wrap">
          {categories.map(cat => (
            <button key={cat} onClick={() => { setActiveCategory(cat); setShowForm(true) }} className="text-xs px-4 py-2 rounded-full border border-[#ddd] text-[#555] hover:border-[#999] hover:text-[#1a1a1a] transition-colors">
              + {cat}
            </button>
          ))}
          <button onClick={() => setShowPhotoForm(true)} className="text-xs px-4 py-2 rounded-full border border-[#ddd] text-[#555] hover:border-[#999] hover:text-[#1a1a1a] transition-colors">
            + Photo
          </button>
        </div>

        <div className="border-t border-[#e5e5e5] mb-10" />

        <input ref={photoFileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFileChange} />

        {items.length === 0 && photos.length === 0 && (
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
                    <button onClick={(e) => { e.stopPropagation(); deletePhoto(photo.id) }} className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">×</button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-6">
              {categories.map(cat => (
                <div key={cat}>
                  <div className="text-xs font-medium text-[#1a1a1a] mb-3">{cat}</div>
                  <div className="space-y-3">
                    {items.filter(i => i.category === cat && new Date(i.created_at).getFullYear() === y).map(item => (
                      <div key={item.id} className="group cursor-pointer" onClick={() => setDetailItem(item)}>
                        <div className="flex gap-2 items-start">
                          {item.cover && <img src={item.cover} alt="" className="w-6 h-9 object-cover rounded flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-[#1a1a1a] truncate">{item.title}</div>
                            <div className="text-xs text-[#999] truncate">{item.subtitle}</div>
                            <div className="text-xs text-[#bbb] mt-0.5">{formatDate(item)}</div>
                            {item.memo && <div className="text-xs text-[#777] italic mt-0.5 truncate">{item.memo}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {items.filter(i => i.category === cat && new Date(i.created_at).getFullYear() === y).length === 0 && (
                      <div className="text-xs text-[#ddd]">—</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e5e5e5] px-6 py-3 flex justify-between items-center">
        <span className="text-xs text-[#999]">whatiwas</span>
        <button onClick={() => setShowProfile(true)} className="flex items-center gap-2">
          {session.user.user_metadata?.picture && (
            <img src={session.user.user_metadata.picture} alt="" className="w-7 h-7 rounded-full" />
          )}
          <span className="text-xs text-[#555]">{session.user.user_metadata?.name || session.user.email}</span>
        </button>
      </div>

      {showProfile && (
        <div className="fixed inset-0 bg-black/20 flex items-end justify-center z-50" onClick={() => setShowProfile(false)}>
          <div className="bg-white w-full max-w-xl rounded-t-2xl p-6 mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              {session.user.user_metadata?.picture && (
                <img src={session.user.user_metadata.picture} alt="" className="w-12 h-12 rounded-full" />
              )}
              <div>
                <div className="text-sm font-medium text-[#1a1a1a]">{session.user.user_metadata?.name}</div>
                <div className="text-xs text-[#999]">{session.user.email}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-[#f7f6f3] rounded-xl py-3">
                <div className="text-lg font-medium text-[#1a1a1a]">{items.filter(i => i.category === 'Books').length}</div>
                <div className="text-xs text-[#999]">Books</div>
              </div>
              <div className="bg-[#f7f6f3] rounded-xl py-3">
                <div className="text-lg font-medium text-[#1a1a1a]">{items.filter(i => i.category === 'Music').length}</div>
                <div className="text-xs text-[#999]">Music</div>
              </div>
              <div className="bg-[#f7f6f3] rounded-xl py-3">
                <div className="text-lg font-medium text-[#1a1a1a]">{items.filter(i => i.category === 'Movies').length}</div>
                <div className="text-xs text-[#999]">Movies</div>
              </div>
            </div>
            <button onClick={() => { supabase.auth.signOut(); setShowProfile(false) }} className="w-full text-sm text-[#999] py-3 border border-[#e5e5e5] rounded-xl hover:bg-[#f7f6f3]">
              Sign out
            </button>
          </div>
        </div>
      )}

      {lightboxPhoto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setLightboxPhoto(null)}>
          <img src={lightboxPhoto} alt="" className="max-w-full max-h-full object-contain rounded-lg" style={{ maxWidth: '90vw', maxHeight: '90vh' }} />
        </div>
      )}

      {detailItem && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => { setDetailItem(null); setEditingId(null) }}>
          <div className="bg-white w-full max-w-md rounded-2xl p-6 mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex gap-4 items-start">
                {detailItem.cover && <img src={detailItem.cover} alt="" className="w-16 h-24 object-cover rounded-lg" />}
                <div>
                  <div className="text-sm font-medium text-[#1a1a1a]">{detailItem.title}</div>
                  <div className="text-xs text-[#999] mt-1">{detailItem.subtitle}</div>
                  <div className="text-xs text-[#bbb] mt-1">{detailItem.category} · {formatDate(detailItem)}</div>
                </div>
              </div>
              <button onClick={() => { setDetailItem(null); setEditingId(null) }} className="text-[#999] text-xs">✕</button>
            </div>
            {editingId === detailItem.id ? (
              <div className="space-y-2">
                <textarea className="w-full text-sm bg-[#f7f6f3] rounded-lg px-3 py-2 outline-none resize-none" rows={3} value={editingMemo} onChange={e => setEditingMemo(e.target.value)} autoFocus placeholder="Add a note..." />
                <div className="flex gap-2">
                  <button onClick={() => saveMemo(detailItem.id)} className="flex-1 text-sm bg-[#1a1a1a] text-white rounded-lg py-2">Save</button>
                  <button onClick={() => setEditingId(null)} className="flex-1 text-sm text-[#999] rounded-lg py-2 border border-[#e5e5e5]">Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                {detailItem.memo && <div className="text-sm text-[#555] italic mb-3 bg-[#f7f6f3] rounded-lg px-3 py-2">{detailItem.memo}</div>}
                <div className="flex gap-2">
                  <button onClick={() => { setEditingId(detailItem.id); setEditingMemo(detailItem.memo || '') }} className="flex-1 text-xs text-[#555] rounded-lg py-2 border border-[#e5e5e5] hover:bg-[#f7f6f3]">
                    {detailItem.memo ? 'Edit note' : '+ Add note'}
                  </button>
                  <button onClick={() => deleteItem(detailItem.id)} className="text-xs text-[#ccc] hover:text-red-400 rounded-lg py-2 px-3 border border-[#e5e5e5]">Delete</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-3 mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">Add to {activeCategory}</span>
              <button onClick={() => setShowForm(false)} className="text-[#999] text-xs">Cancel</button>
            </div>
            <div className="flex gap-2">
              <input className="flex-1 text-sm bg-[#f7f6f3] rounded-lg px-3 py-2 outline-none placeholder:text-[#bbb]" placeholder="Search..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
              <button onClick={search} className="text-sm bg-[#1a1a1a] text-white rounded-lg px-4 py-2">{searching ? '...' : 'Search'}</button>
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
                <div className="text-xs text-[#999] px-1">Will be saved as {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
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

      {showPhotoForm && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setShowPhotoForm(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-3 mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">Add Photo</span>
              <button onClick={() => setShowPhotoForm(false)} className="text-[#999] text-xs">Cancel</button>
            </div>
            <input type="number" className="w-full text-sm bg-[#f7f6f3] rounded-lg px-3 py-2 outline-none" placeholder="Year" value={photoYear} onChange={e => setPhotoYear(parseInt(e.target.value))} />
            <button onClick={() => photoFileInputRef.current?.click()} className="w-full text-sm bg-[#1a1a1a] text-white rounded-lg py-2">
              {uploading ? 'Uploading...' : 'Choose Photo'}
            </button>
          </div>
        </div>
      )}

    </main>
  )
}