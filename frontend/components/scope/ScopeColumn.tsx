'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { SortableScopeItem } from './ScopeItem'
import type { InScopeItem, OutScopeItem } from '../../lib/schemas'

type ScopeColumnProps = {
  title: string
  container: 'in' | 'out'
  items: Array<InScopeItem | OutScopeItem>
  frozen?: boolean
}

export function ScopeColumn({ title, container, items, frozen = false }: ScopeColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: container,
    disabled: frozen,
  })

  return (
    <section
      className={[
        'rounded-xl border border-black/20 bg-black/[0.02] p-4',
        isOver && !frozen ? 'ring-2 ring-black/20' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      <div
        ref={setNodeRef}
        className="mt-3 flex min-h-36 flex-col gap-2 rounded-md border border-dashed border-transparent p-1"
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <SortableScopeItem key={item.id} item={item} container={container} frozen={frozen} />
          ))}
        </SortableContext>
      </div>
    </section>
  )
}
