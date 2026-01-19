import Head from "next/head";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamic import with SSR disabled to avoid hydration issues with auth context
const NotificationSettingsContent = dynamic(
  () =>
    import("@/components/settings/NotificationSettingsContent").then(
      (mod) => mod.NotificationSettingsContent
    ),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    ),
  }
);

export default function NotificationSettingsPage() {
  return (
    <>
      <Head>
        <title>Notification Settings - Cardano Governance</title>
        <meta
          name="description"
          content="Configure your notification preferences for voting deadline reminders"
        />
      </Head>
      <NotificationSettingsContent />
    </>
  );
}
