import { redirect } from 'next/navigation'

type LegacyFeasibilityDetailPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function LegacyFeasibilityDetailPage({
  params,
}: LegacyFeasibilityDetailPageProps) {
  await params
  redirect('/ideas')
}
