'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Bubble } from './Bubble'
import { PathCards } from './PathCards'
import { jsonPost } from '../../lib/api'
import { streamPost } from '../../lib/sse'
import {
  PATHS,
  opportunityOutputSchema,
  type Direction,
  type OpportunityOutput,
  type PathId,
} from '../../lib/schemas'
import { useDecisionStore } from '../../lib/store'

const isAbortError = (error: unknown): boolean => {
  return error instanceof DOMException && error.name === 'AbortError'
}

const MAX_VISIBLE_BUBBLES = 3
const BUBBLE_RADIUS = 220
const MIN_BUBBLE_RADIUS = 140

export function IdeaCanvas() {
  const router = useRouter()
  const context = useDecisionStore((state) => state.context)
  const setIdea = useDecisionStore((state) => state.idea)
  const setOpportunity = useDecisionStore((state) => state.opportunity)
  const setDirection = useDecisionStore((state) => state.direction)
  const setPath = useDecisionStore((state) => state.path)
  const [ideaSeedInput, setIdeaSeedInput] = useState(context.idea_seed ?? '')
  const [directions, setDirections] = useState<Direction[]>(context.opportunity?.directions ?? [])
  const [progressPct, setProgressPct] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [bubbleRadius, setBubbleRadius] = useState(BUBBLE_RADIUS)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (context.opportunity?.directions) {
      setDirections(context.opportunity.directions)
    }
  }, [context.opportunity])

  useEffect(() => {
    const syncRadius = () => {
      const responsiveRadius = Math.floor(window.innerWidth * 0.3)
      setBubbleRadius(Math.max(MIN_BUBBLE_RADIUS, Math.min(BUBBLE_RADIUS, responsiveRadius)))
    }

    syncRadius()
    window.addEventListener('resize', syncRadius)
    return () => {
      window.removeEventListener('resize', syncRadius)
    }
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const ideaSeed = ideaSeedInput.trim()
    if (!ideaSeed) {
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setErrorMessage(null)
    setProgressPct(0)
    setDirections([])
    setIdea(ideaSeed)

    let streamedDonePayload: unknown = null
    try {
      let shouldFallback = false

      try {
        await streamPost(
          '/agents/opportunity/stream',
          { idea_seed: ideaSeed },
          {
            onProgress: (data) => {
              if (
                mountedRef.current &&
                typeof data === 'object' &&
                data !== null &&
                'pct' in data
              ) {
                const pct = Number((data as { pct: number }).pct)
                setProgressPct(Number.isFinite(pct) ? pct : 0)
              }
            },
            onPartial: (data) => {
              if (
                !mountedRef.current ||
                typeof data !== 'object' ||
                data === null ||
                !('direction' in data)
              ) {
                return
              }

              const parsed = opportunityOutputSchema.shape.directions.element.safeParse(
                (data as { direction: unknown }).direction
              )
              if (!parsed.success) {
                return
              }

              setDirections((prev) => {
                if (prev.some((item) => item.id === parsed.data.id)) {
                  return prev
                }
                return [...prev, parsed.data]
              })
            },
            onDone: (data) => {
              streamedDonePayload = data
            },
          },
          controller.signal
        )

        const streamedParsed = opportunityOutputSchema.safeParse(streamedDonePayload)
        if (!streamedParsed.success) {
          throw new Error('SSE ended without done payload.')
        }

        const streamedOutput: OpportunityOutput = streamedParsed.data
        if (mountedRef.current) {
          setDirections(streamedOutput.directions)
        }
        setOpportunity(streamedOutput)
      } catch (streamError) {
        if (isAbortError(streamError)) {
          return
        }

        shouldFallback = true
      }

      if (shouldFallback) {
        toast.message('SSE unavailable, fallback to JSON')
        const jsonOutput = await jsonPost<{ idea_seed: string }, OpportunityOutput>(
          '/agents/opportunity',
          { idea_seed: ideaSeed },
          { signal: controller.signal }
        )
        const parsed = opportunityOutputSchema.safeParse(jsonOutput)

        if (!parsed.success) {
          throw new Error('Opportunity payload shape mismatch.')
        }

        if (mountedRef.current) {
          setDirections(parsed.data.directions)
        }
        setOpportunity(parsed.data)
      }
    } catch (error) {
      if (!isAbortError(error) && mountedRef.current) {
        const message = error instanceof Error ? error.message : '请求失败，请稍后重试。'
        setErrorMessage(message)
        toast.error(message)
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
      }
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }

  const handleSelectDirection = (directionId: Direction['id']) => {
    setDirection(directionId)
    toast.success(`Direction ${directionId} selected`)
  }

  const handleSelectPath = (pathId: PathId) => {
    setPath(pathId)
    toast.success('Path selected, moving to feasibility')
    router.push('/feasibility')
  }

  const visibleDirections = useMemo(() => {
    return directions.slice(0, MAX_VISIBLE_BUBBLES)
  }, [directions])

  const selectedDirectionId = context.selected_direction_id

  const bubbleLayout = useMemo(() => {
    return visibleDirections.map((direction, index) => {
      const angleDeg = -90 + (index * 360) / MAX_VISIBLE_BUBBLES
      const angle = (angleDeg * Math.PI) / 180

      return {
        direction,
        x: Math.cos(angle) * bubbleRadius,
        y: Math.sin(angle) * bubbleRadius,
      }
    })
  }, [visibleDirections, bubbleRadius])

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Idea Canvas</h1>
        <p className="mt-2 text-sm text-black/70">
          输入 idea seed，先拿到方向，再选路径进入 feasibility。
        </p>
      </header>

      <div className="relative isolate h-[620px] overflow-hidden rounded-[32px] border border-black/10 bg-[radial-gradient(circle_at_20%_20%,rgba(0,0,0,0.06),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(0,0,0,0.05),transparent_40%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/5" />

        <motion.form
          onSubmit={handleSubmit}
          animate={{
            opacity: selectedDirectionId ? 0.28 : 1,
            scale: selectedDirectionId ? 0.95 : 1,
          }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="absolute top-1/2 left-1/2 z-10 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-black/15 bg-white/95 p-5 shadow-lg backdrop-blur"
        >
          <label htmlFor="idea-seed" className="text-sm font-medium">
            Idea Seed
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="idea-seed"
              value={ideaSeedInput}
              onChange={(event) => setIdeaSeedInput(event.currentTarget.value)}
              placeholder="例如：给独立开发者做一个 7 天交付决策助手"
              className="w-full rounded-md border border-black/20 px-3 py-2 text-sm outline-none focus:border-black"
            />
            <button
              type="submit"
              disabled={loading || !ideaSeedInput.trim()}
              className="rounded-md border border-black px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Directions'}
            </button>
          </div>
          {loading ? <p className="mt-2 text-xs text-black/60">Streaming {progressPct}%</p> : null}
          {errorMessage ? <p className="mt-2 text-xs text-red-600">{errorMessage}</p> : null}
        </motion.form>

        {bubbleLayout.map(({ direction, x, y }) => {
          const selected = selectedDirectionId === direction.id
          const hasSelected = Boolean(selectedDirectionId)

          return (
            <motion.div
              key={direction.id}
              className="absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
              initial={{ opacity: 0, scale: 0.7, x: 0, y: 0 }}
              animate={
                hasSelected
                  ? selected
                    ? { x: 0, y: 0, opacity: 1, scale: 1.06 }
                    : { x, y, opacity: 0.2, scale: 0.9 }
                  : { x, y, opacity: 1, scale: 1 }
              }
              transition={{
                type: 'spring',
                stiffness: 280,
                damping: 24,
                mass: 0.8,
              }}
            >
              <Bubble
                direction={direction}
                selected={selected}
                subdued={hasSelected && !selected}
                onClick={() => handleSelectDirection(direction.id)}
              />
            </motion.div>
          )
        })}

        <AnimatePresence>
          {!loading && bubbleLayout.length === 0 ? (
            <motion.div
              key="empty-hint"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-dashed border-black/20 bg-white/75 px-4 py-2 text-xs text-black/60"
            >
              提交 idea seed 后，这里会出现 3 个方向气泡。
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {context.selected_direction_id ? (
          <motion.div
            key="paths"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <PathCards
              paths={PATHS}
              selectedPathId={context.path_id}
              onSelect={(pathId) => handleSelectPath(pathId)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="path-hint"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="rounded-lg border border-dashed border-black/30 p-4 text-sm text-black/70"
          >
            先选择一个方向，再选择路径。
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
