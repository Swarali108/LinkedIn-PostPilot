import Engagement from "@/components/analytics/Engagement";

export default function EngagementPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Engagement</h1>
        <p className="mt-1 text-ink-muted">
          Real likes, impressions and hashtags from the posts you save to Brand Memory.
        </p>
      </header>
      <Engagement />
    </main>
  );
}
