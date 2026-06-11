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

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Item[]>([])
  const [activeTab, setActiveTab] = useState<'profile' | 'archive'>('profile')
  const [showProfile, setShowProfile] = useState(false)

  // 추가 플로우
  const [step, setStep] = useState<'idle' | 'select' | 'search' | 'confirm' | 'photo'>('idle')
  const [activeCategory, setActiveCategory] = useState<Category>('Books')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedContent, setSelectedContent] = useState<any>(null)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedItem, setSavedItem] = useState<Item | null>(null)
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null)

  // 사진
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [detailItem, setDetailItem] = useState<Item | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingMemo, setEditingMemo] = useState('')
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

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
    if (session) fetchItems()
  }, [session])

  useEffect(() => {
    if (step === 'search') setTimeout(() => searchInputRef.current?.focus(), 100)
  }, [step])

  const fetchItems = async () => {
    const { data } = await supabase.from('items').select('*').order('created_at', { ascending: false })
    if (data) setItems(data as Item[])
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
    const now = new Date()

    const { data } = await supabase.from('items').insert({
      title: selectedContent.title,
      subtitle: selectedContent.subtitle,
      cover: selectedContent.cover,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      category: activeCategory,
      memo,
      user_id: session.user.id,
      photo_url: null,
    }).select()

    if (data) {
      const newItem = data[0] as Item
      setItems(prev => [newItem, ...prev])
      setSavedItem(newItem)
      setSavedFeedback(selectedContent.title)
      setTimeout(() => setSavedFeedback(null), 2500)
      setStep('photo') // 사진 추가 옵션으로
    }

    setSaving(false)
    setQuery('')
    setResults([])
    setMemo('')
    setSelectedContent(null)
  }

  const uploadAndAttachPhoto = async (file: File) => {
    if (!session || !savedItem) return
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
        await supabase.from('items').update({ photo_url: url }).eq('id', savedItem.id)
        setItems(prev => prev.map(i => i.id === savedItem.id ? { ...i, photo_url: url } : i))
        setCapturedPhoto(dataUrl)
      }
      setUploadingPhoto(false)
    }
    reader.readAsDataURL(file)
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    uploadAndAttachPhoto(file)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const resetFlow = () => {
    setStep('idle')
    setQuery('')
    setResults([])
    setSelectedContent(null)
    setMemo('')
    setSavedItem(null)
    setCapturedPhoto(null)
  }

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

      {/* Step 1: 카테고리 선택 */}
      {step === 'select' && (
        <div className="fixed inset-0 bg-black/20 flex items-end justify-center z-50" onClick={resetFlow}>
          <div className="bg-white w-full max-w-xl rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm font-medium">무엇을 기록할까요?</span>
              <button onClick={resetFlow} className="text-xs text-[#999]">취소</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setStep('search') }}
                  className="bg-[#f7f6f3] rounded-2xl py-6 text-sm font-medium text-[#1a1a1a] hover:bg-[#ebebeb] transition-colors"
                >
                  {cat === 'Books' ? '📚' : cat === 'Music' ? '🎵' : '🎬'}
                  <div className="mt-2">{cat}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: 검색 */}
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
              <input
                ref={searchInputRef}
                className="flex-1 text-sm bg-white rounded-xl px-4 py-3 outline-none placeholder:text-[#bbb] border border-[#e5e5e5]"
                placeholder={activeCategory === 'Books' ? '책 제목...' : activeCategory === 'Music' ? '곡 제목...' : '영화 제목...'}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
              />
              <button onClick={search} className="text-sm bg-[#1a1a1a] text-white rounded-xl px-4 py-3">{searching ? '...' : 'Search'}</button>
            </div>
            {results.length > 0 && (
              <div className="space-y-2">
                {results.map((r, i) => (
                  <div key={i} onClick={() => { setSelectedContent(r); setStep('confirm') }} className="flex gap-3 items-center p-3 bg-white rounded-xl cursor-pointer border border-[#e5e5e5] active:bg-[#f0efe9]">
                    {r.cover ? (
                      <img src={r.cover} alt="" className={`object-cover rounded flex-shrink-0 ${activeCategory === 'Music' ? 'w-10 h-10 rounded-full' : 'w-8 h-12'}`} />
                    ) : (
                      <div className={`bg-[#f0efe9] flex-shrink-0 ${activeCategory === 'Music' ? 'w-10 h-10 rounded-full' : 'w-8 h-12 rounded'}`} />
                    )}
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

      {/* Step 3: 확인 및 메모 */}
      {step === 'confirm' && selectedContent && (
        <div className="fixed inset-0 bg-[#f7f6f3] z-50 flex flex-col">
          <div className="p-6 flex flex-col gap-4 flex-1">
            <div className="flex justify-between items-center">
              <button onClick={() => setStep('search')} className="text-xs text-[#999]">← 뒤로</button>
              <button onClick={resetFlow} className="text-xs text-[#999]">취소</button>
            </div>
            <div className="bg-white rounded-2xl border border-[#e5e5e5] p-4 flex gap-4 items-center">
              {selectedContent.cover ? (
                <img src={selectedContent.cover} alt="" className={`object-cover rounded-lg flex-shrink-0 ${activeCategory === 'Music' ? 'w-14 h-14 rounded-full' : 'w-12 h-16'}`} />
              ) : (
                <div className={`bg-[#f0efe9] flex-shrink-0 ${activeCategory === 'Music' ? 'w-14 h-14 rounded-full' : 'w-12 h-16 rounded-lg'}`} />
              )}
              <div>
                <div className="text-sm font-medium text-[#1a1a1a]">{selectedContent.title}</div>
                <div className="text-xs text-[#999] mt-1">{selectedContent.subtitle}</div>
                <div className="text-xs text-[#bbb] mt-1">{activeCategory} · {new Date().toLocaleDateString('ko-KR')}</div>
              </div>
            </div>
            <textarea
              className="w-full text-sm bg-white rounded-xl px-4 py-3 outline-none resize-none border border-[#e5e5e5] placeholder:text-[#bbb]"
              rows={3}
              placeholder="그 순간을 기록해요... (선택)"
              value={memo}
              onChange={e => setMemo(e.target.value)}
            />
            <div className="mt-auto">
              <button onClick={saveItem} className="w-full text-sm bg-[#1a1a1a] text-white py-3 rounded-2xl font-medium">
                {saving ? '저장 중...' : '기록하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: 사진 추가 (선택) */}
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
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="flex-1 text-sm bg-[#1a1a1a] text-white py-3 rounded-2xl"
                  >
                    {uploadingPhoto ? '업로드 중...' : '📷 사진 추가'}
                  </button>
                  <button onClick={resetFlow} className="flex-1 text-sm text-[#999] py-3 rounded-2xl border border-[#e5e5e5]">
                    건너뛰기
                  </button>
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
            {items.length < 3 ? (
              <div className="bg-white rounded-2xl border border-[#e5e5e5] p-8 text-center">
                <div className="text-sm text-[#999] mb-1">Add at least 3 items</div>
                <div className="text-xs text-[#bbb]">to see your taste profile</div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#e5e5e5] p-5">
                <div className="text-xs text-[#bbb] font-medium mb-3 tracking-wider">YOUR TASTE</div>
                <div className="text-sm text-[#1a1a1a] leading-relaxed">
                  {items.filter(i => i.category === 'Books').length}권의 책, {items.filter(i => i.category === 'Music').length}곡의 음악, {items.filter(i => i.category === 'Movies').length}편의 영화를 기록했어요.
                </div>
              </div>
            )}

            {allYears.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#e5e5e5] p-5">
                <div className="text-xs text-[#bbb] font-medium mb-4 tracking-wider">ACROSS THE YEARS</div>
                <div className="flex gap-6 overflow-x-auto pb-1">
                  {allYears.map(y => (
                    <div key={y} className="flex-shrink-0">
                      <div className="text-xs font-medium text-[#999] mb-3">{y}</div>
                      <div className="space-y-2">
                        {categories.map(cat => {
                          const catItems = items.filter(i => i.category === cat && new Date(i.created_at).getFullYear() === y)
                          if (catItems.length === 0) return null
                          return (
                            <div key={cat} className="flex gap-1 flex-wrap">
                              {catItems.map(item => (
                                item.cover ? (
                                  <img key={item.id} src={item.cover} alt="" className={`object-cover ${cat === 'Music' ? 'w-10 h-10 rounded-full' : 'w-8 h-11 rounded'}`} />
                                ) : (
                                  <div key={item.id} className={`bg-[#f0efe9] ${cat === 'Music' ? 'w-10 h-10 rounded-full' : 'w-8 h-11 rounded'}`} />
                                )
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'archive' && (
          <div>
            {items.length === 0 ? (
              <div className="text-sm text-[#bbb] py-8 text-center">No entries yet.</div>
            ) : (
              <div className="space-y-8">
                {allYears.map(y => (
                  <div key={y}>
                    <div className="text-sm font-medium text-[#1a1a1a] mb-4">{y}</div>
                    <div className="space-y-3">
                      {items.filter(i => new Date(i.created_at).getFullYear() === y).map(item => (
                        <div key={item.id} className="bg-white rounded-2xl border border-[#e5e5e5] overflow-hidden cursor-pointer" onClick={() => setDetailItem(item)}>
                          {item.photo_url && (
                            <img src={item.photo_url} alt="" className="w-full h-40 object-cover" />
                          )}
                          <div className="p-4 flex gap-3 items-start">
                            {item.cover ? (
                              <img src={item.cover} alt="" className={`object-cover rounded flex-shrink-0 ${item.category === 'Music' ? 'w-10 h-10 rounded-full' : 'w-8 h-12'}`} />
                            ) : (
                              <div className={`bg-[#f0efe9] flex-shrink-0 ${item.category === 'Music' ? 'w-10 h-10 rounded-full' : 'w-8 h-12 rounded'}`} />
                            )}
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
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e5e5e5] px-6 py-3 flex justify-between items-center">
        <button onClick={() => setStep('select')} className="text-sm bg-[#1a1a1a] text-white rounded-full px-5 py-2">
          + 기록하기
        </button>
        <button onClick={() => setShowProfile(true)} className="flex items-center gap-2">
          {session.user.user_metadata?.picture && (
            <img src={session.user.user_metadata.picture} alt="" className="w-7 h-7 rounded-full" />
          )}
        </button>
      </div>

      {showProfile && (
        <div className="fixed inset-0 bg-black/20 flex items-end justify-center z-50" onClick={() => setShowProfile(false)}>
          <div className="bg-white w-full max-w-xl rounded-t-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
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
            {detailItem.photo_url && (
              <img src={detailItem.photo_url} alt="" className="w-full h-48 object-cover" onClick={() => setLightboxPhoto(detailItem.photo_url!)} />
            )}
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-4 items-start">
                  {detailItem.cover && <img src={detailItem.cover} alt="" className={`object-cover rounded-lg flex-shrink-0 ${detailItem.category === 'Music' ? 'w-14 h-14 rounded-full' : 'w-12 h-16'}`} />}
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
                    <button onClick={() => { setEditingId(detailItem.id); setEditingMemo(detailItem.memo || '') }} className="flex-1 text-xs text-[#555] rounded-lg py-2 border border-[#e5e5e5]">
                      {detailItem.memo ? 'Edit note' : '+ 그 순간 기록하기'}
                    </button>
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