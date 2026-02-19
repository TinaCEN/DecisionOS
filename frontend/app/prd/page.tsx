'use client'

import { GuardPanel } from '../../components/common/GuardPanel'
import { PrdView } from '../../components/prd/PrdView'
import { canOpenPrd } from '../../lib/guards'
import { useDecisionStore } from '../../lib/store'

export default function PrdPage() {
  const context = useDecisionStore((state) => state.context)
  const canOpen = canOpenPrd(context)

  return (
    <main>
      {!canOpen ? (
        <section className="mx-auto mt-6 w-full max-w-4xl px-6">
          <GuardPanel
            title="PRD context not ready"
            description="请先完成 Scope Freeze 后再进入 PRD 页面。"
          />
        </section>
      ) : null}
      <PrdView prd={context.prd} context={context} />
    </main>
  )
}
