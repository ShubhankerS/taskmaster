// FILE: ~/taskmaster/src/app/page.tsx
// Landing / login page — shown to unauthenticated visitors.

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

export default async function LandingPage() {
  const session = await auth();

  // Already authenticated — send straight to the dashboard.
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        {/* Logo / branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4">
            <svg
              className="w-9 h-9 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Taskmaster
          </h1>
          <p className="mt-2 text-gray-400 text-lg">
            Your personal productivity dashboard
          </p>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {[
            { icon: "📋", label: "Kanban Board" },
            { icon: "📁", label: "Projects" },
            { icon: "⏱️", label: "Time Tracking" },
            { icon: "📝", label: "Notes" },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 bg-gray-900 rounded-xl px-4 py-3 border border-gray-800"
            >
              <span className="text-xl">{icon}</span>
              <span className="text-gray-300 text-sm font-medium">{label}</span>
            </div>
          ))}
        </div>

        {/* Sign-in card */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-1">
            Sign in to get started
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            Use your GitHub account — no password required.
          </p>

          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold rounded-xl px-5 py-3 hover:bg-gray-100 transition-colors"
            >
              {/* GitHub SVG mark */}
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              Continue with GitHub
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Personal use only — your data stays on your own server.
        </p>
      </div>
    </main>
  );
}
