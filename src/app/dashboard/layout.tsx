// FILE: ~/taskmaster/src/app/dashboard/layout.tsx
// Dashboard layout — protected sidebar + main content area.
// Redirects unauthenticated users to the landing page.

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { Toaster } from "react-hot-toast";
import GlobalSearch from "@/components/GlobalSearch";
import Link from "next/link";

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

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">T</span>
          </div>
          <span className="text-white font-semibold text-lg">Taskmaster</span>
        </div>

        <div className="mx-4 border-t border-gray-800" />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors text-sm"
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mx-4 border-t border-gray-800" />

        {/* Global Search */}
        <GlobalSearch />

        {/* User profile at bottom */}
        <div className="p-4">
          <div className="flex items-center gap-3">
            {session.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={session.user.name ?? "User"}
                className="w-8 h-8 rounded-full flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {(session.user.name ?? "U")[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {session.user.name}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {session.user.email}
              </p>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                title="Sign out"
                className="text-gray-500 hover:text-white transition-colors text-sm px-1"
              >
                ↩
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-gray-950">{children}</main>

      {/* ── Toast notifications ───────────────────────────────────────────── */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#1f2937",
            color: "#f9fafb",
            border: "1px solid #374151",
          },
          success: {
            iconTheme: { primary: "#6366f1", secondary: "#f9fafb" },
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: "#f9fafb" },
          },
        }}
      />
    </div>
  );
}
