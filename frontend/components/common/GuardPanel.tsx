'use client'

import Link from 'next/link'

type GuardPanelProps = {
  title: string
  description: string
}

export function GuardPanel({ title, description }: GuardPanelProps) {
  return (
    <section className="mx-auto w-full max-w-3xl rounded-xl border border-dashed border-black/30 bg-white p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-black/70">{description}</p>
      <Link
        href="/idea-canvas"
        className="mt-4 inline-flex rounded-md border border-black px-3 py-2 text-sm font-medium hover:bg-black hover:text-white"
      >
        Start from Idea Canvas
      </Link>
    </section>
  )
}
