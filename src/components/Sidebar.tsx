// FILE: ~/taskmaster/src/components/Sidebar.tsx
// Collapsible sidebar with icon-only mode.

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import GlobalSearch from "@/components/GlobalSearch";

const NAV_ITEMS = [
  { href: "/dashboard",              icon: "⊞", label: "Dashboard"    },
  { href: "/dashboard/projects",     icon: "📁", label: "Projects"     },
  { href: "/dashboard/time-tracker", icon: "⏱", label: "Time Tracker" },
  { href: "/dashboard/notes",        icon: "📝", label: "Notes"        },
  { href: "/dashboard/upcoming",     icon: "📅", label: "Upcoming"     },
  { href: "/dashboard/calendar",     icon: "🗓", label: "Calendar"     },
  { href: "/dashboard/analytics",    icon: "📊", label: "Analytics"    },
  { href: "/dashboard/tags",         icon: "🏷️", label: "Tags"         },
];

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function Sidebar({ user }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-60"
      } flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-200`}
    >
      {/* Brand / Toggle */}
      <div className={`flex items-center ${collapsed ? "justify-center px-0 py-5" : "gap-3 px-4 py-5"}`}>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 hover:bg-indigo-500 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="text-white text-sm font-bold">T</span>
        </button>
        {!collapsed && (
          <span className="text-white font-semibold text-lg">Taskmaster</span>
        )}
      </div>

      <div className="mx-4 border-t border-gray-800" />

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center ${collapsed ? "justify-center px-0" : "gap-3 px-3"} py-2 rounded-lg transition-colors text-sm ${
                isActive
                  ? "bg-indigo-600/20 text-indigo-400"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-4 border-t border-gray-800" />

      {/* Global Search — hidden when collapsed */}
      {!collapsed && <GlobalSearch />}

      {/* User profile */}
      <div className={`p-4 ${collapsed ? "flex justify-center" : ""}`}>
        {collapsed ? (
          user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? "User"}
              className="w-8 h-8 rounded-full"
              title={user.name ?? undefined}
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold"
              title={user.name ?? undefined}
            >
              {(user.name ?? "U")[0].toUpperCase()}
            </div>
          )
        ) : (
          <div className="flex items-center gap-3">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name ?? "User"}
                className="w-8 h-8 rounded-full flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {(user.name ?? "U")[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
