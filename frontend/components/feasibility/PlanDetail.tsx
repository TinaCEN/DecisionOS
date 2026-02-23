import type { FeasibilityPlan } from '../../lib/schemas'

type PlanDetailProps = {
  plan: FeasibilityPlan | null
}

export function PlanDetail({ plan }: PlanDetailProps) {
  if (!plan) {
    return (
      <section className="mx-auto w-full max-w-3xl rounded-xl border border-dashed p-6">
        <h1 className="text-xl font-semibold">Plan not found</h1>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-3xl rounded-xl border border-black/20 p-6">
      <h1 className="text-2xl font-bold">{plan.name}</h1>
      <p className="mt-2 text-sm text-black/70">{plan.summary}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3 text-sm">
          Technical: {plan.scores.technical_feasibility.toFixed(1)}
        </div>
        <div className="rounded-lg border p-3 text-sm">
          Market: {plan.scores.market_viability.toFixed(1)}
        </div>
        <div className="rounded-lg border p-3 text-sm">
          Risk Control: {plan.scores.execution_risk.toFixed(1)}
        </div>
      </div>

      <section className="mt-6 grid gap-3 text-sm">
        <div className="rounded-lg border p-3">
          <h2 className="font-semibold">Reasoning · Technical</h2>
          <p className="mt-1 text-black/70">{plan.reasoning.technical_feasibility}</p>
        </div>
        <div className="rounded-lg border p-3">
          <h2 className="font-semibold">Reasoning · Market</h2>
          <p className="mt-1 text-black/70">{plan.reasoning.market_viability}</p>
        </div>
        <div className="rounded-lg border p-3">
          <h2 className="font-semibold">Reasoning · Execution Risk</h2>
          <p className="mt-1 text-black/70">{plan.reasoning.execution_risk}</p>
        </div>
      </section>

      <section className="mt-6 rounded-lg border p-3 text-sm">
        <h2 className="font-semibold">Recommended Positioning</h2>
        <p className="mt-1 text-black/70">{plan.recommended_positioning}</p>
      </section>
    </section>
  )
}
