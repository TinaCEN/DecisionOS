import { IdeaDAGCanvas } from '../../../../components/idea/dag/IdeaDAGCanvas'
import { IdeaScopedHydration } from '../../../../components/ideas/IdeaScopedHydration'

type IdeaCanvasScopedPageProps = {
  params: Promise<{
    ideaId: string
  }>
}

export default async function IdeaCanvasScopedPage({ params }: IdeaCanvasScopedPageProps) {
  const { ideaId } = await params

  return (
    <IdeaScopedHydration ideaId={ideaId}>
      <main className="h-[calc(100vh-4rem)]">
        <IdeaDAGCanvas ideaId={ideaId} />
      </main>
    </IdeaScopedHydration>
  )
}
