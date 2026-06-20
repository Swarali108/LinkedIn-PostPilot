"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/post-generator", label: "Post Generator", icon: "✍️" },
  { href: "/topic-discovery", label: "Topic Discovery", icon: "💡" },
  { href: "/content-calendar", label: "Content Calendar", icon: "📅" },
  { href: "/brand-profile", label: "Brand Profile", icon: "👤" },
  { href: "/brand-memory", label: "Brand Memory", icon: "🧠" },
  { href: "/post-history", label: "History", icon: "🕘" },
];

const ANALYTICS = [
  { label: "Top Posts", icon: "📈" },
  { label: "Engagement", icon: "❤️" },
  { label: "Insights", icon: "🔮" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      {/* Brand */}
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linkedin text-lg font-bold text-white">
          P
        </span>
        <span className="text-lg font-bold text-gray-900">PostPilot</span>
      </div>

      {/* Create */}
      <div className="px-4">
        <Link
          href="/post-generator"
          className="flex items-center justify-center gap-2 rounded-xl bg-linkedin px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-linkedin-dark"
        >
          + Create New Post
        </Link>
      </div>

      {/* Nav */}
      <nav className="mt-6 flex-1 space-y-1 overflow-y-auto px-3">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-linkedin/10 text-linkedin"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        <div className="px-3 pb-1 pt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Analytics
        </div>
        {ANALYTICS.map((item) => (
          <div
            key={item.label}
            title="Coming soon"
            className="flex cursor-default items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-400"
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
            <span className="ml-auto rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">
              soon
            </span>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 p-4">
        <Link
          href="/"
          className="block rounded-xl px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-50"
        >
          ← Home
        </Link>
      </div>
    </aside>
  );
}
