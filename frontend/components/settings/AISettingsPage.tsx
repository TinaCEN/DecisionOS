'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { getAiSettings, patchAiSettings, testAiProvider } from '../../lib/api'
import type { AIProviderConfig, AIProviderKind } from '../../lib/schemas'

const DEFAULT_PROVIDER: AIProviderConfig = {
  id: '',
  name: '',
  kind: 'generic_json',
  base_url: '',
  api_key: '',
  model: '',
  enabled: false,
  timeout_seconds: 20,
  temperature: 0.2,
}

export function AISettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [providers, setProviders] = useState<AIProviderConfig[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, string>>({})
  const [testingIds, setTestingIds] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const run = async () => {
      try {
        const settings = await getAiSettings()
        setProviders(
          settings.providers.map((provider) => ({
            ...provider,
            api_key: provider.api_key ?? '',
            model: provider.model ?? '',
          }))
        )
        setUpdatedAt(settings.updated_at)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load AI settings.'
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [])

  const updateProvider = (index: number, patch: Partial<AIProviderConfig>) => {
    setProviders((prev) =>
      prev.map((provider, providerIndex) =>
        providerIndex === index ? { ...provider, ...patch } : provider
      )
    )
  }

  // Radio-button semantics: enabling one disables all others
  const setEnabledProvider = (index: number) => {
    setProviders((prev) =>
      prev.map((provider, providerIndex) => ({
        ...provider,
        enabled: providerIndex === index,
      }))
    )
  }

  const addProvider = () => {
    const suffix = providers.length + 1
    setProviders((prev) => [
      ...prev,
      {
        ...DEFAULT_PROVIDER,
        id: `provider_${suffix}`,
        name: `Provider ${suffix}`,
      },
    ])
  }

  const removeProvider = (index: number) => {
    setProviders((prev) => prev.filter((_, providerIndex) => providerIndex !== index))
  }

  const onSave = async () => {
    const cleanedProviders = providers.map((provider) => ({
      ...provider,
      id: provider.id.trim(),
      name: provider.name.trim(),
      base_url: provider.base_url.trim(),
      api_key: provider.api_key?.trim() || undefined,
      model: provider.model?.trim() || undefined,
    }))

    const hasEmptyRequired = cleanedProviders.some(
      (provider) => !provider.id || !provider.name || !provider.base_url
    )
    if (hasEmptyRequired) {
      toast.error('Each provider must include id, name, and base URL.')
      return
    }
    const cleanedProviderIdSet = new Set(cleanedProviders.map((provider) => provider.id))
    if (cleanedProviderIdSet.size !== cleanedProviders.length) {
      toast.error('Provider IDs must be unique.')
      return
    }

    setSaving(true)
    try {
      const saved = await patchAiSettings({ providers: cleanedProviders })
      setUpdatedAt(saved.updated_at)
      toast.success('AI settings saved.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save AI settings.'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const onTestProvider = async (provider: AIProviderConfig) => {
    const providerId = provider.id.trim() || '(temporary-provider)'
    setTestingIds((prev) => ({ ...prev, [providerId]: true }))
    setTestResults((prev) => ({ ...prev, [providerId]: '' }))

    try {
      const result = await testAiProvider({
        provider: {
          ...provider,
          id: provider.id.trim(),
          name: provider.name.trim(),
          base_url: provider.base_url.trim(),
          api_key: provider.api_key?.trim() || undefined,
          model: provider.model?.trim() || undefined,
        },
      })
      const statusLabel = result.ok ? 'OK' : 'FAILED'
      setTestResults((prev) => ({
        ...prev,
        [providerId]: `${statusLabel} · ${result.latency_ms}ms · ${result.message}`,
      }))
      if (result.ok) {
        toast.success(`Provider ${providerId} is reachable.`)
      } else {
        toast.error(`Provider ${providerId} test failed.`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Provider test failed.'
      setTestResults((prev) => ({ ...prev, [providerId]: `FAILED · ${message}` }))
      toast.error(message)
    } finally {
      setTestingIds((prev) => ({ ...prev, [providerId]: false }))
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <section className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">AI Settings</h1>
            <p className="mt-1 text-sm text-slate-600">
              Configure your AI provider. Exactly one provider can be active at a time.
            </p>
          </div>
          <div className="text-xs text-slate-500">
            {updatedAt ? `Updated: ${updatedAt}` : 'Not saved yet'}
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading AI settings...</p>
        ) : (
          <>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-[0.15em] text-slate-600 uppercase">
                  Providers
                </h2>
                <button
                  type="button"
                  onClick={addProvider}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  Add Provider
                </button>
              </div>

              {providers.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No providers configured. Add one to enable AI generation.
                </p>
              ) : null}

              <div className="space-y-3">
                {providers.map((provider, index) => {
                  const isActive = provider.enabled
                  const providerKey = `${provider.id}-${index}`
                  const testKey = provider.id.trim() || '(temporary-provider)'
                  return (
                    <article
                      key={providerKey}
                      className={`rounded-xl border-2 p-4 transition-colors ${
                        isActive
                          ? 'border-emerald-400 bg-emerald-50/40'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                          <span className="text-sm font-medium text-slate-700">
                            {provider.name || '(unnamed)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => setEnabledProvider(index)}
                              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                            >
                              Set Active
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void onTestProvider(provider)}
                            disabled={Boolean(testingIds[testKey])}
                            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {testingIds[testKey] ? 'Testing...' : 'Test'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeProvider(index)}
                            className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="text-sm">
                          <span className="mb-1 block text-slate-600">Provider ID</span>
                          <input
                            value={provider.id}
                            onChange={(event) =>
                              updateProvider(index, { id: event.currentTarget.value })
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-slate-600">Display Name</span>
                          <input
                            value={provider.name}
                            onChange={(event) =>
                              updateProvider(index, { name: event.currentTarget.value })
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-slate-600">Provider Kind</span>
                          <select
                            value={provider.kind}
                            onChange={(event) =>
                              updateProvider(index, {
                                kind: event.currentTarget.value as AIProviderKind,
                              })
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2"
                          >
                            <option value="generic_json">generic_json</option>
                            <option value="openai_compatible">openai_compatible</option>
                          </select>
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-slate-600">Base URL</span>
                          <input
                            value={provider.base_url}
                            onChange={(event) =>
                              updateProvider(index, { base_url: event.currentTarget.value })
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2"
                            placeholder="https://api.openai.com/v1 or http://127.0.0.1:8080/generate"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-slate-600">API Key (optional)</span>
                          <input
                            type="password"
                            value={provider.api_key ?? ''}
                            onChange={(event) =>
                              updateProvider(index, { api_key: event.currentTarget.value })
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-slate-600">Model (optional)</span>
                          <input
                            value={provider.model ?? ''}
                            onChange={(event) =>
                              updateProvider(index, { model: event.currentTarget.value })
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-slate-600">Timeout Seconds</span>
                          <input
                            type="number"
                            min={1}
                            max={120}
                            step={1}
                            value={provider.timeout_seconds}
                            onChange={(event) =>
                              updateProvider(index, {
                                timeout_seconds: Number(event.currentTarget.value) || 20,
                              })
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-slate-600">Temperature</span>
                          <input
                            type="number"
                            min={0}
                            max={2}
                            step={0.1}
                            value={provider.temperature}
                            onChange={(event) =>
                              updateProvider(index, {
                                temperature: Number(event.currentTarget.value) || 0.2,
                              })
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2"
                          />
                        </label>
                      </div>

                      {testResults[testKey] ? (
                        <p className="mt-2 text-xs text-slate-600">{testResults[testKey]}</p>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={saving}
                className="rounded-md border border-cyan-600 bg-cyan-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save AI Settings'}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
