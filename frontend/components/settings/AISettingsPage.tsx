'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { getAiSettings, patchAiSettings, testAiProvider } from '../../lib/api'
import type { AIProviderConfig, AIProviderKind } from '../../lib/schemas'

type RoutingInputs = {
  opportunity: string
  feasibility: string
  scope: string
  prd: string
}

const DEFAULT_PROVIDER: AIProviderConfig = {
  id: '',
  name: '',
  kind: 'generic_json',
  base_url: '',
  api_key: '',
  model: '',
  enabled: true,
  timeout_seconds: 20,
  temperature: 0.2,
}

const toCsv = (values: string[]): string => values.join(', ')
const fromCsv = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

export function AISettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [providers, setProviders] = useState<AIProviderConfig[]>([])
  const [routing, setRouting] = useState<RoutingInputs>({
    opportunity: '',
    feasibility: '',
    scope: '',
    prd: '',
  })
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
        setRouting({
          opportunity: toCsv(settings.routing.opportunity),
          feasibility: toCsv(settings.routing.feasibility),
          scope: toCsv(settings.routing.scope),
          prd: toCsv(settings.routing.prd),
        })
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
      const saved = await patchAiSettings({
        providers: cleanedProviders,
        routing: {
          opportunity: fromCsv(routing.opportunity),
          feasibility: fromCsv(routing.feasibility),
          scope: fromCsv(routing.scope),
          prd: fromCsv(routing.prd),
        },
      })
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
              Configure providers and route each generation task through your preferred APIs.
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
                  No providers configured. Add one and set task routing below.
                </p>
              ) : null}

              <div className="space-y-3">
                {providers.map((provider, index) => (
                  <article
                    key={`${provider.id}-${index}`}
                    className="rounded-xl border border-slate-200 p-4"
                  >
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

                    <div className="mt-3 flex items-center justify-between">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={provider.enabled}
                          onChange={(event) =>
                            updateProvider(index, { enabled: event.currentTarget.checked })
                          }
                        />
                        Enabled
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void onTestProvider(provider)}
                          disabled={Boolean(
                            testingIds[provider.id.trim() || '(temporary-provider)']
                          )}
                          className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {testingIds[provider.id.trim() || '(temporary-provider)']
                            ? 'Testing...'
                            : 'Test'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeProvider(index)}
                          className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    {testResults[provider.id.trim() || '(temporary-provider)'] ? (
                      <p className="mt-2 text-xs text-slate-600">
                        {testResults[provider.id.trim() || '(temporary-provider)']}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>

            <div className="mt-8 space-y-3 border-t border-slate-200 pt-6">
              <h2 className="text-sm font-semibold tracking-[0.15em] text-slate-600 uppercase">
                Task Routing
              </h2>
              <p className="text-sm text-slate-600">
                Use comma-separated provider IDs. Order defines primary then fallback.
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">Opportunity</span>
                  <input
                    value={routing.opportunity}
                    onChange={(event) =>
                      setRouting((prev) => ({ ...prev, opportunity: event.currentTarget.value }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    placeholder="openai_main, local_gateway"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">Feasibility</span>
                  <input
                    value={routing.feasibility}
                    onChange={(event) =>
                      setRouting((prev) => ({ ...prev, feasibility: event.currentTarget.value }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">Scope</span>
                  <input
                    value={routing.scope}
                    onChange={(event) =>
                      setRouting((prev) => ({ ...prev, scope: event.currentTarget.value }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">PRD</span>
                  <input
                    value={routing.prd}
                    onChange={(event) =>
                      setRouting((prev) => ({ ...prev, prd: event.currentTarget.value }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </label>
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
