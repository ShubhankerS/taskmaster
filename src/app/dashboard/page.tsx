// FILE: ~/taskmaster/src/app/dashboard/page.tsx
// Main dashboard page — widget-based grid layout.

import WidgetGrid from "@/components/widgets/WidgetGrid";

export default function DashboardPage() {
  return (
    <div className="min-h-full overflow-y-auto">
      <WidgetGrid />
    </div>
  );
}
