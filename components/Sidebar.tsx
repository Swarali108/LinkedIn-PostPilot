"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PenLine,
  Lightbulb,
  CalendarDays,
  Clock,
  UserRound,
  Brain,
  TrendingUp,
  Heart,
  Sparkles,
  Plus,
  type LucideIcon,
} from "lucide-react";

type Item = {
  href?: string;
  label: string;
  icon: LucideIcon;
  desc: string;
  soon?: boolean;
};

type Group = { heading?: string; items: Item[] };

const GROUPS: Group[] = [
  {
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        desc: "Your command center — calendar, drafts & analytics",
      },
    ],
  },
  {
    heading: "Create",
    items: [
      {
        href: "/post-generator",
        label: "Post Generator",
        icon: PenLine,
        desc: "Turn a topic into a full, ready-to-post LinkedIn post",
      },
      {
        href: "/topic-discovery",
        label: "Topic Discovery",
        icon: Lightbulb,
        desc: "Get personalized, non-generic post ideas",
      },
    ],
  },
  {
    heading: "Manage",
    items: [
      {
        href: "/content-calendar",
        label: "Content Calendar",
        icon: CalendarDays,
        desc: "Plan a consistent multi-week posting schedule",
      },
      {
        href: "/post-history",
        label: "History",
        icon: Clock,
        desc: "Browse and reuse everything you've generated",
      },
    ],
  },
  {
    heading: "Personal Brand",
    items: [
      {
        href: "/brand-profile",
        label: "Brand Profile",
        icon: UserRound,
        desc: "Define your voice, audience and expertise",
      },
      {
        href: "/brand-memory",
        label: "Brand Memory",
        icon: Brain,
        desc: "Your past posts, embedded to sharpen new ones",
      },
    ],
  },
  {
    heading: "Analytics",
    items: [
      {
        label: "Top Posts",
        icon: TrendingUp,
        desc: "See which posts performed best",
        soon: true,
      },
      {
        label: "Engagement",
        icon: Heart,
        desc: "Track likes, comments and reach over time",
        soon: true,
      },
      {
        label: "Insights",
        icon: Sparkles,
        desc: "AI insights on what's working for your brand",
        soon: true,
      },
    ],
  },
];

function Tooltip({ text }: { text: string }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-30 ml-3 hidden w-56 -translate-y-1/2 rounded-xl bg-ink px-3 py-2 text-xs font-medium leading-snug text-white shadow-lift group-hover:block pp-tip">
      {text}
    </span>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white shadow-soft">
          P
        </span>
        <span className="text-lg font-bold tracking-tight text-ink">PostPilot</span>
      </div>

      {/* Create CTA */}
      <div className="px-4">
        <Link
          href="/post-generator"
          className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-dark"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Create New Post
        </Link>
      </div>

      {/* Nav */}
      <nav className="mt-5 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {GROUPS.map((group, gi) => (
          <div key={group.heading ?? `g${gi}`} className="space-y-1">
            {group.heading && (
              <div className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.heading}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.href && pathname === item.href;

              if (item.soon || !item.href) {
                return (
                  <div
                    key={item.label}
                    className="group relative flex cursor-default items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400"
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {item.label}
                    <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                      soon
                    </span>
                    <Tooltip text={item.desc} />
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-brand-soft text-brand-dark"
                      : "text-slate-600 hover:bg-slate-50 hover:text-ink"
                  }`}
                >
                  <Icon
                    className="h-[18px] w-[18px]"
                    strokeWidth={active ? 2.4 : 2}
                  />
                  {item.label}
                  <Tooltip text={item.desc} />
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-100 p-4">
        <Link
          href="/"
          className="block rounded-xl px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-50"
        >
          ← Home
        </Link>
      </div>
    </aside>
  );
}
