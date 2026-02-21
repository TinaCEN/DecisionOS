import { useMemo, useState } from 'react'

import type {
  DecisionContext,
  PrdBundle,
  PrdFeedbackDimensions,
  PrdFeedbackLatest,
  PrdOutput,
} from '../../lib/schemas'
import { PrdBacklogPanel } from './PrdBacklogPanel'
import { PrdFeedbackCard } from './PrdFeedbackCard'

type PrdViewProps = {
  prd?: PrdOutput
  bundle?: PrdBundle
  baselineId?: string | null
  feedbackLatest?: PrdFeedbackLatest
  context: DecisionContext
  loading?: boolean
  errorMessage?: string | null
  onRetry?: () => void
  onSubmitFeedback?: (payload: {
    rating_overall: number
    rating_dimensions: PrdFeedbackDimensions
    comment?: string
  }) => Promise<void>
  feedbackSubmitting?: boolean
  feedbackError?: string | null
}

export function PrdView({
  prd,
  bundle,
  baselineId = null,
  feedbackLatest,
  context,
  loading = false,
  errorMessage = null,
  onRetry,
  onSubmitFeedback,
  feedbackSubmitting = false,
  feedbackError = null,
}: PrdViewProps) {
  const output = prd ?? bundle?.output
  const [selectedRequirementIdInput, setSelectedRequirementIdInput] = useState<string | null>(null)
  const selectedRequirementId = output?.requirements.some(
    (item) => item.id === selectedRequirementIdInput
  )
    ? selectedRequirementIdInput
    : (output?.requirements[0]?.id ?? null)

  const inScopeTitles = context.scope?.in_scope.map((item) => item.title) ?? []
  const contextRows = [
    { label: 'Idea Seed', value: context.idea_seed ?? 'N/A' },
    { label: 'Confirmed DAG Path', value: context.confirmed_dag_path_id ?? 'N/A' },
    { label: 'Selected Plan', value: context.selected_plan_id ?? 'N/A' },
    { label: 'Scope Frozen', value: context.scope_frozen ? 'Yes' : 'No' },
  ]
  const requirementsById = useMemo(
    () =>
      Object.fromEntries(
        (output?.requirements ?? []).map((item) => [item.id, item.title] as const)
      ),
    [output]
  )
  const hasStaleBundle = Boolean(errorMessage && bundle?.output)

  return (
    <section className="mx-auto w-full max-w-6xl p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">PRD + Backlog</h1>
        <p className="mt-2 text-sm text-slate-600">
          Product requirements synthesized from decisions.
        </p>
        {baselineId ? <p className="mt-1 text-xs text-slate-500">Baseline: {baselineId}</p> : null}
        {loading ? (
          <p className="mt-2 text-xs text-slate-500">Generating PRD and backlog...</p>
        ) : null}
        {errorMessage ? (
          <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            <p>{errorMessage}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 min-h-11 rounded-md border border-red-300 px-3 py-2 text-sm"
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : null}
        {hasStaleBundle ? (
          <p className="mt-2 text-xs text-amber-700">
            Showing last successful output as stale snapshot.
          </p>
        ) : null}
      </header>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">
          Decision Context
        </h2>
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          {contextRows.map((row) => (
            <div key={row.label} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                {row.label}
              </dt>
              <dd className="mt-1 text-sm leading-6 text-slate-900">{row.value}</dd>
            </div>
          ))}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 md:col-span-2">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">IN Scope</dt>
            <dd className="mt-1 text-sm leading-6 text-slate-900">
              {inScopeTitles.length ? inScopeTitles.join(' / ') : 'N/A'}
            </dd>
          </div>
        </dl>
      </section>

      {output ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.45fr_1fr]">
          <section className="space-y-4">
            <article className="rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
              <h2 className="border-b border-slate-800 px-5 py-3 text-xs font-semibold tracking-wide text-slate-300 uppercase">
                PRD Markdown
              </h2>
              <pre className="max-h-[52vh] overflow-x-auto px-5 py-4 text-sm leading-6 break-words whitespace-pre-wrap text-slate-100">
                {output.markdown}
              </pre>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Sections</h2>
              <ul className="mt-2 space-y-2">
                {output.sections.map((section) => (
                  <li
                    key={section.id}
                    className="rounded-md border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="text-xs font-medium text-slate-500">{section.title}</p>
                    <p className="mt-1 text-sm text-slate-900">{section.content}</p>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Requirements</h2>
              <ul className="mt-2 space-y-2">
                {output.requirements.map((item) => {
                  const active = selectedRequirementId === item.id
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedRequirementIdInput(item.id)}
                        className={`w-full rounded-md border px-3 py-3 text-left ${
                          active
                            ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-300'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <p className="text-sm font-medium text-slate-900">
                          {item.id} · {item.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-700">{item.description}</p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </article>
          </section>

          <section className="space-y-4">
            <PrdBacklogPanel
              items={output.backlog.items}
              selectedRequirementId={selectedRequirementId}
              onSelectRequirement={setSelectedRequirementIdInput}
            />
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {selectedRequirementId
                ? `Selected requirement: ${selectedRequirementId} (${requirementsById[selectedRequirementId] ?? 'N/A'})`
                : 'Select a requirement to inspect linked backlog items.'}
            </div>
            {baselineId && onSubmitFeedback ? (
              <PrdFeedbackCard
                key={`${baselineId}:${feedbackLatest?.submitted_at ?? 'draft'}`}
                baselineId={baselineId}
                latest={feedbackLatest}
                disabled={feedbackSubmitting}
                submitting={feedbackSubmitting}
                errorMessage={feedbackError}
                onSubmit={onSubmitFeedback}
              />
            ) : null}
          </section>
        </div>
      ) : (
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          {loading ? 'Preparing PRD and backlog...' : 'No PRD generated yet.'}
          {onRetry && !loading ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={onRetry}
                className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                Generate
              </button>
            </div>
          ) : null}
        </section>
      )}
    </section>
  )
}
