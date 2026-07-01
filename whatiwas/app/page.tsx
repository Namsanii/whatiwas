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
  photo_url?: string
}

type Snapshot = {
  id: string
  user_id: string
  year: number
  month: number
  items: Item[]
}

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Item[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [creatingSnapshot, setCreatingSnapshot] = useState(false)
  const [newSnapshotYear, setNewSnapshotYear] = useState(new Date().getFullYear())
  const [newSnapshotMonth, setNewSnapshotMonth] = useState(new Date().getMonth() + 1)
  const [snapshotPickIds, setSnapshotPickIds] = useState<string[]>([])

  const [activeTab, setActiveTab] = useState<'profile' | 'archive'>('profile')
  const [archiveView, setArchiveView] = useState<'list' | 'grid'>('list')
  const [showProfile, setShowProfile] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const [username, setUsername] = useState('')
  const [editingUsername, setEditingUsername] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [tasteText, setTasteText] = useState('')
  const [editingTaste, setEditingTaste] = useState(false)
  const [tasteInput, setTasteInput] = useState('')

  const [step, setStep] = useState<'idle' | 'select' | 'search' | 'confirm' | 'photo'>('idle')
  const [activeCategory, setActiveCategory] = useState<Category>('Books')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedContent, setSelectedContent] = useState<any>(null)
  const [memo, setMemo] = useState('')
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [savedItem, setSavedItem] = useState<Item | null>(null)
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [addingPhotoToItem, setAddingPhotoToItem] = useState<Item | null>(null)

  const [detailItem, setDetailItem] = useState<Item | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingMemo, setEditingMemo] = useState('')
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)

 const searchInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const archiveWheelRef = useRef<HTMLDivElement>(null)
  const archiveWheelAngle = useRef<number | null>(null)
  const [archiveIdx, setArchiveIdx] = useState(0)

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
    if (session) { fetchItems(); fetchProfile(); fetchSnapshots() }
  }, [session])

  useEffect(() => {
    if (step === 'search') setTimeout(() => searchInputRef.current?.focus(), 100)
  }, [step])

  const fetchItems = async () => {
    const { data } = await supabase.from('items').select('*').order('created_at', { ascending: false })
    if (data) setItems(data as Item[])
  }

  const fetchProfile = async () => {
    if (!session) return
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (data) {
      setUsername(data.username || '')
      setTasteText(data.taste_text || '')
    }
  }

  const fetchSnapshots = async () => {
    if (!session) return
    const { data: snapshotData } = await supabase.from('snapshots').select('*').eq('user_id', session.user.id).order('year', { ascending: false })
    if (!snapshotData) return
    const { data: allItemsData } = await supabase.from('items').select('*')
    const allItems = (allItemsData || []) as Item[]
    const result: Snapshot[] = []
    for (const s of snapshotData) {
      const { data: siData } = await supabase.from('snapshot_items').select('item_id').eq('snapshot_id', s.id)
      const itemIds = siData?.map((si: any) => String(si.item_id)) || []
      const snapshotItems = allItems.filter(i => itemIds.includes(String(i.id)))
      result.push({ ...s, items: snapshotItems })
    }
    setSnapshots(result)
  }

  const createSnapshot = async () => {
    if (!session) return
    const { data } = await supabase.from('snapshots').insert({ user_id: session.user.id, year: newSnapshotYear, month: newSnapshotMonth }).select()
    if (!data) return
    const snapshotId = data[0].id
    for (const itemId of snapshotPickIds) {
      await supabase.from('snapshot_items').insert({ snapshot_id: snapshotId, item_id: itemId, user_id: session.user.id })
    }
    const newSnapshot: Snapshot = { ...data[0], items: items.filter(i => snapshotPickIds.includes(String(i.id))) }
    setSnapshots(prev => [newSnapshot, ...prev].sort((a, b) => b.year - a.year || b.month - a.month))
    setCreatingSnapshot(false)
    setSnapshotPickIds([])
  }

  const deleteSnapshot = async (id: string) => {
    await supabase.from('snapshots').delete().eq('id', id)
    setSnapshots(prev => prev.filter(s => String(s.id) !== id))
  }

  const toggleSnapshotPick = (item: Item) => {
    const id = String(item.id)
    const cat = item.category
    const currentCat = snapshotPickIds.filter(pid => items.find(i => String(i.id) === pid)?.category === cat)
    if (snapshotPickIds.includes(id)) {
      setSnapshotPickIds(prev => prev.filter(pid => pid !== id))
    } else {
      if (currentCat.length >= 3) { alert(`${cat}는 최대 3개까지 선택할 수 있어요.`); return }
      setSnapshotPickIds(prev => [...prev, id])
    }
  }

  const saveUsername = async () => {
    if (!session || !usernameInput.trim()) return
    await supabase.from('profiles').upsert({ id: session.user.id, username: usernameInput.trim() })
    setUsername(usernameInput.trim())
    setEditingUsername(false)
  }

  const saveTaste = async () => {
    if (!session) return
    await supabase.from('profiles').upsert({ id: session.user.id, taste_text: tasteInput })
    setTasteText(tasteInput)
    setEditingTaste(false)
  }

  const search = async () => {
    if (!query.trim()) return
    setSearching(true)
    setResults([])
    const endpoint = activeCategory === 'Music' ? '/api/search-music' : activeCategory === 'Movies' ? '/api/search-movie' : '/api/search'
    const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`)
    const data = await res.json()
    setResults(data.items || [])
    setSearching(false)
  }

  const saveItem = async () => {
    if (!selectedContent || !session || saving) return
    setSaving(true)
    const now = recordDate ? new Date(recordDate) : new Date()
    const { data } = await supabase.from('items').insert({
      title: selectedContent.title, subtitle: selectedContent.subtitle, cover: selectedContent.cover,
      year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(),
      category: activeCategory, memo, user_id: session.user.id, photo_url: null, created_at: now.toISOString(),
    }).select()
    if (data) {
      const newItem = data[0] as Item
      setItems(prev => [newItem, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
      setSavedItem(newItem)
      setSavedFeedback(selectedContent.title)
      setTimeout(() => setSavedFeedback(null), 2500)
      setStep('photo')
    }
    setSaving(false)
    setQuery(''); setResults([]); setMemo(''); setSelectedContent(null)
    setRecordDate(new Date().toISOString().split('T')[0])
  }

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !session) return
    const targetItem = addingPhotoToItem || savedItem
    if (!targetItem) return
    setUploadingPhoto(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const path = `public/${session.user.id}/moment_${Date.now()}.jpg`
      const { error } = await supabase.storage.from('photo').upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (!error) {
        const { data: urlData } = supabase.storage.from('photo').getPublicUrl(path)
        const url = urlData.publicUrl
        await supabase.from('items').update({ photo_url: url }).eq('id', targetItem.id)
        setItems(prev => prev.map(i => i.id === targetItem.id ? { ...i, photo_url: url } : i))
        if (detailItem?.id === targetItem.id) setDetailItem(prev => prev ? { ...prev, photo_url: url } : null)
        setCapturedPhoto(dataUrl)
      }
      setUploadingPhoto(false)
      setAddingPhotoToItem(null)
    }
    reader.readAsDataURL(file)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const resetFlow = () => {
    setStep('idle'); setQuery(''); setResults([]); setSelectedContent(null)
    setMemo(''); setSavedItem(null); setCapturedPhoto(null)
    setRecordDate(new Date().toISOString().split('T')[0])
  }

const getArchiveAngle = (e: any, el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const touch = e.touches ? e.touches[0] : e
    return Math.atan2(touch.clientY - cy, touch.clientX - cx) * 180 / Math.PI
  }

  const onArchiveWheelStart = (e: any) => {
    archiveWheelAngle.current = getArchiveAngle(e, archiveWheelRef.current!)
  }

  const onArchiveWheelMove = (e: any) => {
    if (archiveWheelAngle.current === null) return
    const angle = getArchiveAngle(e, archiveWheelRef.current!)
    let diff = angle - archiveWheelAngle.current
    if (diff > 180) diff -= 360
    if (diff < -180) diff += 360
    if (Math.abs(diff) > 30) {
      if (diff > 0) setArchiveIdx(i => (i + 1) % items.length)
      else setArchiveIdx(i => (i - 1 + items.length) % items.length)
      archiveWheelAngle.current = angle
    }
  }

  const onArchiveWheelEnd = () => { archiveWheelAngle.current = null }

  const allYears = [...new Set(items.map(i => new Date(i.created_at).getFullYear()))].sort((a, b) => b - a)
  const formatDate = (item: Item) => {
    const d = new Date(item.created_at)
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`
  }

  const saveMemo = async (id: string) => {
    await supabase.from('items').update({ memo: editingMemo }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, memo: editingMemo } : i))
    if (detailItem?.id === id) setDetailItem(prev => prev ? { ...prev, memo: editingMemo } : null)
    setEditingId(null)
  }

  const deleteItem = async (id: string) => {
    await supabase.from('items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    setDetailItem(null)
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
    <main className="min-h-screen bg-[#f7f6f3] pb-24">

      {savedFeedback && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a] text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
          <div className="text-sm font-medium">{savedFeedback} 기록됐어요</div>
        </div>
      )}

      {creatingSnapshot && (
        <div className="fixed inset-0 bg-[#f7f6f3] z-50 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-10">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm font-medium text-[#1a1a1a]">스냅샷 추가</div>
              <button onClick={() => { setCreatingSnapshot(false); setSnapshotPickIds([]) }} className="text-xs text-[#999]">취소</button>
            </div>
            <div className="text-xs text-[#bbb] mb-6">시기를 선택하고 보여줄 것들을 골라요.</div>
            <div className="flex gap-3 mb-8">
              <select className="flex-1 text-sm bg-white rounded-xl border border-[#e5e5e5] px-3 py-2 outline-none" value={newSnapshotYear} onChange={e => setNewSnapshotYear(parseInt(e.target.value))}>
                {Array.from({length: 10}, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              <select className="flex-1 text-sm bg-white rounded-xl border border-[#e5e5e5] px-3 py-2 outline-none" value={newSnapshotMonth} onChange={e => setNewSnapshotMonth(parseInt(e.target.value))}>
                {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
              </select>
            </div>
            {categories.map(cat => {
              const catItems = items.filter(i => i.category === cat)
              if (catItems.length === 0) return null
              const selectedCount = catItems.filter(i => snapshotPickIds.includes(String(i.id))).length
              return (
                <div key={cat} className="mb-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="text-xs font-medium text-[#bbb] tracking-wider">{cat.toUpperCase()}</div>
                    <div className="text-xs text-[#bbb]">{selectedCount}/3</div>
                  </div>
                  <div className="space-y-1">
                    {catItems.map(item => {
                      const isPicked = snapshotPickIds.includes(String(item.id))
                      return (
                        <div key={item.id} onClick={() => toggleSnapshotPick(item)} className={`flex gap-3 items-center py-2 border-b border-[#ebebeb] cursor-pointer ${isPicked ? 'opacity-100' : 'opacity-50'}`}>
                          {item.cover ? <img src={item.cover} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded bg-[#f0efe9] flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-[#1a1a1a] truncate">{item.title}</div>
                            <div className="text-xs text-[#999] truncate">{item.subtitle}</div>
                          </div>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${isPicked ? 'bg-[#1a1a1a] border-[#1a1a1a]' : 'border-[#ddd]'}`}>
                            {isPicked && <div className="w-2 h-2 rounded-full bg-white"></div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <button onClick={createSnapshot} className="w-full text-sm bg-[#1a1a1a] text-white py-3 rounded-2xl font-medium">저장하기</button>
          </div>
        </div>
      )}

      {selectedYear && (
        <div className="fixed inset-0 bg-[#f7f6f3] z-50 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-10 w-full">
            <div className="flex justify-between items-center mb-8">
              <div className="text-xl font-medium text-[#1a1a1a]">{selectedYear}</div>
              <button onClick={() => setSelectedYear(null)} className="text-xs text-[#999]">닫기</button>
            </div>
            {categories.map(cat => {
              const catItems = items.filter(i => i.category === cat && new Date(i.created_at).getFullYear() === selectedYear)
              if (catItems.length === 0) return null
              return (
                <div key={cat} className="mb-10">
                  <div className="text-xs font-medium text-[#bbb] tracking-wider mb-4">{cat.toUpperCase()}</div>
                  <div className="space-y-2">
                    {catItems.map(item => (
                      <div key={item.id} className="bg-white rounded-2xl border border-[#e5e5e5] overflow-hidden cursor-pointer" onClick={() => { setSelectedYear(null); setDetailItem(item) }}>
                        {item.photo_url && <img src={item.photo_url} alt="" className="w-full h-40 object-cover" />}
                        <div className="p-4 flex gap-3 items-start">
                          {item.cover ? <img src={item.cover} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" /> : <div className="w-10 h-10 rounded bg-[#f0efe9] flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[#1a1a1a] truncate">{item.title}</div>
                            <div className="text-xs text-[#999] truncate">{item.subtitle}</div>
                            <div className="text-xs text-[#bbb] mt-1">{formatDate(item)}</div>
                            {item.memo && <div className="text-xs text-[#777] italic mt-1">"{item.memo}"</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {step === 'select' && (
        <div className="fixed inset-0 bg-black/20 flex items-end justify-center z-50" onClick={resetFlow}>
          <div className="bg-white w-full max-w-xl rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm font-medium">무엇을 기록할까요?</span>
              <button onClick={resetFlow} className="text-xs text-[#999]">취소</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {categories.map(cat => (
                <button key={cat} onClick={() => { setActiveCategory(cat); setStep('search') }} className="bg-[#f7f6f3] rounded-2xl py-6 text-sm font-medium text-[#1a1a1a] hover:bg-[#ebebeb] transition-colors">
                  <div className="text-2xl mb-2">{cat === 'Books' ? '📚' : cat === 'Music' ? '🎵' : '🎬'}</div>
                  <div>{cat}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'search' && (
        <div className="fixed inset-0 bg-[#f7f6f3] z-50 flex flex-col">
          <div className="p-6 flex flex-col gap-4 flex-1 overflow-y-auto">
            <div className="flex justify-between items-center">
              <button onClick={() => setStep('select')} className="text-xs text-[#999]">← 뒤로</button>
              <button onClick={resetFlow} className="text-xs text-[#999]">취소</button>
            </div>
            <div className="text-sm font-medium text-[#1a1a1a]">
              {activeCategory === 'Books' ? '어떤 책이에요?' : activeCategory === 'Music' ? '어떤 노래예요?' : '어떤 영화예요?'}
            </div>
            <div className="flex gap-2">
              <input ref={searchInputRef} className="flex-1 text-sm bg-white rounded-xl px-4 py-3 outline-none placeholder:text-[#bbb] border border-[#e5e5e5]" placeholder={activeCategory === 'Books' ? '책 제목...' : activeCategory === 'Music' ? '곡 제목...' : '영화 제목...'} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
              <button onClick={search} className="text-sm bg-[#1a1a1a] text-white rounded-xl px-4 py-3">{searching ? '...' : 'Search'}</button>
            </div>
            {results.length > 0 && (
              <div className="space-y-2">
                {results.map((r, i) => (
                  <div key={i} onClick={() => { setSelectedContent(r); setStep('confirm') }} className="flex gap-3 items-center p-3 bg-white rounded-xl cursor-pointer border border-[#e5e5e5] active:bg-[#f0efe9]">
                    {r.cover ? <img src={r.cover} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" /> : <div className="w-10 h-10 rounded bg-[#f0efe9] flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#1a1a1a] truncate">{r.title}</div>
                      <div className="text-xs text-[#999] truncate">{r.subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 'confirm' && selectedContent && (
        <div className="fixed inset-0 bg-[#f7f6f3] z-50 flex flex-col">
          <div className="p-6 flex flex-col gap-4 flex-1">
            <div className="flex justify-between items-center">
              <button onClick={() => setStep('search')} className="text-xs text-[#999]">← 뒤로</button>
              <button onClick={resetFlow} className="text-xs text-[#999]">취소</button>
            </div>
            <div className="bg-white rounded-2xl border border-[#e5e5e5] p-4 flex gap-4 items-center">
              {selectedContent.cover ? <img src={selectedContent.cover} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" /> : <div className="w-14 h-14 rounded-lg bg-[#f0efe9] flex-shrink-0" />}
              <div>
                <div className="text-sm font-medium text-[#1a1a1a]">{selectedContent.title}</div>
                <div className="text-xs text-[#999] mt-1">{selectedContent.subtitle}</div>
                <div className="text-xs text-[#bbb] mt-1">{activeCategory}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white rounded-xl border border-[#e5e5e5] px-4 py-3">
              <div className="text-xs text-[#999] flex-shrink-0">기록 날짜</div>
              <input type="date" className="flex-1 text-sm text-[#1a1a1a] outline-none bg-transparent" value={recordDate} onChange={e => setRecordDate(e.target.value)} max={new Date().toISOString().split('T')[0]} />
            </div>
            <textarea className="w-full text-sm bg-white rounded-xl px-4 py-3 outline-none resize-none border border-[#e5e5e5] placeholder:text-[#bbb]" rows={3} placeholder="그 순간을 기록해요... (선택)" value={memo} onChange={e => setMemo(e.target.value)} />
            <div className="mt-auto">
              <button onClick={saveItem} className="w-full text-sm bg-[#1a1a1a] text-white py-3 rounded-2xl font-medium">{saving ? '저장 중...' : '기록하기'}</button>
            </div>
          </div>
        </div>
      )}

      {step === 'photo' && (
        <div className="fixed inset-0 bg-black/20 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-xl rounded-t-2xl p-6 space-y-4">
            {capturedPhoto ? (
              <div>
                <img src={capturedPhoto} alt="" className="w-full h-48 object-cover rounded-2xl mb-4" />
                <div className="text-sm text-center text-[#999] mb-4">사진이 추가됐어요</div>
                <button onClick={resetFlow} className="w-full text-sm bg-[#1a1a1a] text-white py-3 rounded-2xl">완료</button>
              </div>
            ) : (
              <div>
                <div className="text-sm font-medium text-[#1a1a1a] mb-1">사진도 남길까요?</div>
                <div className="text-xs text-[#999] mb-6">그 순간의 장면을 기록할 수 있어요.</div>
                <div className="flex gap-3">
                  <button onClick={() => photoInputRef.current?.click()} className="flex-1 text-sm bg-[#1a1a1a] text-white py-3 rounded-2xl">{uploadingPhoto ? '업로드 중...' : '📷 사진 추가'}</button>
                  <button onClick={resetFlow} className="flex-1 text-sm text-[#999] py-3 rounded-2xl border border-[#e5e5e5]">건너뛰기</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h1 className="text-xl font-medium tracking-tight text-[#1a1a1a]">whatiwas</h1>
          <p className="text-xs text-[#999] mt-1">A personal archive of taste across the years.</p>
        </div>

        <div className="flex gap-0 mb-8 border-b border-[#e5e5e5]">
          <button onClick={() => setActiveTab('profile')} className={`pb-2 px-1 mr-6 text-sm transition-all ${activeTab === 'profile' ? 'text-[#1a1a1a] border-b-2 border-[#1a1a1a] font-medium' : 'text-[#999]'}`}>Profile</button>
          <button onClick={() => setActiveTab('archive')} className={`pb-2 px-1 text-sm transition-all ${activeTab === 'archive' ? 'text-[#1a1a1a] border-b-2 border-[#1a1a1a] font-medium' : 'text-[#999]'}`}>Archive</button>
        </div>

        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#e5e5e5] p-5">
              <div className="flex justify-between items-center mb-3">
                <div className="text-xs text-[#bbb] font-medium tracking-wider">YOUR TASTE</div>
                <button onClick={() => { setEditingTaste(true); setTasteInput(tasteText) }} className="text-xs text-[#bbb] hover:text-[#555]">편집</button>
              </div>
              {editingTaste ? (
                <div className="space-y-2">
                  <textarea className="w-full text-sm bg-[#f7f6f3] rounded-xl px-3 py-2 outline-none resize-none" rows={3} value={tasteInput} onChange={e => setTasteInput(e.target.value)} autoFocus placeholder="나의 취향을 소개해요..." />
                  <div className="flex gap-2">
                    <button onClick={saveTaste} className="flex-1 text-xs bg-[#1a1a1a] text-white rounded-lg py-2">저장</button>
                    <button onClick={() => setEditingTaste(false)} className="flex-1 text-xs text-[#999] rounded-lg py-2 border border-[#e5e5e5]">취소</button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[#1a1a1a] leading-relaxed">{tasteText || <span className="text-[#bbb]">나의 취향을 소개해보세요.</span>}</div>
              )}
            </div>

            <div className="space-y-3">
              {snapshots.map(snapshot => (
                <div key={snapshot.id} className="bg-white rounded-2xl border border-[#e5e5e5] p-5">
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-xs font-medium text-[#999]">{snapshot.year}년 {snapshot.month}월</div>
                    <button onClick={() => deleteSnapshot(String(snapshot.id))} className="text-xs text-[#ccc] hover:text-red-400">삭제</button>
                  </div>
                  {snapshot.items.length === 0 ? (
                    <div className="text-xs text-[#bbb]">선택된 항목이 없어요.</div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {categories.map(cat => {
                        const catItems = snapshot.items.filter(i => i.category === cat)
                        if (catItems.length === 0) return null
                        return (
                          <div key={cat}>
                            <div className="text-xs text-[#bbb] mb-2">{cat}</div>
                            <div className="flex gap-2">
                              {catItems.map(item => (
                                item.cover ? (
<img key={item.id} src={item.cover} alt="" className={`rounded object-cover cursor-pointer ${item.category === 'Music' ? 'w-20 h-20' : 'w-14 h-20'}`} onClick={() => setDetailItem(item)} />
                                ) : (
                                  <div key={item.id} className="w-20 h-20 rounded bg-[#f0efe9] cursor-pointer" onClick={() => setDetailItem(item)} />
                                )
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
              <button onClick={() => setCreatingSnapshot(true)} className="w-full text-xs text-[#999] py-4 border border-dashed border-[#ddd] rounded-2xl hover:border-[#999] transition-colors">+ 스냅샷 추가</button>
            </div>
          </div>
        )}

{activeTab === 'archive' && (
          <div className="flex flex-col items-center">
            {items.length === 0 ? (
              <div className="text-sm text-[#bbb] py-8 text-center">No entries yet.</div>
            ) : (
              <>
                {(() => {
                  const archiveItem = items[archiveIdx]
                  const getCoverStyle = (item: Item) => {
                    if (item.category === 'Music') return { width: 110, height: 110, borderRadius: '6px' }
                    return { width: 90, height: 130, borderRadius: '6px' }
                  }
                  const coverStyle = archiveItem ? getCoverStyle(archiveItem) : null
                  return (
                    <>
                      <div style={{ height: '180px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'white', borderRadius: '8px', border: '1px solid #e5e5e5', padding: '12px', marginBottom: '12px' }}>
                        {archiveItem && coverStyle && (
                          <>
                            <div style={{ ...coverStyle, overflow: 'hidden', flexShrink: 0, background: '#f0efe9' }}>
                              {archiveItem.cover && <img src={archiveItem.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ fontSize: 9, color: '#bbb', letterSpacing: '0.05em' }}>{archiveItem.category}</div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', lineHeight: 1.3 }}>{archiveItem.title}</div>
                              <div style={{ fontSize: 11, color: '#999' }}>{archiveItem.subtitle}</div>
                              <div style={{ fontSize: 10, color: '#bbb' }}>{formatDate(archiveItem)}</div>
                              {archiveItem.memo && <div style={{ fontSize: 10, color: '#777', fontStyle: 'italic' }}>"{archiveItem.memo}"</div>}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex gap-1 mb-4">
                        {items.map((_, i) => (
                          <div key={i} onClick={() => setArchiveIdx(i)} className="w-1.5 h-1.5 rounded-full cursor-pointer" style={{ background: i === archiveIdx ? '#1a1a1a' : '#ddd' }} />
                        ))}
                      </div>

                      {/* 휠 */}
                      <div
                        ref={archiveWheelRef}
                        style={{ width: 200, height: 200, borderRadius: '50%', background: '#e5e4df', border: '0.5px solid #ccc', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', touchAction: 'none' }}
                        onMouseDown={onArchiveWheelStart} onMouseMove={onArchiveWheelMove} onMouseUp={onArchiveWheelEnd} onMouseLeave={onArchiveWheelEnd}
                        onTouchStart={onArchiveWheelStart} onTouchMove={onArchiveWheelMove} onTouchEnd={onArchiveWheelEnd}
                      >
                        <button onClick={() => setDetailItem(archiveItem)} style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: '#777', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>DETAIL</button>
                        <button onClick={() => setArchiveIdx(i => (i - 1 + items.length) % items.length)} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#777', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Arial, sans-serif' }}>&#8249;</button>
                        <button onClick={() => setArchiveIdx(i => (i + 1) % items.length)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#777', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Arial, sans-serif' }}>&#8250;</button>
                        <button onClick={() => setDetailItem(archiveItem)} style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', fontSize: 14, color: '#777', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Arial, sans-serif' }}>&#9654;&#xFE0E;</button>
                        <div onClick={() => setDetailItem(archiveItem)} style={{ width: 58, height: 58, borderRadius: '50%', background: '#f7f6f3', border: '0.5px solid #ccc', position: 'absolute', zIndex: 2 }} />
                      </div>
                    </>
                  )
           })()}
              </>
            )}
          </div>
        </div>
        )}

      <div className="fixed bottom-0left-0 right-0 bg-white border-t border-[#e5e5e5] px-6 py-3 flex justify-between items-center">
        <button onClick={() => setStep('select')} className="text-sm bg-[#1a1a1a] text-white rounded-full px-5 py-2">+ 기록하기</button>
        <button onClick={() => setShowProfile(true)} className="flex items-center gap-2">
          {session.user.user_metadata?.picture && <img src={session.user.user_metadata.picture} alt="" className="w-7 h-7 rounded-full" />}
        </button>
      </div>

      {showProfile && (
        <div className="fixed inset-0 bg-black/20 flex items-end justify-center z-50" onClick={() => setShowProfile(false)}>
          <div className="bg-white w-full max-w-xl rounded-t-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              {session.user.user_metadata?.picture && <img src={session.user.user_metadata.picture} alt="" className="w-12 h-12 rounded-full" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#1a1a1a]">{session.user.user_metadata?.name}</div>
                <div className="text-xs text-[#999]">{session.user.email}</div>
                {editingUsername ? (
                  <div className="flex gap-2 mt-2">
                    <input className="flex-1 text-xs bg-[#f7f6f3] rounded-lg px-2 py-1 outline-none" placeholder="username" value={usernameInput} onChange={e => setUsernameInput(e.target.value)} autoFocus />
                    <button onClick={saveUsername} className="text-xs bg-[#1a1a1a] text-white rounded-lg px-2 py-1">저장</button>
                    <button onClick={() => setEditingUsername(false)} className="text-xs text-[#999]">취소</button>
                  </div>
                ) : (
                  <button onClick={() => { setEditingUsername(true); setUsernameInput(username) }} className="text-xs text-[#bbb] mt-1 block">
                    {username ? `@${username}` : '+ 프로필 주소 설정'}
                  </button>
                )}
                {username && !editingUsername && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="text-xs text-[#bbb]">whatiwas-six.vercel.app/u/{username}</div>
                    <button onClick={() => {
                      const url = `https://whatiwas-six.vercel.app/u/${username}`
                      if (navigator.share) { navigator.share({ title: 'whatiwas', url }) }
                      else { navigator.clipboard.writeText(url); alert('링크가 복사됐어요!') }
                    }} className="text-xs text-[#1a1a1a] bg-[#f0efe9] px-2 py-1 rounded-lg flex-shrink-0">공유</button>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-[#f7f6f3] rounded-xl py-3">
                <div className="text-lg font-medium">{items.filter(i => i.category === 'Books').length}</div>
                <div className="text-xs text-[#999]">Books</div>
              </div>
              <div className="bg-[#f7f6f3] rounded-xl py-3">
                <div className="text-lg font-medium">{items.filter(i => i.category === 'Music').length}</div>
                <div className="text-xs text-[#999]">Music</div>
              </div>
              <div className="bg-[#f7f6f3] rounded-xl py-3">
                <div className="text-lg font-medium">{items.filter(i => i.category === 'Movies').length}</div>
                <div className="text-xs text-[#999]">Movies</div>
              </div>
            </div>
            <button onClick={() => { supabase.auth.signOut(); setShowProfile(false) }} className="w-full text-sm text-[#999] py-3 border border-[#e5e5e5] rounded-xl">Sign out</button>
          </div>
        </div>
      )}

      {lightboxPhoto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setLightboxPhoto(null)}>
          <img src={lightboxPhoto} alt="" className="max-w-full max-h-full object-contain" style={{ maxWidth: '90vw', maxHeight: '90vh' }} />
        </div>
      )}

      {detailItem && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => { setDetailItem(null); setEditingId(null) }}>
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden mx-4" onClick={e => e.stopPropagation()}>
            {detailItem.photo_url && <img src={detailItem.photo_url} alt="" className="w-full h-48 object-cover cursor-pointer" onClick={() => setLightboxPhoto(detailItem.photo_url!)} />}
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-4 items-start">
                  {detailItem.cover && <img src={detailItem.cover} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />}
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
                  <textarea className="w-full text-sm bg-[#f7f6f3] rounded-lg px-3 py-2 outline-none resize-none" rows={3} value={editingMemo} onChange={e => setEditingMemo(e.target.value)} autoFocus placeholder="그 순간을 기록해요..." />
                  <div className="flex gap-2">
                    <button onClick={() => saveMemo(detailItem.id)} className="flex-1 text-sm bg-[#1a1a1a] text-white rounded-lg py-2">Save</button>
                    <button onClick={() => setEditingId(null)} className="flex-1 text-sm text-[#999] rounded-lg py-2 border border-[#e5e5e5]">Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  {detailItem.memo && <div className="text-sm text-[#555] italic mb-3 bg-[#f7f6f3] rounded-lg px-3 py-2">"{detailItem.memo}"</div>}
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingId(detailItem.id); setEditingMemo(detailItem.memo || '') }} className="flex-1 text-xs text-[#555] rounded-lg py-2 border border-[#e5e5e5]">{detailItem.memo ? 'Edit note' : '+ 메모'}</button>
                    <button onClick={() => { setAddingPhotoToItem(detailItem); photoInputRef.current?.click() }} className="text-xs text-[#555] rounded-lg py-2 px-3 border border-[#e5e5e5]">📷</button>
                    <button onClick={() => deleteItem(detailItem.id)} className="text-xs text-[#ccc] hover:text-red-400 rounded-lg py-2 px-3 border border-[#e5e5e5]">Delete</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}