'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'

import { useIdeasStore } from '../../lib/ideas-store'

export function IdeasDashboard() {
  const ideas = useIdeasStore((state) => state.ideas)
  const activeIdeaId = useIdeasStore((state) => state.activeIdeaId)
  const loading = useIdeasStore((state) => state.loading)
  const error = useIdeasStore((state) => state.error)
  const loadIdeas = useIdeasStore((state) => state.loadIdeas)
  const createIdea = useIdeasStore((state) => state.createIdea)
  const setActiveIdeaId = useIdeasStore((state) => state.setActiveIdeaId)

  const [title, setTitle] = useState('')

  useEffect(() => {
    void loadIdeas()
  }, [loadIdeas])

  const handleCreateIdea = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      return
    }

    await createIdea(trimmed)
    setTitle('')
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <section className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Ideas</h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage multiple ideas in one workspace and continue each flow independently.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadIdeas()}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        <form onSubmit={handleCreateIdea} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            placeholder="e.g. AI Copilot for PRD alignment"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            className="rounded-md border border-cyan-600 bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700"
          >
            New Idea
          </button>
        </form>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="mt-3 text-sm text-slate-500">Loading ideas...</p> : null}

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {ideas.map((idea) => {
            const isActive = activeIdeaId === idea.id
            return (
              <article
                key={idea.id}
                className={`rounded-xl border p-4 ${
                  isActive ? 'border-cyan-400 bg-cyan-50/70' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{idea.title}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Stage: {idea.stage} · Status: {idea.status}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Updated: {idea.updated_at.slice(0, 16)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveIdeaId(idea.id)}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {isActive ? 'Active' : 'Set Active'}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/ideas/${idea.id}/idea-canvas`}
                    className="rounded-md border border-cyan-300 bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-800"
                  >
                    Open Flow
                  </Link>
                </div>
              </article>
            )
          })}

          {!loading && ideas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              No ideas yet. Create your first idea above.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
