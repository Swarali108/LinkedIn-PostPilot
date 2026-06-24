"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import LogoutButton from "./LogoutButton";
import { loadProfile } from "@/lib/profile/store";

// Pages that render WITHOUT the dashboard shell (full-bleed).
const BARE_PATHS = ["/", "/login", "/reset"];

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");

  useEffect(() => {
    loadProfile().then((p) => {
      if (p) {
        setName(p.name || "");
        setHeadline(p.headline || "");
      }
    });
  }, [pathname]);

  if (BARE_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "PP";

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-10 flex items-center justify-end gap-4 border-b border-gray-200 bg-white/80 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold text-gray-900">
                {name || "Guest"}
              </div>
              <div className="text-xs text-gray-400">
                {headline || "Set up your brand profile"}
              </div>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-linkedin text-sm font-semibold text-white">
              {initials}
            </span>
            <LogoutButton className="ml-2" />
          </div>
        </header>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
