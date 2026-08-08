import { DashboardLayout } from "@/components/dashboard-layout";
import CookieConsent from "@/components/cookie-consent";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      {children}
      <CookieConsent />
    </DashboardLayout>
  );
}
