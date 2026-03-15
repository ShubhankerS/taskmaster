// FILE: ~/taskmaster/src/app/dashboard/analytics/page.tsx
// Analytics page — time per project (pie), daily time last 7 days (bar),
// this week vs last week comparison.

"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { subDays, startOfWeek, endOfWeek, format, parseISO } from "date-fns";
import { useTaskmasterStore, type TimeLog, type Project } from "@/lib/store";

function formatHours(seconds: number): string {
  const h = seconds / 3600;
  return h < 1 ? `${Math.round(seconds / 60)}m` : `${h.toFixed(1)}h`;
}

const CHART_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
];

export default function AnalyticsPage() {
  const { timeLogs, setTimeLogs, projects, setProjects } =
    useTaskmasterStore();
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [logsRes, projectsRes] = await Promise.all([
        axios.get<{ timeLogs: TimeLog[] }>("/api/time-logs?limit=100"),
        axios.get<{ projects: Project[] }>("/api/projects?limit=50"),
      ]);
      setTimeLogs(logsRes.data.timeLogs ?? logsRes.data);
      setProjects(projectsRes.data.projects ?? projectsRes.data);
    } catch {
      // ignore
    }
  }, [setTimeLogs, setProjects]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const completedLogs = timeLogs.filter((l) => l.duration !== null);

  // ── Time per project (pie chart) ───────────────────────────────────────────

  const projectTimeMap: Record<string, number> = {};
  completedLogs.forEach((log) => {
    // Look up project via the tasks in the store — we'll use "No Project" as fallback
    const project = projects.find((p) =>
      p.id === (log.task as { projectId?: string } | undefined)?.projectId
    );
    const key = project?.name ?? "No Project";
    projectTimeMap[key] = (projectTimeMap[key] ?? 0) + (log.duration ?? 0);
  });
  const pieData = Object.entries(projectTimeMap)
    .map(([name, seconds]) => ({ name, value: Math.round(seconds / 60) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // ── Daily time over last 7 days (bar chart) ────────────────────────────────

  const today = new Date();
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, 6 - i);
    return format(d, "MMM d");
  });
  const dailyMap: Record<string, number> = {};
  last7Days.forEach((d) => (dailyMap[d] = 0));

  completedLogs.forEach((log) => {
    const d = format(parseISO(log.startTime), "MMM d");
    if (dailyMap[d] !== undefined) {
      dailyMap[d] += log.duration ?? 0;
    }
  });
  const barData = last7Days.map((d) => ({
    day: d,
    minutes: Math.round((dailyMap[d] ?? 0) / 60),
  }));

  // ── This week vs last week ─────────────────────────────────────────────────

  const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(subDays(today, 7), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subDays(today, 7), { weekStartsOn: 1 });

  const thisWeekSeconds = completedLogs
    .filter((l) => {
      const d = parseISO(l.startTime);
      return d >= thisWeekStart && d <= thisWeekEnd;
    })
    .reduce((sum, l) => sum + (l.duration ?? 0), 0);

  const lastWeekSeconds = completedLogs
    .filter((l) => {
      const d = parseISO(l.startTime);
      return d >= lastWeekStart && d <= lastWeekEnd;
    })
    .reduce((sum, l) => sum + (l.duration ?? 0), 0);

  const weekChange =
    lastWeekSeconds > 0
      ? Math.round(
          ((thisWeekSeconds - lastWeekSeconds) / lastWeekSeconds) * 100
        )
      : 0;

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
          <p className="text-gray-300">{label}</p>
          <p className="text-white font-medium">
            {formatHours((payload[0].value ?? 0) * 60)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="w-40 h-8 bg-gray-700 rounded" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-64 bg-gray-800 rounded-2xl" />
          <div className="h-64 bg-gray-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400 mt-1">Time tracking insights.</p>
      </div>

      {/* Week comparison cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            This Week
          </p>
          <p className="text-2xl font-bold text-white">
            {formatHours(thisWeekSeconds)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Last Week
          </p>
          <p className="text-2xl font-bold text-white">
            {formatHours(lastWeekSeconds)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Change
          </p>
          <p
            className={`text-2xl font-bold ${
              weekChange > 0
                ? "text-green-400"
                : weekChange < 0
                ? "text-red-400"
                : "text-gray-400"
            }`}
          >
            {weekChange > 0 ? "+" : ""}
            {weekChange}%
          </p>
        </div>
      </div>

      {completedLogs.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-white mb-1">No data yet</h3>
          <p className="text-gray-400 text-sm">
            Start tracking time on tasks to see analytics.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily bar chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              Daily Time (last 7 days)
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={barData}
                margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  axisLine={{ stroke: "#374151" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  unit="m"
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="minutes" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie chart */}
          {pieData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Time by Project
              </h2>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [
                      formatHours(value * 60),
                      "Time",
                    ]}
                    contentStyle={{
                      background: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#f9fafb",
                    }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span style={{ color: "#9ca3af", fontSize: 12 }}>
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
