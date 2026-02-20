import type { DecisionContext, PrdOutput } from '../../lib/schemas'

type PrdViewProps = {
  prd?: PrdOutput
  context: DecisionContext
  loading?: boolean
  errorMessage?: string | null
}

export function PrdView({ prd, context, loading = false, errorMessage = null }: PrdViewProps) {
  const inScopeTitles = context.scope?.in_scope.map((item) => item.title) ?? []
  const contextRows = [
    { label: 'Idea Seed', value: context.idea_seed ?? 'N/A' },
    { label: 'Confirmed DAG Path', value: context.confirmed_dag_path_id ?? 'N/A' },
    { label: 'Selected Plan', value: context.selected_plan_id ?? 'N/A' },
    { label: 'Scope Frozen', value: context.scope_frozen ? 'Yes' : 'No' },
  ]

  return (
    <section className="mx-auto w-full max-w-4xl p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">PRD</h1>
        <p className="mt-2 text-sm text-slate-600">
          Product requirements synthesized from decisions.
        </p>
        {loading ? <p className="mt-2 text-xs text-slate-500">Generating PRD...</p> : null}
        {errorMessage ? <p className="mt-2 text-xs text-red-600">{errorMessage}</p> : null}
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

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
        <h2 className="border-b border-slate-800 px-5 py-3 text-xs font-semibold tracking-wide text-slate-300 uppercase">
          PRD Markdown
        </h2>
        <pre className="max-h-[70vh] overflow-x-auto px-5 py-4 text-sm leading-6 break-words whitespace-pre-wrap text-slate-100">
          {loading
            ? 'Generating PRD...'
            : (prd?.markdown ??
              `# PRD Placeholder\n\n- problem: ${context.idea_seed ?? 'N/A'}\n- confirmed_path: ${
                context.confirmed_dag_path_id ?? 'N/A'
              }\n- selected plan: ${context.selected_plan_id ?? 'N/A'}`)}
        </pre>
      </section>
    </section>
  )
}
