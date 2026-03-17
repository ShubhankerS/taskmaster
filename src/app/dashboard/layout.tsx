// FILE: ~/taskmaster/src/app/dashboard/layout.tsx
// Dashboard layout — protected sidebar + main content area.
// Redirects unauthenticated users to the landing page.

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Toaster } from "react-hot-toast";
import Sidebar from "@/components/Sidebar";

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
      <Sidebar user={session.user} />

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
