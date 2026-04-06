import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/app-sidebar";
import { TeamProvider } from "@/contexts/team-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const authToken = cookieStore.get("auth_token")?.value;

  if (!authToken) {
    redirect("/login");
  }

  return (
    <TeamProvider>
      <AppLayout>{children}</AppLayout>
    </TeamProvider>
  );
}
