'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  type DragEndEvent,
  type DragStartEvent,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core'

import { ScopeColumn } from './ScopeColumn'
import { ScopeItem } from './ScopeItem'
import type { ScopeBaselineItem, ScopeBaselineLane } from '../../lib/schemas'

type ScopeBoardProps = {
  items: ScopeBaselineItem[]
  readonly?: boolean
  onAddItem: (lane: 'in' | 'out', content: string) => void
  onDeleteItem: (itemId: string) => void
  onMoveItem: (itemId: string, direction: 'up' | 'down') => void
  onReorderItems: (items: ScopeBaselineItem[]) => void
}

const sortByDisplayOrder = (items: ScopeBaselineItem[]): ScopeBaselineItem[] => {
  return [...items].sort((left, right) => left.display_order - right.display_order)
}

export function ScopeBoard({
  items,
  readonly = false,
  onAddItem,
  onDeleteItem,
  onMoveItem,
  onReorderItems,
}: ScopeBoardProps) {
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor))
  const inItems = useMemo(
    () => sortByDisplayOrder(items.filter((item) => item.lane === 'in')),
    [items]
  )
  const outItems = useMemo(
    () => sortByDisplayOrder(items.filter((item) => item.lane === 'out')),
    [items]
  )
  const activeItem = useMemo(
    () => items.find((item) => item.id === activeItemId) ?? null,
    [activeItemId, items]
  )

  const laneFromOverId = (overId: string): ScopeBaselineLane | null => {
    if (overId === 'in' || overId === 'out') {
      return overId
    }
    return items.find((item) => item.id === overId)?.lane ?? null
  }

  const reorderByDrag = (activeId: string, overId: string): ScopeBaselineItem[] | null => {
    const active = items.find((item) => item.id === activeId)
    if (!active) {
      return null
    }

    const targetLane = laneFromOverId(overId)
    if (!targetLane) {
      return null
    }

    const remaining = items.filter((item) => item.id !== activeId)
    const inLane = sortByDisplayOrder(remaining.filter((item) => item.lane === 'in'))
    const outLane = sortByDisplayOrder(remaining.filter((item) => item.lane === 'out'))

    const targetList = targetLane === 'in' ? inLane : outLane
    const targetIndex =
      overId === targetLane
        ? targetList.length
        : Math.max(
            0,
            targetList.findIndex((item) => item.id === overId)
          )

    targetList.splice(targetIndex, 0, {
      ...active,
      lane: targetLane,
    })

    const normalizedIn = inLane.map((item, index) => ({ ...item, display_order: index }))
    const normalizedOut = outLane.map((item, index) => ({ ...item, display_order: index }))
    return [...normalizedIn, ...normalizedOut]
  }

  const handleDragStart = ({ active }: DragStartEvent) => {
    if (readonly) {
      return
    }
    setActiveItemId(String(active.id))
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveItemId(null)
    if (readonly || !over) {
      return
    }

    const activeId = String(active.id)
    const overId = String(over.id)
    if (!activeId || !overId || activeId === overId) {
      return
    }

    const next = reorderByDrag(activeId, overId)
    if (!next) {
      return
    }
    onReorderItems(next)
  }

  return (
    <section className="relative mx-auto w-full max-w-5xl p-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveItemId(null)}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ScopeColumn
            title="IN Scope"
            lane="in"
            items={inItems}
            readonly={readonly}
            onAdd={onAddItem}
            onDelete={onDeleteItem}
            onMove={onMoveItem}
          />
          <ScopeColumn
            title="OUT Scope"
            lane="out"
            items={outItems}
            readonly={readonly}
            onAdd={onAddItem}
            onDelete={onDeleteItem}
            onMove={onMoveItem}
          />
        </div>
        <DragOverlay>
          {activeItem ? (
            <ScopeItem
              item={activeItem}
              readonly
              onDelete={onDeleteItem}
              onMove={onMoveItem}
              isOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {readonly ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/45 backdrop-blur-[1px]">
          <div className="rounded-md border border-black/20 bg-white px-3 py-1 text-xs font-medium tracking-wide text-black/70 uppercase">
            Scope Locked
          </div>
        </div>
      ) : null}
    </section>
  )
}
