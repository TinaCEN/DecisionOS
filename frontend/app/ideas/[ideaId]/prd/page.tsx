import { PrdPage } from '../../../../components/prd/PrdPage'
import { IdeaScopedHydration } from '../../../../components/ideas/IdeaScopedHydration'

type PrdScopedPageProps = {
  params: Promise<{
    ideaId: string
  }>
}

export default async function PrdScopedPage({ params }: PrdScopedPageProps) {
  const { ideaId } = await params

  return (
    <IdeaScopedHydration ideaId={ideaId}>
      <PrdPage />
    </IdeaScopedHydration>
  )
}
