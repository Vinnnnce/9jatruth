import { DashboardLayout } from "@/components/dashboard-layout";
import CookieConsent from "@/components/cookie-consent";
import { PWAInstaller } from "@/components/pwa-installer";
import { FeedbackPopup } from "@/components/feedback-popup";
import { IosDownload } from "@/components/ios-download";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      {children}
      <CookieConsent />
      <PWAInstaller />
      <FeedbackPopup />
      <IosDownload />
    </DashboardLayout>
  );
}
