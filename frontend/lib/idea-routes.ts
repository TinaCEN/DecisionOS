export type IdeaStep = 'idea-canvas' | 'feasibility' | 'scope-freeze' | 'prd'

export const extractIdeaIdFromPathname = (pathname: string): string | null => {
  const match = pathname.match(/^\/ideas\/([^/]+)/)
  return match?.[1] ?? null
}

export const resolveIdeaIdForRouting = (
  pathname: string,
  activeIdeaId: string | null
): string | null => {
  return extractIdeaIdFromPathname(pathname) ?? activeIdeaId
}

export const buildIdeaStepHref = (ideaId: string, step: IdeaStep): string => {
  return `/ideas/${ideaId}/${step}`
}

export const buildIdeaFeasibilityDetailHref = (ideaId: string, planId: string): string => {
  return `/ideas/${ideaId}/feasibility/${planId}`
}
