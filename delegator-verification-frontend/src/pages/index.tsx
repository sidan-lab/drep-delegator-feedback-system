import { INSTRUCTION_TEXT, TITLE_TEXT } from "@/lib/text";
import Head from "next/head";
import Link from "next/link";

const DREP_NAME = process.env.NEXT_PUBLIC_DREP_NAME;

export default function Home() {
  return (
    <div className="bg-gray-900 w-full min-h-screen text-white text-center">
      <Head>
        <title>Delegator Verification - {DREP_NAME}</title>
        <meta
          name="description"
          content={`Verify your delegation to ${DREP_NAME} and participate in governance feedback`}
        />
      </Head>

      <main className="flex min-h-screen flex-col items-center justify-center p-8 md:p-24">
        <h1 className="text-4xl md:text-6xl font-thin mb-8">{TITLE_TEXT}</h1>

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 max-w-2xl mb-8">
          <h2 className="text-2xl font-semibold mb-4">Welcome</h2>
          <p className="text-gray-400 mb-6">{INSTRUCTION_TEXT}</p>

          <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4 text-left">
            <p className="text-yellow-200 text-sm">
              <strong>Note:</strong> You need a verification link from Discord to
              proceed. Use the <code className="bg-gray-700 px-1 rounded">/verify</code>{" "}
              command in the DRep&apos;s Discord server to get your personalized link.
            </p>
          </div>
        </div>

        <div className="text-gray-500 text-sm">
          <p>
            If you already have a verification link, it should look like:
          </p>
          <code className="text-gray-400 bg-gray-800 px-2 py-1 rounded mt-2 inline-block">
            {typeof window !== "undefined" ? window.location.origin : ""}/verify/YOUR_DISCORD_ID
          </code>
        </div>
      </main>
    </div>
  );
}
