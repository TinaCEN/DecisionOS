import type {
  AISettings,
  AgentEnvelope,
  CreateIdeaRequest,
  IdeaDetail,
  IdeaStatus,
  IdeaSummary,
  PatchAISettingsRequest,
  PatchIdeaContextRequest,
  PatchIdeaRequest,
  TestAIProviderRequest,
  TestAIProviderResponse,
} from './schemas'

const DEFAULT_API_BASE_URL = 'http://localhost:8000'

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL

export const buildApiUrl = (path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export const jsonPost = async <TRequest, TResponse>(
  path: string,
  payload: TRequest,
  init?: RequestInit
): Promise<TResponse> => {
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(payload),
    ...init,
  })

  if (!response.ok) {
    const reason = await response.text().catch(() => '')
    throw new Error(`Request failed with ${response.status}${reason ? `: ${reason}` : ''}`)
  }

  return (await response.json()) as TResponse
}

export const jsonGet = async <TResponse>(path: string, init?: RequestInit): Promise<TResponse> => {
  const response = await fetch(buildApiUrl(path), {
    method: 'GET',
    ...init,
  })

  if (!response.ok) {
    const reason = await response.text().catch(() => '')
    throw new Error(`Request failed with ${response.status}${reason ? `: ${reason}` : ''}`)
  }

  return (await response.json()) as TResponse
}

export const jsonPatch = async <TRequest, TResponse>(
  path: string,
  payload: TRequest,
  init?: RequestInit
): Promise<TResponse> => {
  const response = await fetch(buildApiUrl(path), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(payload),
    ...init,
  })

  if (!response.ok) {
    const reason = await response.text().catch(() => '')
    throw new Error(`Request failed with ${response.status}${reason ? `: ${reason}` : ''}`)
  }

  return (await response.json()) as TResponse
}

export const jsonDelete = async (path: string, init?: RequestInit): Promise<void> => {
  const response = await fetch(buildApiUrl(path), {
    method: 'DELETE',
    ...init,
  })

  if (!response.ok) {
    const reason = await response.text().catch(() => '')
    throw new Error(`Request failed with ${response.status}${reason ? `: ${reason}` : ''}`)
  }
}

const buildIdeasQuery = (status?: IdeaStatus[]): string => {
  if (!status || !status.length) {
    return '/ideas'
  }

  const params = new URLSearchParams({ status: status.join(',') })
  return `/ideas?${params.toString()}`
}

export const getDefaultWorkspace = async (): Promise<{ id: string; name: string }> => {
  return await jsonGet('/workspaces/default')
}

export const listIdeas = async (status?: IdeaStatus[]): Promise<IdeaSummary[]> => {
  const response = await jsonGet<{ items: IdeaSummary[] }>(buildIdeasQuery(status))
  return response.items
}

export const createIdea = async (payload: CreateIdeaRequest): Promise<IdeaDetail> => {
  return await jsonPost<CreateIdeaRequest, IdeaDetail>('/ideas', payload)
}

export const getIdea = async (ideaId: string): Promise<IdeaDetail> => {
  return await jsonGet<IdeaDetail>(`/ideas/${ideaId}`)
}

export const patchIdea = async (ideaId: string, payload: PatchIdeaRequest): Promise<IdeaDetail> => {
  return await jsonPatch<PatchIdeaRequest, IdeaDetail>(`/ideas/${ideaId}`, payload)
}

export const patchIdeaContext = async (
  ideaId: string,
  payload: PatchIdeaContextRequest
): Promise<IdeaDetail> => {
  return await jsonPatch<PatchIdeaContextRequest, IdeaDetail>(`/ideas/${ideaId}/context`, payload)
}

export const deleteIdea = async (ideaId: string): Promise<void> => {
  await jsonDelete(`/ideas/${ideaId}`)
}

export const getAiSettings = async (): Promise<AISettings> => {
  return await jsonGet<AISettings>('/settings/ai')
}

export const patchAiSettings = async (payload: PatchAISettingsRequest): Promise<AISettings> => {
  return await jsonPatch<PatchAISettingsRequest, AISettings>('/settings/ai', payload)
}

export const testAiProvider = async (
  payload: TestAIProviderRequest
): Promise<TestAIProviderResponse> => {
  return await jsonPost<TestAIProviderRequest, TestAIProviderResponse>('/settings/ai/test', payload)
}

export const postIdeaScopedAgent = async <TRequest, TData>(
  ideaId: string,
  route: 'opportunity' | 'feasibility' | 'scope' | 'prd',
  payload: TRequest
): Promise<AgentEnvelope & { data: TData }> => {
  return await jsonPost<TRequest, AgentEnvelope & { data: TData }>(
    `/ideas/${ideaId}/agents/${route}`,
    payload
  )
}
