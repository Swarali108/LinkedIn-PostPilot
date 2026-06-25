import Insights from "@/components/analytics/Insights";

export default function InsightsPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Insights</h1>
        <p className="mt-1 text-ink-muted">
          AI-derived patterns from your content — what&apos;s working and what to do next.
        </p>
      </header>
      <Insights />
    </main>
  );
}
