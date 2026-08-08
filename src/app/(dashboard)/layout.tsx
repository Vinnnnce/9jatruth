import { DashboardLayout } from "@/components/dashboard-layout";
import CookieConsent from "@/components/cookie-consent";
import { PWAInstaller } from "@/components/pwa-installer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      {children}
      <CookieConsent />
      <PWAInstaller />
    </DashboardLayout>
  );
}
