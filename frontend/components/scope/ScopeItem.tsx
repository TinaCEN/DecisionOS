'use client'

import type { CSSProperties, HTMLAttributes } from 'react'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type { InScopeItem, OutScopeItem } from '../../lib/schemas'

type ContainerType = 'in' | 'out'

type ScopeItemProps = {
  item: InScopeItem | OutScopeItem
  container: ContainerType
  frozen?: boolean
  isDragging?: boolean
  isOverlay?: boolean
  setNodeRef?: (element: HTMLElement | null) => void
  style?: CSSProperties
  dragBindings?: HTMLAttributes<HTMLElement>
}

type SortableScopeItemProps = {
  item: InScopeItem | OutScopeItem
  container: ContainerType
  frozen?: boolean
}

export function ScopeItem({
  item,
  container,
  frozen = false,
  isDragging = false,
  isOverlay = false,
  setNodeRef,
  style,
  dragBindings,
}: ScopeItemProps) {
  const extraLabel =
    container === 'in' && 'priority' in item
      ? `Priority: ${item.priority}`
      : container === 'out' && 'reason' in item
        ? `Reason: ${item.reason}`
        : ''

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...dragBindings}
      className={[
        'rounded-lg border border-black/10 bg-white p-3',
        frozen ? 'cursor-not-allowed opacity-70' : 'cursor-grab active:cursor-grabbing',
        isDragging ? 'opacity-40' : '',
        isOverlay ? 'shadow-xl ring-1 ring-black/15' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h4 className="text-sm font-semibold">{item.title}</h4>
      <p className="mt-1 text-xs text-black/70">{item.desc}</p>
      {extraLabel ? <p className="mt-2 text-[11px] text-black/60">{extraLabel}</p> : null}
    </article>
  )
}

export function SortableScopeItem({ item, container, frozen = false }: SortableScopeItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: frozen,
    data: { container },
  })

  return (
    <ScopeItem
      item={item}
      container={container}
      frozen={frozen}
      isDragging={isDragging}
      setNodeRef={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      dragBindings={{ ...(attributes as HTMLAttributes<HTMLElement>), ...listeners }}
    />
  )
}
