'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { GuardPanel } from '../common/GuardPanel'
import { PlanDetail } from './PlanDetail'
import { useDecisionStore } from '../../lib/store'

type FeasibilityDetailClientProps = {
  planId: string
}

export function FeasibilityDetailClient({ planId }: FeasibilityDetailClientProps) {
  const router = useRouter()
  const context = useDecisionStore((state) => state.context)
  const setPlan = useDecisionStore((state) => state.plan)
  const plan = context.feasibility?.plans.find((item) => item.id === planId) ?? null

  if (!context.feasibility) {
    return (
      <GuardPanel
        title="No feasibility context"
        description="请先在 Feasibility 页面生成并选择可行性计划。"
      />
    )
  }

  if (!plan) {
    return (
      <GuardPanel
        title="Plan not found"
        description="当前 plan 不在已生成的可行性结果中，请返回 Feasibility 列表重选。"
      />
    )
  }

  return (
    <section>
      <PlanDetail plan={plan} />
      <div className="mx-auto mt-4 flex w-full max-w-3xl justify-end">
        <button
          type="button"
          onClick={() => {
            setPlan(plan.id)
            toast.success('Plan confirmed')
            router.push('/scope-freeze')
          }}
          className="rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Confirm This Plan
        </button>
      </div>
    </section>
  )
}
