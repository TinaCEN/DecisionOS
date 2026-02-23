const ACCESS_TOKEN_KEY = 'decisionos_access_token'
const USERNAME_KEY = 'decisionos_auth_username'
const ROLE_KEY = 'decisionos_auth_role'
const EXPIRES_AT_KEY = 'decisionos_auth_expires_at'
const AUTH_CHANGED_EVENT = 'decisionos-auth-changed'

export type AuthSession = {
  accessToken: string
  username: string
  role: 'admin' | 'user'
  expiresAt: number
}

const isBrowser = (): boolean => typeof window !== 'undefined'
let cachedSessionFingerprint: string | null = null
let cachedSessionSnapshot: AuthSession | null = null

const dispatchAuthChanged = (): void => {
  if (!isBrowser()) {
    return
  }
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

const readAuthSession = (): AuthSession | null => {
  if (!isBrowser()) {
    return null
  }

  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY)
  const username = window.localStorage.getItem(USERNAME_KEY)
  const role = window.localStorage.getItem(ROLE_KEY)
  const expiresAtRaw = window.localStorage.getItem(EXPIRES_AT_KEY)

  if (!accessToken || !username || !role || !expiresAtRaw) {
    return null
  }

  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null
  }

  return {
    accessToken,
    username,
    role: role === 'admin' ? 'admin' : 'user',
    expiresAt,
  }
}

export const getAuthSession = (): AuthSession | null => readAuthSession()

export const setAuthSession = (session: AuthSession): void => {
  if (!isBrowser()) {
    return
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken)
  window.localStorage.setItem(USERNAME_KEY, session.username)
  window.localStorage.setItem(ROLE_KEY, session.role)
  window.localStorage.setItem(EXPIRES_AT_KEY, String(session.expiresAt))
  dispatchAuthChanged()
}

export const clearAuthSession = (): void => {
  if (!isBrowser()) {
    return
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  window.localStorage.removeItem(USERNAME_KEY)
  window.localStorage.removeItem(ROLE_KEY)
  window.localStorage.removeItem(EXPIRES_AT_KEY)
  dispatchAuthChanged()
}

export const getAccessToken = (): string | null => {
  const session = getAuthSession()
  return session?.accessToken ?? null
}

export const subscribeAuthSession = (onStoreChange: () => void): (() => void) => {
  if (!isBrowser()) {
    return () => {}
  }

  const handleStorage = (event: StorageEvent): void => {
    if (
      !event.key ||
      event.key === ACCESS_TOKEN_KEY ||
      event.key === USERNAME_KEY ||
      event.key === ROLE_KEY ||
      event.key === EXPIRES_AT_KEY
    ) {
      onStoreChange()
    }
  }
  const handleAuthChanged = (): void => {
    onStoreChange()
  }

  window.addEventListener('storage', handleStorage)
  window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged)
  }
}

export const getAuthSessionSnapshot = (): AuthSession | null => {
  const session = readAuthSession()
  const fingerprint = session
    ? `${session.accessToken}|${session.username}|${session.role}|${session.expiresAt}`
    : null

  if (fingerprint === cachedSessionFingerprint) {
    return cachedSessionSnapshot
  }

  cachedSessionFingerprint = fingerprint
  cachedSessionSnapshot = session
  return session
}

export const getAuthSessionServerSnapshot = (): AuthSession | null => null
