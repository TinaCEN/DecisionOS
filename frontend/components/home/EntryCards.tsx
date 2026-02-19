import Link from 'next/link'

const entries = [
  {
    href: '/idea-canvas',
    title: 'Idea Canvas',
    description: '输入 idea seed，选择方向与路径。',
  },
  {
    href: '/feasibility',
    title: 'Feasibility',
    description: '查看可行性评分卡并确认方案。',
  },
  {
    href: '/scope-freeze',
    title: 'Scope Freeze',
    description: '整理 IN/OUT 范围并执行冻结。',
  },
  {
    href: '/prd',
    title: 'PRD',
    description: '查看生成的 PRD 内容（占位）。',
  },
]

export function EntryCards() {
  return (
    <section className="mx-auto grid max-w-5xl gap-4 p-6 md:grid-cols-2">
      {entries.map((entry) => (
        <Link
          key={entry.href}
          href={entry.href}
          className="rounded-xl border border-black/10 bg-white p-5 transition hover:border-black/30"
        >
          <h2 className="text-lg font-semibold">{entry.title}</h2>
          <p className="mt-2 text-sm text-black/70">{entry.description}</p>
        </Link>
      ))}
    </section>
  )
}
