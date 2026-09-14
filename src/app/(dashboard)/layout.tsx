import { SidebarNav } from "@/components/sidebar-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh">
      <SidebarNav />
      <main className="flex-1 pl-24 lg:pl-72">{children}</main>
    </div>
  );
}
