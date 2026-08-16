import { useState } from "react";
import type { Role } from "@/types";
import { Shell } from "@/layouts/Shell";
import { AdminOverview } from "@/features/admin/AdminOverview";
import { CoachDashboard } from "@/features/coach/CoachDashboard";
import { StudentDashboard } from "@/features/student/StudentDashboard";
import { ParentDashboard } from "@/features/parent/ParentDashboard";

// NOTE: this in-app role switcher exists for design review only.
// Once auth is wired up, `role` comes from the authenticated user's
// JWT/session instead, and each role gets its own route
// (/admin, /coach, /student, /parent) guarded accordingly.
export default function App() {
  const [role, setRole] = useState<Role>("admin");

  return (
    <Shell role={role} onRoleChange={setRole}>
      {role === "admin" && <AdminOverview />}
      {role === "coach" && <CoachDashboard />}
      {role === "student" && <StudentDashboard />}
      {role === "parent" && <ParentDashboard />}
    </Shell>
  );
}
