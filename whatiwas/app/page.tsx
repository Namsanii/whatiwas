'use client'
import { useState, useEffect } from 'react'
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

export default function Home() {
  const [items, setItems] = useState<Item[]>([])
  const [showForm, setShowForm] = useState(false)
  const [activeCategory, setActiveCategory] = useState<Category>('Books')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [memo, setMemo] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => { fetchItems() }, [])

  const fetchItems = async () => {
    const { data } = await supabase.from('items').select('*').order('year', { ascending: false })
    if (data) setItems(data as Item[])
  }

  const search = async () => {
    if (!query) return
    setSearching(true)
    setResults([])
    setSelected(null)
    const endpoint = activeCategory === 'Music' ? '/api/search-music' : '/api/search'
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

  const getYears = (cat: Category) => {
    const filtered = items.filter(i => i.category === cat)
    return [...new Set(filtered.map(i => i.year))].sort((a, b) => b - a)
  }

  const getPlaceholder = (cat: Category) => {
    if (cat === 'Books') return 'Year you read it'
    if (cat === 'Music') return 'Year you listened to it'
    return 'Year you watched it'
  }

  return (
    <main className="min-h-screen bg-[#f7f6f3]">
      <div className="max-w-xl mx-auto px-6 py-12">

        <div className="mb-12">
          <h1 className="text-xl font-medium tracking-tight text-[#1a1a1a]">whatiwas</h1>
          <p className="text-xs text-[#999] mt-1">A personal archive of taste across the years.</p>
        </div>

        {categories.map(cat => (
          <div key={cat} className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-medium text-[#1a1a1a]">{cat}</h2>
              <button
                onClick={() => { setActiveCategory(cat); setShowForm(true) }}
                className="text-xs text-[#999] hover:text-[#555] transition-colors"
              >
                + Add
              </button>
            </div>

            {getYears(cat).length === 0 ? (
              <div className="text-sm text-[#bbb] py-4">No entries yet.</div>
            ) : (
              <div className="space-y-6">
                {getYears(cat).map(y => (
                  <div key={y}>
                    <div className="text-xs text-[#bbb] font-medium mb-2">{y}</div>
                    <div className="space-y-2">
                      {items.filter(i => i.category === cat && i.year === y).map(item => (
                        <div key={item.id} className="flex justify-between items-start py-2 border-b border-[#ebebeb]">
                          <div className="flex gap-3 items-start">
                            {item.cover && <img src={item.cover} alt="" className="w-8 h-11 object-cover rounded" />}
                            <div>
                              <div className="text-sm font-medium text-[#1a1a1a]">{item.title}</div>
                              <div className="text-xs text-[#999] mt-0.5">{item.subtitle}</div>
                              {item.memo && <div className="text-xs text-[#777] mt-1 italic">{item.memo}</div>}
                            </div>
                          </div>
                          <button onClick={() => deleteItem(item.id)} className="text-[#ccc] hover:text-[#999] text-xs ml-4 mt-0.5">×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {showForm && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
            <div className="bg-white w-full max-w-xl rounded-2xl p-6 space-y-3mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">Add to {activeCategory}</span>
                <button onClick={() => setShowForm(false)} className="text-[#999] text-xs">Cancel</button
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
                    <div key={i} onClick={() => { setSelected(r); setYear(new Date().getFullYear()) }} className="flex gap-3 items-center p-2 rounded-lg hover:bg-[#f7f6f3] cursor-pointer">
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