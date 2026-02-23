import { FeasibilityDetailClient } from '../../../../../components/feasibility/FeasibilityDetailClient'
import { IdeaScopedHydration } from '../../../../../components/ideas/IdeaScopedHydration'

type FeasibilityDetailScopedPageProps = {
  params: Promise<{
    ideaId: string
    id: string
  }>
}

export default async function FeasibilityDetailScopedPage({
  params,
}: FeasibilityDetailScopedPageProps) {
  const { ideaId, id } = await params

  return (
    <IdeaScopedHydration ideaId={ideaId}>
      <main className="p-6">
        <FeasibilityDetailClient planId={id} />
      </main>
    </IdeaScopedHydration>
  )
}
