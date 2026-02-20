import type { PathId, PathOption } from '../../lib/schemas'

type PathCardsProps = {
  paths: PathOption[]
  selectedPathId?: PathId
  onSelect?: (pathId: PathId) => void
}

export function PathCards({ paths, selectedPathId, onSelect }: PathCardsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {paths.map((path) => {
        const selected = selectedPathId === path.id
        return (
          <button
            key={path.id}
            type="button"
            aria-pressed={selected}
            disabled={!onSelect}
            onClick={() => onSelect?.(path.id)}
            className={[
              'group rounded-2xl border p-4 text-left shadow-sm transition-all duration-200 motion-reduce:transition-none',
              'focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none',
              selected
                ? 'border-slate-900 bg-slate-900 text-slate-50 shadow-md shadow-slate-900/20'
                : 'border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-cyan-400/60 hover:bg-cyan-50/40 hover:shadow-md active:translate-y-0',
            ].join(' ')}
          >
            <div className="text-sm font-semibold tracking-tight">{path.name}</div>
            <div className="mt-1 text-xs leading-5 text-current/80">{path.focus}</div>
          </button>
        )
      })}
    </div>
  )
}
