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
