'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'

import { ScopeColumn } from './ScopeColumn'
import { ScopeItem } from './ScopeItem'
import type { ScopeOutput } from '../../lib/schemas'

type ContainerType = 'in' | 'out'

type ScopeBoardProps = {
  scope: ScopeOutput
  frozen?: boolean
  onScopeChange?: (scope: ScopeOutput) => void
}

const isContainerId = (id: string): id is ContainerType => id === 'in' || id === 'out'

const findContainer = (scope: ScopeOutput, itemId: string): ContainerType | null => {
  if (scope.in_scope.some((item) => item.id === itemId)) {
    return 'in'
  }

  if (scope.out_scope.some((item) => item.id === itemId)) {
    return 'out'
  }

  return null
}

const resolveContainer = (scope: ScopeOutput, overId: string): ContainerType | null => {
  if (isContainerId(overId)) {
    return overId
  }

  return findContainer(scope, overId)
}

const moveAcrossContainers = (
  currentScope: ScopeOutput,
  activeId: string,
  overId: string,
  activeContainer: ContainerType,
  overContainer: ContainerType
): ScopeOutput | null => {
  if (activeContainer === 'in' && overContainer === 'out') {
    const activeIndex = currentScope.in_scope.findIndex((item) => item.id === activeId)
    if (activeIndex === -1) {
      return null
    }

    const source = currentScope.in_scope[activeIndex]
    const nextIn = currentScope.in_scope.filter((item) => item.id !== activeId)
    const nextItem = {
      id: source.id,
      title: source.title,
      desc: source.desc,
      reason: `Moved out from IN (${source.priority})`,
    }
    const overIndex =
      overId === 'out'
        ? currentScope.out_scope.length
        : currentScope.out_scope.findIndex((item) => item.id === overId)
    const insertIndex = overIndex >= 0 ? overIndex : currentScope.out_scope.length
    const nextOut = [
      ...currentScope.out_scope.slice(0, insertIndex),
      nextItem,
      ...currentScope.out_scope.slice(insertIndex),
    ]

    return { in_scope: nextIn, out_scope: nextOut }
  }

  if (activeContainer === 'out' && overContainer === 'in') {
    const activeIndex = currentScope.out_scope.findIndex((item) => item.id === activeId)
    if (activeIndex === -1) {
      return null
    }

    const source = currentScope.out_scope[activeIndex]
    const nextOut = currentScope.out_scope.filter((item) => item.id !== activeId)
    const nextItem = {
      id: source.id,
      title: source.title,
      desc: source.desc,
      priority: 'P1' as const,
    }
    const overIndex =
      overId === 'in'
        ? currentScope.in_scope.length
        : currentScope.in_scope.findIndex((item) => item.id === overId)
    const insertIndex = overIndex >= 0 ? overIndex : currentScope.in_scope.length
    const nextIn = [
      ...currentScope.in_scope.slice(0, insertIndex),
      nextItem,
      ...currentScope.in_scope.slice(insertIndex),
    ]

    return { in_scope: nextIn, out_scope: nextOut }
  }

  return null
}

const reorderWithinContainer = (
  currentScope: ScopeOutput,
  container: ContainerType,
  activeId: string,
  overId: string
): ScopeOutput | null => {
  if (container === 'in') {
    const oldIndex = currentScope.in_scope.findIndex((item) => item.id === activeId)
    const newIndex =
      overId === 'in'
        ? currentScope.in_scope.length - 1
        : currentScope.in_scope.findIndex((item) => item.id === overId)
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      return null
    }

    return {
      ...currentScope,
      in_scope: arrayMove(currentScope.in_scope, oldIndex, newIndex),
    }
  }

  const oldIndex = currentScope.out_scope.findIndex((item) => item.id === activeId)
  const newIndex =
    overId === 'out'
      ? currentScope.out_scope.length - 1
      : currentScope.out_scope.findIndex((item) => item.id === overId)
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
    return null
  }

  return {
    ...currentScope,
    out_scope: arrayMove(currentScope.out_scope, oldIndex, newIndex),
  }
}

export function ScopeBoard({ scope, frozen = false, onScopeChange }: ScopeBoardProps) {
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const boardScopeRef = useRef(scope)
  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor))

  useEffect(() => {
    boardScopeRef.current = {
      in_scope: scope.in_scope,
      out_scope: scope.out_scope,
    }
  }, [scope.in_scope, scope.out_scope])

  const activeItem = useMemo(() => {
    if (!activeItemId) {
      return null
    }

    return (
      scope.in_scope.find((item) => item.id === activeItemId) ??
      scope.out_scope.find((item) => item.id === activeItemId) ??
      null
    )
  }, [activeItemId, scope.in_scope, scope.out_scope])

  const activeContainer = useMemo(() => {
    if (!activeItemId) {
      return null
    }

    return findContainer(scope, activeItemId)
  }, [activeItemId, scope])

  const commitScope = (nextScope: ScopeOutput) => {
    boardScopeRef.current = nextScope
    onScopeChange?.(nextScope)
  }

  const handleDragStart = ({ active }: DragStartEvent) => {
    if (frozen) {
      return
    }
    setActiveItemId(String(active.id))
  }

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (frozen || !over) {
      return
    }

    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) {
      return
    }

    const currentScope = boardScopeRef.current
    const activeContainerInScope = findContainer(currentScope, activeId)
    const overContainerInScope = resolveContainer(currentScope, overId)

    if (
      !activeContainerInScope ||
      !overContainerInScope ||
      activeContainerInScope === overContainerInScope
    ) {
      return
    }

    const nextScope = moveAcrossContainers(
      currentScope,
      activeId,
      overId,
      activeContainerInScope,
      overContainerInScope
    )
    if (!nextScope) {
      return
    }

    commitScope(nextScope)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveItemId(null)

    if (frozen || !over) {
      return
    }

    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) {
      return
    }

    const currentScope = boardScopeRef.current
    const activeContainerInScope = findContainer(currentScope, activeId)
    const overContainerInScope = resolveContainer(currentScope, overId)

    if (
      !activeContainerInScope ||
      !overContainerInScope ||
      activeContainerInScope !== overContainerInScope
    ) {
      return
    }

    const nextScope = reorderWithinContainer(currentScope, activeContainerInScope, activeId, overId)
    if (!nextScope) {
      return
    }

    commitScope(nextScope)
  }

  return (
    <section className="relative mx-auto w-full max-w-5xl p-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveItemId(null)}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ScopeColumn title="IN Scope" container="in" items={scope.in_scope} frozen={frozen} />
          <ScopeColumn title="OUT Scope" container="out" items={scope.out_scope} frozen={frozen} />
        </div>
        <DragOverlay>
          {activeItem && activeContainer ? (
            <ScopeItem item={activeItem} container={activeContainer} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      {frozen ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/55 backdrop-blur-[1px]">
          <div className="rounded-md border border-black/20 bg-white px-3 py-1 text-xs font-medium tracking-wide text-black/70 uppercase">
            Scope Locked
          </div>
        </div>
      ) : null}
    </section>
  )
}
