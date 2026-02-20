import { FeasibilityPage } from '../../../../components/feasibility/FeasibilityPage'
import { IdeaScopedHydration } from '../../../../components/ideas/IdeaScopedHydration'

type FeasibilityScopedPageProps = {
  params: Promise<{
    ideaId: string
  }>
}

export default async function FeasibilityScopedPage({ params }: FeasibilityScopedPageProps) {
  const { ideaId } = await params

  return (
    <IdeaScopedHydration ideaId={ideaId}>
      <FeasibilityPage />
    </IdeaScopedHydration>
  )
}
