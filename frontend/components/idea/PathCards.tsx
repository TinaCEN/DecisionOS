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
            onClick={() => onSelect?.(path.id)}
            className={[
              'rounded-xl border p-4 text-left',
              selected ? 'border-black bg-black text-white' : 'border-black/20 bg-white',
            ].join(' ')}
          >
            <div className="text-sm font-semibold">{path.name}</div>
            <div className="mt-1 text-xs opacity-80">{path.focus}</div>
          </button>
        )
      })}
    </div>
  )
}
