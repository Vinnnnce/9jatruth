import { DashboardLayout } from "@/components/dashboard-layout";
import CookieConsent from "@/components/cookie-consent";
import { PWAInstaller } from "@/components/pwa-installer";
import { FeedbackPopup } from "@/components/feedback-popup";
import { IosDownload } from "@/components/ios-download";
import { ReferralCapture } from "@/components/referral-capture";
import { SelfHealingProvider } from "@/components/self-healing-provider";
import { EmotionAdaptiveProvider } from "@/components/emotion-adaptive-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SelfHealingProvider>
      <EmotionAdaptiveProvider>
        <DashboardLayout>
          {children}
          <CookieConsent />
          <PWAInstaller />
          <FeedbackPopup />
          <IosDownload />
          <ReferralCapture />
        </DashboardLayout>
      </EmotionAdaptiveProvider>
    </SelfHealingProvider>
  );
}
