import { IdeaCanvas } from '../../../../components/idea/IdeaCanvas'
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
      <main>
        <IdeaCanvas />
      </main>
    </IdeaScopedHydration>
  )
}
