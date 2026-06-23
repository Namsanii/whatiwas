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

export default function PublicProfile() {
  const params = useParams()
  const [profile, setProfile] = useState<any>(null)
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [currentSnapshotIdx, setCurrentSnapshotIdx] = useState(0)
  const [currentItemIdx, setCurrentItemIdx] = useState(0)
  const [showMenu, setShowMenu] = useState(false)
  const [loading, setLoading] = useState(true)

  const wheelRef = useRef<HTMLDivElement>(null)
  const wheelStartAngle = useRef<number | null>(null)

  useEffect(() => {
    const load = async () => {
      const username = params.username as string
      const { data: prof } = await supabase.from('profiles').select('*').eq('username', username).single()
      if (!prof) { setLoading(false); return }
      setProfile(prof)

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

  const currentSnapshot = snapshots[currentSnapshotIdx]
  const allItems = currentSnapshot?.items || []
  const currentItem = allItems[currentItemIdx]

  const getCoverStyle = (item: any) => {
    if (item.category === 'Music') return { width: 110, height: 110, borderRadius: '6px' }
    return { width: 90, height: 130, borderRadius: '6px' }
  }

  const goNext = () => setCurrentItemIdx(i => (i + 1) % allItems.length)
  const goPrev = () => setCurrentItemIdx(i => (i - 1 + allItems.length) % allItems.length)

  const selectSnapshot = (idx: number) => {
    setCurrentSnapshotIdx(idx)
    setCurrentItemIdx(0)
    setShowMenu(false)
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
    <main className="min-h-screen bg-[#f7f6f3] flex flex-col items-center justify-center py-12 px-6">
      <div className="w-full max-w-sm">

        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="text-lg font-medium text-[#1a1a1a]">whatiwas</div>
            <div className="text-xs text-[#999]">@{profile.username}</div>
          </div>
        </div>

        {snapshots.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e5e5e5] p-8 text-center">
            <div className="text-sm text-[#bbb]">아직 스냅샷이 없어요.</div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#e5e5e5] p-6 flex flex-col items-center">

            {profile.taste_text && (
              <div className="text-xs text-[#999] w-full mb-4 leading-relaxed">{profile.taste_text}</div>
            )}

            <div className="relative w-full mb-6">
              <button onClick={() => setShowMenu(v => !v)} className="w-full text-xs text-[#999] py-2 px-4 border border-[#e5e5e5] rounded-xl flex justify-between items-center">
                <span>{currentSnapshot?.year}년 {currentSnapshot?.month}월</span>
                <span>{showMenu ? '▲' : '▼'}</span>
              </button>
              {showMenu && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e5e5e5] rounded-xl overflow-hidden z-10">
                  {snapshots.map((s, i) => (
                    <button key={s.id} onClick={() => selectSnapshot(i)} className={`w-full text-left text-xs px-4 py-2.5 hover:bg-[#f7f6f3] ${i === currentSnapshotIdx ? 'text-[#1a1a1a] font-medium' : 'text-[#999]'}`}>
                      {s.year}년 {s.month}월
                    </button>
                  ))}
                </div>
              )}
            </div>

            {currentItem && coverStyle ? (
              <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '16px', marginBottom: '16px' }}>
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
            ) : (
              <div className="flex items-center justify-center" style={{ height: '180px' }}>
                <div className="text-xs text-[#bbb]">항목이 없어요.</div>
              </div>
            )}

            {allItems.length > 0 && (
              <div className="flex gap-1 mb-4">
                {allItems.map((_: any, i: number) => (
                  <div key={i} onClick={() => setCurrentItemIdx(i)} className="w-1.5 h-1.5 rounded-full cursor-pointer transition-colors" style={{ background: i === currentItemIdx ? '#1a1a1a' : '#ddd' }} />
                ))}
              </div>
            )}

            <div
              ref={wheelRef}
              style={{ width: 200, height: 200, borderRadius: '50%', background: '#e5e4df', border: '0.5px solid #ccc', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', touchAction: 'none' }}
              onMouseDown={onWheelStart} onMouseMove={onWheelMove} onMouseUp={onWheelEnd} onMouseLeave={onWheelEnd}
              onTouchStart={onWheelStart} onTouchMove={onWheelMove} onTouchEnd={onWheelEnd}
            >
              <button onClick={() => setShowMenu(v => !v)} className="wheel-btn" style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: '#777', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>MENU</button>
              <button onClick={goPrev} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#777', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Arial, sans-serif' }}>&#8249;</button>
              <button onClick={goNext} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#777', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Arial, sans-serif' }}>&#8250;</button>
              <button onClick={goNext} style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', fontSize: 14, color: '#777', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Arial, sans-serif' }}>&#9654;&#xFE0E;</button>
              <div className="wheel-inner" style={{ width: 58, height: 58, borderRadius: '50%', background: '#f7f6f3', border: '0.5px solid #ccc', position: 'absolute', zIndex: 2 }} />
            </div>

            <div style={{ height: '20px' }} />
          </div>
        )}

        <div className="mt-8 text-center">
          <a href="https://whatiwas-six.vercel.app" className="text-xs text-[#bbb]">whatiwas로 나만의 취향 아카이브 만들기 →</a>
        </div>
      </div>
    </main>
  )
}