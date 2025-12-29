import "@/styles/globals.css";
import "@meshsdk/react/styles.css";
import type { AppProps } from "next/app";
import { Provider } from "react-redux";
import { store } from "@/store";
import Head from "next/head";
import { MeshProvider } from "@meshsdk/react";
import { AuthProvider } from "@/contexts/AuthContext";
import { Header } from "@/components/layout";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MeshProvider>
      <AuthProvider>
        <Provider store={store}>
          <Head>
            <link rel="icon" href="/favicon.ico?v=2" />
          </Head>
          <Header />
          <Component {...pageProps} />
        </Provider>
      </AuthProvider>
    </MeshProvider>
  );
}
