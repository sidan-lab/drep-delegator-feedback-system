import Head from "next/head";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamic import with SSR disabled to avoid libsodium bundling issues
const DrepRegisterContent = dynamic(
  () => import("@/components/drep/DrepRegisterContent").then((mod) => mod.DrepRegisterContent),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    ),
  }
);

export default function DrepRegisterPage() {
  return (
    <>
      <Head>
        <title>DRep Registration - Cardano Governance</title>
        <meta
          name="description"
          content="Register and manage your DRep Discord bot connection"
        />
      </Head>
      <DrepRegisterContent />
    </>
  );
}
