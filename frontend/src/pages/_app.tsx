import "@/styles/globals.css";
import "@meshsdk/react/styles.css";
import type { AppProps } from "next/app";
import { Provider } from "react-redux";
import { store } from "@/store";
import Head from "next/head";
import { MeshProviderWrapper } from "@/components/providers/MeshProviderWrapper";
import { AuthProviderWrapper } from "@/components/providers/AuthProviderWrapper";
import { Header } from "@/components/layout";

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
        </Provider>
      </AuthProviderWrapper>
    </MeshProviderWrapper>
  );
}
