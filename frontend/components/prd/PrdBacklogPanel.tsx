import { useMemo, useState } from 'react'

import type { PrdBacklogItem, PrdSourceRef } from '../../lib/schemas'

type PrdBacklogPanelProps = {
  items: PrdBacklogItem[]
  selectedRequirementId: string | null
  onSelectRequirement: (requirementId: string) => void
}

type FilterValue = 'all' | string

export function PrdBacklogPanel({
  items,
  selectedRequirementId,
  onSelectRequirement,
}: PrdBacklogPanelProps) {
  const [priorityFilter, setPriorityFilter] = useState<FilterValue>('all')
  const [typeFilter, setTypeFilter] = useState<FilterValue>('all')
  const [sourceFilter, setSourceFilter] = useState<FilterValue>('all')

  const sourceOptions = useMemo(() => {
    const refs = new Set<PrdSourceRef>()
    for (const item of items) {
      for (const ref of item.source_refs) {
        refs.add(ref)
      }
    }
    return Array.from(refs.values()).sort()
  }, [items])

  const filtered = items.filter((item) => {
    if (priorityFilter !== 'all' && item.priority !== priorityFilter) {
      return false
    }
    if (typeFilter !== 'all' && item.type !== typeFilter) {
      return false
    }
    if (sourceFilter !== 'all' && !item.source_refs.includes(sourceFilter as PrdSourceRef)) {
      return false
    }
    return true
  })

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">Backlog</h2>
        <p className="text-xs text-slate-600">
          Filter and inspect requirement-linked execution items.
        </p>
      </header>

      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-slate-700">
          Priority
          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="P0">P0</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
          </select>
        </label>
        <label className="text-xs text-slate-700">
          Type
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="epic">Epic</option>
            <option value="story">Story</option>
            <option value="task">Task</option>
          </select>
        </label>
        <label className="text-xs text-slate-700">
          Source
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="all">All</option>
            {sourceOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className="max-h-[52vh] space-y-2 overflow-auto pr-1">
        {filtered.map((item) => {
          const active = selectedRequirementId === item.requirement_id
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelectRequirement(item.requirement_id)}
                className={`w-full rounded-lg border px-3 py-3 text-left text-sm transition ${
                  active
                    ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-300'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="mt-1 text-xs text-slate-700">{item.summary}</p>
                <p className="mt-2 text-[11px] text-slate-500">
                  {item.priority} · {item.type} · req {item.requirement_id}
                </p>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
