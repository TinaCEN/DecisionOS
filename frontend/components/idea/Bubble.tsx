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
      aria-pressed={selected}
      disabled={!onClick}
      onClick={onClick}
      className={[
        'group w-[min(82vw,290px)] rounded-full border px-5 py-4 text-left shadow-sm transition-all duration-200 motion-reduce:transition-none',
        'focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none',
        selected
          ? 'border-slate-900 bg-slate-900 text-slate-50 shadow-lg shadow-slate-900/20'
          : 'border-slate-200 bg-white/95 text-slate-900 backdrop-blur hover:border-cyan-400/60 hover:bg-cyan-50/40 hover:shadow-md active:translate-y-px',
        subdued ? 'opacity-65 saturate-75' : '',
      ].join(' ')}
    >
      <div className="text-sm font-medium tracking-tight">{direction.title}</div>
      <div className="mt-1 text-xs leading-5 opacity-80">{direction.one_liner}</div>
      <div
        className={[
          'mt-2 hidden flex-wrap gap-1 text-[11px] opacity-75',
          selected ? 'flex' : 'group-hover:flex group-focus-visible:flex',
        ].join(' ')}
      >
        {direction.pain_tags.map((tag) => (
          <span key={tag} className="rounded-full border border-current px-2 py-0.5">
            {tag}
          </span>
        ))}
      </div>
    </button>
  )
}
