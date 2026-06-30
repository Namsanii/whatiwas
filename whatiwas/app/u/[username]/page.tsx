'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useParams } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

const categories = ['Books', 'Music', 'Movies'] as const

type Screen = 'categoryList' | 'snapshotList' | 'itemView'

export default function PublicProfile() {
  const params = useParams()
  const [profile, setProfile] = useState<any>(null)
 const [snapshots, setSnapshots] = useState<any[]>([])
  const [allItems, setAllItems] = useState<any[]>([])
  const [isAllMode, setIsAllMode] = useState(false)  const [loading, setLoading] = useState(true)

  const [screen, setScreen] = useState<Screen>('categoryList')
  const [categoryIdx, setCategoryIdx] = useState(0)
  const [snapshotIdx, setSnapshotIdx] = useState(0)
  const [itemIdx, setItemIdx] = useState(0)

 const wheelRef = useRef<HTMLDivElement>(null)
  const wheelStartAngle = useRef<number | null>(null)
  const [previewCover, setPreviewCover] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const username = params.username as string
      const { data: prof } = await supabase.from('profiles').select('*').eq('username', username).single()
      if (!prof) { setLoading(false); return }
      setProfile(prof)
const { data: allItemsData } = await supabase.from('items').select('*').eq('user_id', prof.id).order('created_at', { ascending: false })
      setAllItems(allItemsData || [])

      const { data: snapshotData } = await supabase.from('snapshots').select('*').eq('user_id', prof.id).order('year', { ascending: false })

      const result = []
      for (const s of (snapshotData || [])) {
        const { data: siData } = await supabase.from('snapshot_items').select('item_id').eq('snapshot_id', s.id)
        const itemIds = (siData || []).map((si: any) => Number(si.item_id))
        const { data: itemsData } = await supabase.from('items').select('*').in('id', itemIds)
        result.push({ ...s, items: itemsData || [] })
      }
      setSnapshots(result)
      setLoading(false)
    }
    load()
  }, [])

  const currentCategory = categories[categoryIdx]

  useEffect(() => {
    if (screen !== 'categoryList') return
    const covers = snapshots
      .flatMap(s => s.items)
      .filter((i: any) => i.category === currentCategory && i.cover)
      .map((i: any) => i.cover)
    if (covers.length === 0) { setPreviewCover(null); return }
    setPreviewCover(covers[Math.floor(Math.random() * covers.length)])
    const interval = setInterval(() => {
      setPreviewCover(covers[Math.floor(Math.random() * covers.length)])
    }, 2000)
    return () => clearInterval(interval)
  }, [screen, categoryIdx, snapshots])
 const snapshotsForCategory = snapshots
    .map(s => ({ ...s, items: s.items.filter((i: any) => i.category === currentCategory) }))
    .filter(s => s.items.length > 0)

  const allItemsForCategory = allItems.filter((i: any) => i.category === currentCategory)

  const isAllSelected = snapshotIdx === snapshotsForCategory.length
  const currentSnapshot = isAllSelected ? null : snapshotsForCategory[snapshotIdx]
  const itemsInSnapshot = isAllSelected ? allItemsForCategory : (currentSnapshot?.items || [])
  const currentItem = itemsInSnapshot[itemIdx]

  const getCoverStyle = (item: any) => {
    if (item.category === 'Music') return { width: 110, height: 110, borderRadius: '6px' }
    return { width: 90, height: 130, borderRadius: '6px' }
  }

  const goNext = () => {
    if (screen === 'categoryList') setCategoryIdx(i => (i + 1) % categories.length)
else if (screen === 'snapshotList') setSnapshotIdx(i => (i + 1) % Math.max(snapshotsForCategory.length + 1, 1))    else if (screen === 'itemView') setItemIdx(i => (i + 1) % Math.max(itemsInSnapshot.length, 1))
  }
  const goPrev = () => {
    if (screen === 'categoryList') setCategoryIdx(i => (i - 1 + categories.length) % categories.length)
    else if (screen === 'snapshotList') setSnapshotIdx(i => (i - 1 + Math.max(snapshotsForCategory.length + 1, 1)) % Math.max(snapshotsForCategory.length + 1, 1))
    else if (screen === 'itemView') setItemIdx(i => (i - 1 + Math.max(itemsInSnapshot.length, 1)) % Math.max(itemsInSnapshot.length, 1))
  }

  const onSelect = () => {
    if (screen === 'categoryList') {
      if (snapshotsForCategory.length === 0) return
      setSnapshotIdx(0)
      setScreen('snapshotList')
    } else if (screen === 'snapshotList') {
      setItemIdx(0)
      setScreen('itemView')
    }
  }

  const onMenu = () => {
    if (screen === 'itemView') setScreen('snapshotList')
    else if (screen === 'snapshotList') setScreen('categoryList')
  }

  const getAngle = (e: any, el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const touch = e.touches ? e.touches[0] : e
    return Math.atan2(touch.clientY - cy, touch.clientX - cx) * 180 / Math.PI
  }

  const onWheelStart = (e: any) => {
    if ((e.target as HTMLElement).closest('.wheel-inner') || (e.target as HTMLElement).closest('.wheel-btn')) return
    wheelStartAngle.current = getAngle(e, wheelRef.current!)
  }

  const onWheelMove = (e: any) => {
    if (wheelStartAngle.current === null) return
    const angle = getAngle(e, wheelRef.current!)
    let diff = angle - wheelStartAngle.current
    if (diff > 180) diff -= 360
    if (diff < -180) diff += 360
    if (Math.abs(diff) > 30) {
      if (diff > 0) goNext()
      else goPrev()
      wheelStartAngle.current = angle
    }
  }

  const onWheelEnd = () => { wheelStartAngle.current = null }

  if (loading) return (
    <div className="min-h-screen bg-[#f7f6f3] flex items-center justify-center">
      <div className="text-sm text-[#999]">Loading...</div>
    </div>
  )

  if (!profile) return (
    <div className="min-h-screen bg-[#f7f6f3] flex items-center justify-center">
      <div className="text-sm text-[#999]">존재하지 않는 프로필이에요.</div>
    </div>
  )

  const coverStyle = currentItem ? getCoverStyle(currentItem) : null

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center py-12 px-6">
      <div className="w-full max-w-sm">

        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="text-lg font-medium text-[#1a1a1a]">whatiwas</div>
            <div className="text-xs text-[#999]">@{profile.username}</div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #f4f4f4 0%, #e8e8e8 30%, #f8f8f8 50%, #dcdcdc 70%, #f0f0f0 100%)', borderRadius: '24px', border: '1px solid #d0d0d0', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>


