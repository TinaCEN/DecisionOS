import { FeasibilityDetailClient } from '../../../components/feasibility/FeasibilityDetailClient'

type FeasibilityDetailPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function FeasibilityDetailPage({ params }: FeasibilityDetailPageProps) {
  const { id } = await params

  return (
    <main className="p-6">
      <FeasibilityDetailClient planId={id} />
    </main>
  )
}
