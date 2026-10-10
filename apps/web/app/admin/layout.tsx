import type { Metadata } from "next";
import "./design.css";
import "./admin.css";

export const metadata: Metadata = {
  title: "Staff operations",
  description: "LeetLogic staff operations portal",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" className="admin-design">
      {children}
    </main>
  );
}
