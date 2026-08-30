"use client";

import { AdvancedSettingsForm } from "@/components/advanced-settings-form";
import { Settings } from "lucide-react";

export default function AdvancedSettingsPage() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-display font-700 flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Advanced Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure your app preferences, privacy, and behavior
        </p>
      </div>
      <AdvancedSettingsForm />
    </div>
  );
}
