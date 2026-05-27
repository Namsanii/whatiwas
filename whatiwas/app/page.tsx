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
  const [activeCategory, setActiveCategory] = useState<Category>('Books')
  const [showForm, setShowForm] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [memo, setMemo] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    const { data } = await supabase.from('items').select('*').order('year', { ascending: false })
    if (data) setItems(data as Item[])
  }

  const filtered = items.filter(i => i.category === activeCategory)
  const years = [...new Set(filtered.map(i => i.year))].sort((a, b) => b - a)

  const search = async () => {
    if (!query) return
    setSearching(true)
    setResults([])
    setSelected(null)
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=book`)
    const data = await res.json()
    setResults(data.items || [])
    setSearching(false)
  }

  const addItem = async () => {
    if (!selected) return
    const newItem = {
      title: selected.title,
      subtitle: selected.subtitle,
      cover: selected.cover,
      year,
      category: activeCategory,
      memo,
    }
    const { data } = await supabase.from('items').insert(newItem).select()
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

  return (
    <main className="min-h-screen bg-[#f7f6f3]">
      <div className="max-w-xl mx-auto px-6 py-12">

        <div className="mb-10">
          <h1 className="text-xl font-medium tracking-tight text-[#1a1a1a]">whatiwas</h1>
          <p className="text-xs text-[#999] mt-1">A personal archive of taste across the years.</p>
        </div>

        <div className="flex gap-4 mb-8 border-b border-[#e5e5e5]">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setShowForm(false) }}
              className={`pb-2 text-sm transition-all ${
                activeCategory === cat
                  ? 'text-[#1a1a1a] border-b-2 border-[#1a1a1a] font-medium'
                  : 'text-[#999] hover:text-[#555]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="space-y-8">
          {years.map(y => (
            <div key={y}>
              <div className="text-xs text-[#999] font-medium mb-3">{y}</div>
              <div className="space-y-2">
                {filtered.filter(i => i.year === y).map(item => (
                  <div key={item.id} className="flex justify-between items-start py-3 border-b border-[#ebebeb]">
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
          {years.length === 0 && (
            <div className="text-sm text-[#bbb] py-8 text-center">No entries yet.</div>
          )}
        </div>

        {showForm && (
          <div className="mt-8 p-4 bg-white rounded-xl border border-[#e5e5e5] space-y-3">
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
                <input type="number" className="w-full text-sm bg-[#f7f6f3] rounded-lg px-3 py-2 outline-none" placeholder="Year you read it" value={year} onChange={e => setYear(parseInt(e.target.value))} />
                <input className="w-full text-sm bg-[#f7f6f3] rounded-lg px-3 py-2 outline-none placeholder:text-[#bbb]" placeholder="Notes (optional)" value={memo} onChange={e => setMemo(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={addItem} className="flex-1 text-sm bg-[#1a1a1a] text-white rounded-lg py-2">Add</button>
                  <button onClick={() => setSelected(null)} className="flex-1 text-sm text-[#999] rounded-lg py-2 border border-[#e5e5e5]">Search again</button>
                </div>
              </div>
            )}
            <button onClick={() => setShowForm(false)} className="w-full text-xs text-[#bbb] pt-1">Cancel</button>
          </div>
        )}

        {!showForm && (
          <button onClick={() => setShowForm(true)} className="mt-8 w-full text-sm text-[#999] py-3 border border-dashed border-[#ddd] rounded-xl hover:border-[#bbb] hover:text-[#777] transition-colors">
            + Add
          </button>
        )}
      </div>
    </main>
  )
}
