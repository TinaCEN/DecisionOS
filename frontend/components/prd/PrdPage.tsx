'use client'

import { GuardPanel } from '../common/GuardPanel'
import { PrdView } from './PrdView'
import { canOpenPrd } from '../../lib/guards'
import { useDecisionStore } from '../../lib/store'

export function PrdPage() {
  const context = useDecisionStore((state) => state.context)
  const canOpen = canOpenPrd(context)

  if (!canOpen) {
    return (
      <main>
        <section className="mx-auto mt-6 w-full max-w-4xl px-6">
          <GuardPanel
            title="PRD context not ready"
            description="Complete Scope Freeze before opening the PRD page."
          />
        </section>
      </main>
    )
  }

  return (
    <main>
      <PrdView prd={context.prd} context={context} />
    </main>
  )
}
