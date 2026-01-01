"use client";

import { useEffect, useState, ReactNode } from "react";

interface AuthProviderWrapperProps {
  children: ReactNode;
}

export function AuthProviderWrapper({ children }: AuthProviderWrapperProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [AuthProviderComponent, setAuthProviderComponent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAuthProvider = async () => {
      try {
        const { AuthProvider } = await import("@/contexts/AuthContext");
        setAuthProviderComponent(() => AuthProvider);
      } catch (error) {
        console.error("Error importing AuthProvider:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadAuthProvider();
  }, []);

  // Show loading state while AuthProvider is being loaded
  // This prevents useAuth from being called before provider is ready
  if (isLoading || AuthProviderComponent === null) {
    return <>{children}</>;
  }

  return <AuthProviderComponent>{children}</AuthProviderComponent>;
}
