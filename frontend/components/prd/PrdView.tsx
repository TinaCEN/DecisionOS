import type { DecisionContext, PrdOutput } from '../../lib/schemas'

type PrdViewProps = {
  prd?: PrdOutput
  context: DecisionContext
}

export function PrdView({ prd, context }: PrdViewProps) {
  const selectedDirection = context.opportunity?.directions.find(
    (direction) => direction.id === context.selected_direction_id
  )
  const inScopeTitles = context.scope?.in_scope.map((item) => item.title) ?? []

  return (
    <section className="mx-auto w-full max-w-4xl p-6">
      <h1 className="text-2xl font-bold">PRD</h1>
      <div className="mt-4 grid gap-3 rounded-xl border border-black/20 bg-white p-4 text-sm">
        <p>
          <span className="font-semibold">Idea Seed:</span> {context.idea_seed ?? 'N/A'}
        </p>
        <p>
          <span className="font-semibold">Direction:</span> {selectedDirection?.title ?? 'N/A'}
        </p>
        <p>
          <span className="font-semibold">Path:</span> {context.path_id ?? 'N/A'}
        </p>
        <p>
          <span className="font-semibold">Selected Plan:</span> {context.selected_plan_id ?? 'N/A'}
        </p>
        <p>
          <span className="font-semibold">Scope Frozen:</span> {context.scope_frozen ? 'Yes' : 'No'}
        </p>
        <p>
          <span className="font-semibold">IN Scope:</span>{' '}
          {inScopeTitles.length ? inScopeTitles.join(' / ') : 'N/A'}
        </p>
      </div>
      <pre className="mt-4 overflow-x-auto rounded-xl border border-black/20 bg-black/[0.02] p-4 text-sm">
        {prd?.markdown ??
          `# PRD Placeholder\n\n- problem: ${context.idea_seed ?? 'N/A'}\n- direction: ${
            selectedDirection?.title ?? 'N/A'
          }\n- selected plan: ${context.selected_plan_id ?? 'N/A'}`}
      </pre>
    </section>
  )
}