<div style={{ height: '180px', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', background: 'white', borderRadius: '8px', border: '1px solid #ccc', overflow: 'hidden' }}>
  {screen === 'categoryList' && (
              <div style={{ display: 'flex', height: '180px' }}>
<div className="flex flex-col gap-1" style={{ width: '50%', minWidth: 0, padding: '4px' }}>
                    const count = snapshots.reduce((sum, s) => sum + s.items.filter((it: any) => it.category === cat).length, 0)
                    return (
                      <div
                        key={cat}
                        onClick={() => { setCategoryIdx(i); if (count > 0) { setSnapshotIdx(0); setScreen('snapshotList') } }}
                        className={`flex justify-between items-center px-2 py-1.5 cursor-pointer transition-colors ${i === categoryIdx ? 'bg-[#1a1a1a]' : ''}`}
                      >
                        <span className={`text-sm ${i === categoryIdx ? 'text-white font-medium' : 'text-[#1a1a1a]'}`}>{cat}</span>
                        <span className={`text-xs ${i === categoryIdx ? 'text-[#ccc]' : 'text-[#bbb]'}`}>{count > 0 ? `${count} ›` : '–'}</span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ width: '50%', height: '180px', overflow: 'hidden', flexShrink: 0, background: '#f0efe9' }}>
                  {previewCover && (
                    <img src={previewCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.3s' }} />
                  )}
                </div>
              </div>
            )}
            {screen === 'snapshotList' && (
              <div className="flex flex-col" style={{ width: '100%' }}>
                <div style={{ background: 'linear-gradient(180deg, #c4c8d0 0%, #9aa0ab 50%, #b8bcc4 100%)', color: 'white', fontSize: '11px', fontWeight: 500, padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                  <span>{currentCategory}</span>
                  <span style={{ fontSize: 9, opacity: 0.7 }}>▶</span>
                </div>
<div className="flex flex-col gap-1" style={{ padding: '4px' }}>
                 {snapshotsForCategory.length === 0 && allItemsForCategory.length === 0 ? (
                    <div className="text-xs text-[#bbb] px-3">항목이 없어요.</div>
                  ) : (
                    <>
                      {snapshotsForCategory.map((s, i) => (
                        <div
                          key={s.id}
                          onClick={() => { setSnapshotIdx(i); setItemIdx(0); setScreen('itemView') }}
                          className={`flex justify-between items-center px-2 py-1.5 cursor-pointer transition-colors ${i === snapshotIdx ? 'bg-[#1a1a1a]' : ''}`}
                        >
                          <span className={`text-sm ${i === snapshotIdx ? 'text-white font-medium' : 'text-[#1a1a1a]'}`}>{s.year}년 {s.month}월</span>
                          <span className={`text-xs ${i === snapshotIdx ? 'text-[#ccc]' : 'text-[#bbb]'}`}>{s.items.length} ›</span>
                        </div>
                      ))}
                      {allItemsForCategory.length > 0 && (
                        <div
                          onClick={() => { setSnapshotIdx(snapshotsForCategory.length); setItemIdx(0); setScreen('itemView') }}
                          className={`flex justify-between items-center px-2 py-1.5 cursor-pointer transition-colors ${snapshotIdx === snapshotsForCategory.length ? 'bg-[#1a1a1a]' : ''}`}
                        >
                          <span className={`text-sm ${snapshotIdx === snapshotsForCategory.length ? 'text-white font-medium' : 'text-[#1a1a1a]'}`}>All</span>
                          <span className={`text-xs ${snapshotIdx === snapshotsForCategory.length ? 'text-[#ccc]' : 'text-[#bbb]'}`}>{allItemsForCategory.length} ›</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {screen === 'itemView' && currentItem && coverStyle && (
              <div className="flex flex-col" style={{ width: '100%', height: '100%' }}>
                <div style={{ background: 'linear-gradient(180deg, #c4c8d0 0%, #9aa0ab 50%, #b8bcc4 100%)', color: 'white', fontSize: '11px', fontWeight: 500, padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{currentCategory}</span>
                  <span style={{ fontSize: 9, opacity: 0.7 }}>▶</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flex: 1, padding: '12px' }}>
                <div style={{ ...coverStyle, overflow: 'hidden', flexShrink: 0, background: '#f0efe9' }}>
                  {currentItem.cover && (
                    <img src={currentItem.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: 9, color: '#bbb', letterSpacing: '0.05em' }}>{currentItem.category}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', lineHeight: 1.3 }}>{currentItem.title}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{currentItem.subtitle}</div>
                 {currentItem.memo && <div style={{ fontSize: 10, color: '#777', fontStyle: 'italic', marginTop: 4 }}>"{currentItem.memo}"</div>}
                </div>
                </div>
              </div>
            )}
          </div>

          {screen === 'itemView' && itemsInSnapshot.length > 0 && (
            <div className="flex gap-1 mb-4">
              {itemsInSnapshot.map((_: any, i: number) => (
                <div key={i} onClick={() => setItemIdx(i)} className="w-1.5 h-1.5 rounded-full cursor-pointer transition-colors" style={{ background: i === itemIdx ? '#1a1a1a' : '#ddd' }} />
              ))}
            </div>
          )}
          {screen !== 'itemView' && <div className="mb-4" style={{ height: '6px' }} />}

          <div
            ref={wheelRef}
            style={{ width: 200, height: 200, borderRadius: '50%', background: '#e5e4df', border: '0.5px solid #ccc', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', touchAction: 'none' }}
            onMouseDown={onWheelStart} onMouseMove={onWheelMove} onMouseUp={onWheelEnd} onMouseLeave={onWheelEnd}
            onTouchStart={onWheelStart} onTouchMove={onWheelMove} onTouchEnd={onWheelEnd}
          >
            <button onClick={onMenu} className="wheel-btn" style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: '#777', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>MENU</button>
            <button onClick={goPrev} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#777', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Arial, sans-serif' }}>&#8249;</button>
            <button onClick={goNext} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#777', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Arial, sans-serif' }}>&#8250;</button>
            <button onClick={onSelect} style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', fontSize: 14, color: '#777', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Arial, sans-serif' }}>&#9654;&#xFE0E;</button>
            <div className="wheel-inner" onClick={onSelect} style={{ width: 58, height: 58, borderRadius: '50%', background: '#f7f6f3', border: '0.5px solid #ccc', position: 'absolute', zIndex: 2 }} />
          </div>

          <div style={{ height: '20px' }} />
        </div>

        <div className="mt-8 text-center">
          <a href="https://whatiwas-six.vercel.app" className="text-xs text-[#bbb]">whatiwas로 나만의 취향 아카이브 만들기 →</a>
        </div>
      </div>
    </main>
  )
}