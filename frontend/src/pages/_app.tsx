import "@/styles/globals.css";
import "@meshsdk/react/styles.css";
import type { AppProps } from "next/app";
import { Provider } from "react-redux";
import { store } from "@/store";
import Head from "next/head";
import { MeshProviderWrapper } from "@/components/providers/MeshProviderWrapper";
import { AuthProviderWrapper } from "@/components/providers/AuthProviderWrapper";
import { Header } from "@/components/layout";
import { Toaster } from "sonner";
import { useDeadlineAlerts } from "@/hooks/useDeadlineAlerts";

/**
 * DeadlineAlertsProvider
 * Component that initializes deadline alert polling when user is authenticated
 */
function DeadlineAlertsProvider() {
  useDeadlineAlerts();
  return null;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MeshProviderWrapper>
      <AuthProviderWrapper>
        <Provider store={store}>
          <Head>
            <link rel="icon" href="/favicon.ico?v=2" />
          </Head>
          <Header />
          <Component {...pageProps} />
          <DeadlineAlertsProvider />
          <Toaster
            position="top-right"
            closeButton
            richColors
            expand={false}
            duration={Infinity}
          />
        </Provider>
      </AuthProviderWrapper>
    </MeshProviderWrapper>
  );
}
