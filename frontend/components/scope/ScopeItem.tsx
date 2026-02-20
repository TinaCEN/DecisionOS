'use client'

import type { CSSProperties, HTMLAttributes } from 'react'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type { ScopeBaselineItem } from '../../lib/schemas'

type ScopeItemProps = {
  item: ScopeBaselineItem
  readonly?: boolean
  disableMoveUp?: boolean
  disableMoveDown?: boolean
  onDelete: (itemId: string) => void
  onMove: (itemId: string, direction: 'up' | 'down') => void
  setNodeRef?: (element: HTMLElement | null) => void
  style?: CSSProperties
  dragBindings?: HTMLAttributes<HTMLElement>
  isDragging?: boolean
  isOverlay?: boolean
}

export function ScopeItem({
  item,
  readonly = false,
  disableMoveUp = false,
  disableMoveDown = false,
  onDelete,
  onMove,
  setNodeRef,
  style,
  dragBindings,
  isDragging = false,
  isOverlay = false,
}: ScopeItemProps) {
  return (
    <article
      ref={setNodeRef}
      style={style}
      {...dragBindings}
      className={[
        'rounded-lg border border-black/10 bg-white p-3',
        readonly ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing',
        isDragging ? 'opacity-40' : '',
        isOverlay ? 'shadow-xl ring-1 ring-black/15' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-black/85">{item.content}</p>
        <span className="text-[11px] text-black/40">Drag</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={readonly || disableMoveUp}
          onClick={() => onMove(item.id, 'up')}
          className="rounded border border-black/20 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          Up
        </button>
        <button
          type="button"
          disabled={readonly || disableMoveDown}
          onClick={() => onMove(item.id, 'down')}
          className="rounded border border-black/20 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          Down
        </button>
        <button
          type="button"
          disabled={readonly}
          onClick={() => onDelete(item.id)}
          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Delete ${item.content}`}
        >
          Delete
        </button>
      </div>
    </article>
  )
}

type SortableScopeItemProps = {
  item: ScopeBaselineItem
  readonly?: boolean
  disableMoveUp?: boolean
  disableMoveDown?: boolean
  onDelete: (itemId: string) => void
  onMove: (itemId: string, direction: 'up' | 'down') => void
}

export function SortableScopeItem({
  item,
  readonly = false,
  disableMoveUp = false,
  disableMoveDown = false,
  onDelete,
  onMove,
}: SortableScopeItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: readonly,
    data: { lane: item.lane },
  })

  return (
    <ScopeItem
      item={item}
      readonly={readonly}
      disableMoveUp={disableMoveUp}
      disableMoveDown={disableMoveDown}
      onDelete={onDelete}
      onMove={onMove}
      setNodeRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      dragBindings={{ ...(attributes as HTMLAttributes<HTMLElement>), ...listeners }}
      isDragging={isDragging}
    />
  )
}
