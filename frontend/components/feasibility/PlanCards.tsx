'use client'

import { useRouter } from 'next/navigation'

import type { FeasibilityPlan } from '../../lib/schemas'

type PlanCardsProps = {
  plans: FeasibilityPlan[]
  selectedPlanId?: string
  onSelect?: (planId: string) => void
}

export function PlanCards({ plans, selectedPlanId, onSelect }: PlanCardsProps) {
  const router = useRouter()

  return (
    <section className="grid gap-4 md:grid-cols-3">
      {plans.map((plan) => {
        const selected = selectedPlanId === plan.id

        return (
          <article
            key={plan.id}
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/feasibility/${plan.id}`)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                router.push(`/feasibility/${plan.id}`)
              }
            }}
            className={[
              'group cursor-pointer rounded-xl border p-4',
              selected ? 'border-black bg-black text-white' : 'border-black/20 bg-white',
            ].join(' ')}
          >
            <h2 className="text-base font-semibold">{plan.name}</h2>
            <p className="mt-2 text-sm opacity-80">{plan.summary}</p>
            <p className="mt-4 text-sm">Overall: {plan.score_overall.toFixed(1)}</p>
            <div className="mt-3 hidden rounded-lg border border-current/20 p-2 text-xs group-hover:block">
              <div>Tech: {plan.scores.technical_feasibility.toFixed(1)}</div>
              <div>Market: {plan.scores.market_viability.toFixed(1)}</div>
              <div>Risk Control: {plan.scores.execution_risk.toFixed(1)}</div>
            </div>
            <div className="mt-4 flex gap-2">
              {onSelect ? (
                <button
                  type="button"
                  className="rounded-md border border-current px-2 py-1 text-xs"
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelect(plan.id)
                  }}
                >
                  Select
                </button>
              ) : null}
              <span className="rounded-md border border-current px-2 py-1 text-xs">
                View Detail
              </span>
            </div>
          </article>
        )
      })}
    </section>
  )
}
