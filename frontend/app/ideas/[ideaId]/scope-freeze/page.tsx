import { ScopeFreezePage } from '../../../../components/scope/ScopeFreezePage'
import { IdeaScopedHydration } from '../../../../components/ideas/IdeaScopedHydration'

type ScopeFreezeScopedPageProps = {
  params: Promise<{
    ideaId: string
  }>
}

export default async function ScopeFreezeScopedPage({ params }: ScopeFreezeScopedPageProps) {
  const { ideaId } = await params

  return (
    <IdeaScopedHydration ideaId={ideaId}>
      <ScopeFreezePage />
    </IdeaScopedHydration>
  )
}
