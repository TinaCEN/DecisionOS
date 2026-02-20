import { PrdPage } from '../../../../components/prd/PrdPage'
import { IdeaScopedHydration } from '../../../../components/ideas/IdeaScopedHydration'

type PrdScopedPageProps = {
  params: Promise<{
    ideaId: string
  }>
  searchParams: Promise<{
    baseline_id?: string
  }>
}

export default async function PrdScopedPage({ params, searchParams }: PrdScopedPageProps) {
  const { ideaId } = await params
  const { baseline_id: baselineId } = await searchParams

  return (
    <IdeaScopedHydration ideaId={ideaId}>
      <PrdPage baselineId={baselineId ?? null} />
    </IdeaScopedHydration>
  )
}
