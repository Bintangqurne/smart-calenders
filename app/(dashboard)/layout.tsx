import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/app-sidebar";
import { TeamProvider } from "@/contexts/team-context";
import { RealtimeProvider } from "@/contexts/realtime-context";
import { NotificationsProvider } from "@/contexts/notifications-context";
import { ChatDock } from "@/components/chat/ChatDock";

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
      <RealtimeProvider>
        <NotificationsProvider>
          <AppLayout>{children}</AppLayout>
          <ChatDock />
        </NotificationsProvider>
      </RealtimeProvider>
    </TeamProvider>
  );
}
