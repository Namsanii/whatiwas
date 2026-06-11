import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function PublicProfile({ params }: { params: { username: string } }) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', params.username)
    .single()

  if (!profile) return (
    <div className="min-h-screen bg-[#f7f6f3] flex items-center justify-center">
      <div className="text-sm text-[#999]">존재하지 않는 프로필이에요.</div>
    </div>
  )

  const { data: items } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  const { data: featured } = await supabase
    .from('featured_items')
    .select('*, items(*)')
    .eq('user_id', profile.id)

  const categories = ['Books', 'Music', 'Movies'] as const

  const getFeatured = (cat: string) => {
    if (featured && featured.length > 0) {
      return featured.filter((f: any) => f.items?.category === cat).map((f: any) => f.items).filter(Boolean)
    }
    return (items || []).filter((i: any) => i.category === cat).slice(0, 3)
  }

  return (
    <main className="min-h-screen bg-[#f7f6f3]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-xl font-medium tracking-tight text-[#1a1a1a]">whatiwas</h1>
          <p className="text-xs text-[#999] mt-1">@{profile.username}</p>
        </div>

        {profile.taste_text && (
          <div className="bg-white rounded-2xl border border-[#e5e5e5] p-5 mb-6">
            <div className="text-xs text-[#bbb] font-medium mb-3 tracking-wider">YOUR TASTE</div>
            <div className="text-sm text-[#1a1a1a] leading-relaxed">{profile.taste_text}</div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-[#e5e5e5] p-5">
          <div className="text-xs text-[#bbb] font-medium mb-6 tracking-wider">ACROSS THE YEARS</div>
          <div className="flex flex-col gap-8">
            {categories.map(cat => {
              const catItems = getFeatured(cat)
              if (catItems.length === 0) return null
              return (
                <div key={cat}>
                  <div className="text-xs text-[#bbb] mb-3">{cat}</div>
                  <div className="flex gap-2 flex-wrap">
                    {catItems.map((item: any) => (
                      item.cover ? (
                        <img key={item.id} src={item.cover} alt="" className={`object-cover ${cat === 'Music' ? 'w-16 h-16 rounded-full' : 'w-14 h-20 rounded'}`} />
                      ) : (
                        <div key={item.id} className={`bg-[#f0efe9] ${cat === 'Music' ? 'w-16 h-16 rounded-full' : 'w-14 h-20 rounded'}`} />
                      )
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-8 text-center">
          <a href="https://whatiwas-six.vercel.app" className="text-xs text-[#bbb]">whatiwas로 나만의 취향 아카이브 만들기 →</a>
        </div>
      </div>
    </main>
  )
}