import { VerifyButton } from "@/components/VerifyButton";
import { INSTRUCTION_TEXT, TITLE_TEXT } from "@/lib/text";
import { CardanoWallet, useWallet } from "@meshsdk/react";
import Head from "next/head";
import { useRouter } from "next/router";

const DREP_NAME = process.env.NEXT_PUBLIC_DREP_NAME || "DRep";

export default function VerifyPage() {
  const { connected } = useWallet();
  const { query } = useRouter();
  const discordId = query.discordId as string;

  return (
    <div className="bg-gray-900 w-full min-h-screen text-white text-center">
      <Head>
        <title>Verify Delegation - {DREP_NAME}</title>
        <meta
          name="description"
          content={`Verify your delegation to ${DREP_NAME} and connect to Discord`}
        />
      </Head>

      <main className="flex min-h-screen flex-col items-center justify-center p-8 md:p-24">
        <h1 className="text-4xl md:text-6xl font-thin mb-12">{TITLE_TEXT}</h1>

        <div className="mb-12">
          {connected ? (
            <VerifyButton discordId={discordId} />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <CardanoWallet isDark />
              <p className="text-gray-400 text-sm">
                Connect your Cardano wallet to verify your delegation
              </p>
            </div>
          )}
        </div>

        <div className="flex content-center justify-center">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-xl">
            <h2 className="text-xl font-semibold mb-3">Instructions</h2>
            <p className="text-gray-400 text-sm mb-4">{INSTRUCTION_TEXT}</p>

            <div className="text-left text-sm">
              <ol className="list-decimal list-inside space-y-2 text-gray-300">
                <li>Connect your Cardano wallet above</li>
                <li>
                  If not already delegated, click &quot;Delegate to {DREP_NAME}&quot; and
                  sign the transaction
                </li>
                <li>
                  Once delegated, click &quot;Verify & Connect to Discord&quot;
                </li>
                <li>Return to Discord and confirm your verification</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Show Discord ID for reference */}
        {discordId && (
          <div className="mt-8 text-gray-500 text-xs">
            <p>
              Discord ID: <code className="bg-gray-800 px-2 py-1 rounded">{discordId}</code>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
