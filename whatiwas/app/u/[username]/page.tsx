import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

const categories = ['Books', 'Music', 'Movies'] as const

export default async function PublicProfile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single()

  if (!profile) return (
    <div className="min-h-screen bg-[#f7f6f3] flex items-center justify-center">
      <div className="text-sm text-[#999]">존재하지 않는 프로필이에요. ({username})</div>
    </div>
  )

  const { data: allItems } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  const { data: snapshotData } = await supabase
    .from('snapshots')
    .select('*')
    .eq('user_id', profile.id)
    .order('year', { ascending: false })

  const snapshots = []
  for (const s of (snapshotData || [])) {
    const { data: siData } = await supabase
      .from('snapshot_items')
      .select('item_id')
      .eq('snapshot_id', s.id)
const itemIds = (siData || []).map((si: any) => Number(si.item_id))
const snapshotItems = (allItems || []).filter((i: any) => itemIds.includes(Number(i.id)))
    snapshots.push({ ...s, items: snapshotItems })
  }

  return (
    <main className="min-h-screen bg-[#f7f6f3] pb-12">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-xl font-medium tracking-tight text-[#1a1a1a]">whatiwas</h1>
          <p className="text-xs text-[#999] mt-1">@{profile.username}</p>
        </div>

        {profile.taste_text && (
          <div className="bg-white rounded-2xl border border-[#e5e5e5] p-5 mb-4">
            <div className="text-xs text-[#bbb] font-medium mb-3 tracking-wider">YOUR TASTE</div>
            <div className="text-sm text-[#1a1a1a] leading-relaxed">{profile.taste_text}</div>
          </div>
        )}

        {snapshots.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e5e5e5] p-8 text-center">
            <div className="text-sm text-[#bbb]">아직 스냅샷이 없어요.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {snapshots.map((snapshot: any) => (
              <div key={snapshot.id} className="bg-white rounded-2xl border border-[#e5e5e5] p-5">
                <div className="text-xs font-medium text-[#999] mb-4">{snapshot.year}년 {snapshot.month}월</div>
                <div className="flex flex-col gap-4">
                  {categories.map(cat => {
                    const catItems = snapshot.items.filter((i: any) => i.category === cat)
                    if (catItems.length === 0) return null
                    return (
                      <div key={cat}>
                        <div className="text-xs text-[#bbb] mb-2">{cat}</div>
                        <div className="flex gap-2">
                          {catItems.map((item: any) => (
                            item.cover ? (
                              <img key={item.id} src={item.cover} alt="" className={`object-cover ${cat === 'Music' ? 'w-24 h-24 rounded-full' : 'w-20 h-28 rounded'}`} />
                            ) : (
                              <div key={item.id} className={`bg-[#f0efe9] ${cat === 'Music' ? 'w-24 h-24 rounded-full' : 'w-20 h-28 rounded'}`} />
                            )
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <a href="https://whatiwas-six.vercel.app" className="text-xs text-[#bbb]">whatiwas로 나만의 취향 아카이브 만들기 →</a>
        </div>
      </div>
    </main>
  )
}