import type { Direction } from '../../lib/schemas'

type BubbleProps = {
  direction: Direction
  selected?: boolean
  subdued?: boolean
  onClick?: () => void
}

export function Bubble({ direction, selected = false, subdued = false, onClick }: BubbleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group w-[min(82vw,290px)] rounded-full border px-5 py-4 text-left shadow-sm transition',
        selected
          ? 'border-black bg-black text-white shadow-lg shadow-black/20'
          : 'border-black/20 bg-white/95 backdrop-blur',
        subdued ? 'opacity-70' : '',
      ].join(' ')}
    >
      <div className="text-sm font-medium">{direction.title}</div>
      <div className="mt-1 text-xs opacity-80">{direction.one_liner}</div>
      <div className="mt-2 hidden flex-wrap gap-1 text-[11px] opacity-75 group-hover:flex">
        {direction.pain_tags.map((tag) => (
          <span key={tag} className="rounded-full border border-current px-2 py-0.5">
            {tag}
          </span>
        ))}
      </div>
    </button>
  )
}
