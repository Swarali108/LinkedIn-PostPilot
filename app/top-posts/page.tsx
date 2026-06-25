import TopPosts from "@/components/analytics/TopPosts";

export default function TopPostsPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Top Posts</h1>
        <p className="mt-1 text-ink-muted">
          Your highest-scoring posts, ranked by predicted reach. Reuse what works.
        </p>
      </header>
      <TopPosts />
    </main>
  );
}
