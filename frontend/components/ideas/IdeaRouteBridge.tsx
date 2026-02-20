'use client'

import Link from 'next/link'
import { useEffect } from 'react'

import { buildIdeaStepHref } from '../../lib/idea-routes'
import { useIdeasStore } from '../../lib/ideas-store'

type IdeaRouteBridgeProps = Readonly<{
  ideaId: string
  stepLabel: string
  legacyHref: '/idea-canvas' | '/feasibility' | '/scope-freeze' | '/prd'
}>

export function IdeaRouteBridge({ ideaId, stepLabel, legacyHref }: IdeaRouteBridgeProps) {
  const setActiveIdeaId = useIdeasStore((state) => state.setActiveIdeaId)
  const step =
    legacyHref === '/idea-canvas'
      ? 'idea-canvas'
      : legacyHref === '/scope-freeze'
        ? 'scope-freeze'
        : legacyHref === '/prd'
          ? 'prd'
          : 'feasibility'

  useEffect(() => {
    setActiveIdeaId(ideaId)
  }, [ideaId, setActiveIdeaId])

  return (
    <main className="mx-auto max-w-4xl p-6">
      <section className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{stepLabel}</h1>
        <p className="mt-2 text-sm text-slate-600">
          You are currently in an idea-scoped route:{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">{ideaId}</code>
        </p>
        <p className="mt-2 text-sm text-slate-600">
          This step has moved to an idea-scoped flow. Continue under the current idea.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href={buildIdeaStepHref(ideaId, step)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Open Scoped Flow
          </Link>
          <Link
            href="/ideas"
            className="rounded-md border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-100"
          >
            Back to Ideas
          </Link>
        </div>
      </section>
    </main>
  )
}
