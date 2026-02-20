export type IdeaStep = 'idea-canvas' | 'feasibility' | 'scope-freeze' | 'prd'
export type IdeaRouteQuery = Record<string, string | number | boolean | null | undefined>

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

export const buildIdeaStepHref = (
  ideaId: string,
  step: IdeaStep,
  query?: IdeaRouteQuery
): string => {
  const basePath = `/ideas/${ideaId}/${step}`
  if (!query) {
    return basePath
  }

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') {
      continue
    }
    params.set(key, String(value))
  }

  const queryString = params.toString()
  return queryString ? `${basePath}?${queryString}` : basePath
}

export const buildIdeaFeasibilityDetailHref = (ideaId: string, planId: string): string => {
  return `/ideas/${ideaId}/feasibility/${planId}`
}
