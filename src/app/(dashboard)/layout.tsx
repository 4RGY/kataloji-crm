import { SidebarNav } from "@/components/sidebar-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh">
      <SidebarNav />
      <main className="flex-1 pl-20 lg:pl-64">{children}</main>
    </div>
  );
}
