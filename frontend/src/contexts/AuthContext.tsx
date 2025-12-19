"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useWallet } from "@meshsdk/react";
import { generateNonce } from "@meshsdk/core";
import type { DrepRegistrationInfo } from "@/types/auth";
import { signIn as apiSignIn, getMe } from "@/services/api";

const AUTH_STORAGE_KEY = "drep_auth_token";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  jwtToken: string | null;
  userId: string | null;
  walletAddress: string | null;
  drepRegistration: DrepRegistrationInfo | null;
}

interface AuthContextType extends AuthState {
  signIn: () => Promise<void>;
  signOut: () => void;
  refreshAuth: () => Promise<void>;
  updateDrepRegistration: (registration: DrepRegistrationInfo) => void;
}

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  jwtToken: null,
  userId: null,
  walletAddress: null,
  drepRegistration: null,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { wallet, connected } = useWallet();
  const [authState, setAuthState] = useState<AuthState>(initialState);

  // Load token from localStorage on mount
  useEffect(() => {
    const loadStoredAuth = async () => {
      const storedToken = localStorage.getItem(AUTH_STORAGE_KEY);
      if (storedToken) {
        try {
          // Validate token by fetching user profile
          const response = await getMe(storedToken);
          if (response.success && response.data) {
            setAuthState({
              isAuthenticated: true,
              isLoading: false,
              jwtToken: storedToken,
              userId: response.data.userId,
              walletAddress: response.data.walletAddress,
              drepRegistration: response.data.drepRegistration,
            });
            return;
          }
        } catch {
          // Token invalid or expired - silently clear it
          // This is expected behavior, not an error condition
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }
      setAuthState({ ...initialState, isLoading: false });
    };

    loadStoredAuth().catch(() => {
      // Fallback catch for any unhandled errors
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setAuthState({ ...initialState, isLoading: false });
    });
  }, []);

  // Sign in with wallet signature
  const signIn = useCallback(async () => {
    if (!wallet || !connected) {
      throw new Error("Wallet not connected");
    }

    setAuthState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Get addresses from wallet with retry logic
      let rewardAddresses: string[] = [];
      let usedAddresses: string[] = [];
      let retries = 3;
      while (retries > 0) {
        try {
          rewardAddresses = await wallet.getRewardAddresses();
          usedAddresses = await wallet.getUsedAddresses();
          break;
        } catch (err) {
          retries--;
          if (retries === 0) throw err;
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      if (rewardAddresses.length === 0) {
        throw new Error("No reward address found in wallet");
      }

      // Use stake address for signing (CIP-8 requires stake address)
      const stakeAddress = rewardAddresses[0];
      // Use payment address for storage and DRep verification
      const walletAddress = usedAddresses.length > 0 ? usedAddresses[0] : stakeAddress;

      // Generate nonce with timestamp for replay protection
      // generateNonce returns a hex-encoded string
      const timestamp = Date.now();
      const nonce = generateNonce(
        `Sign in to Cardano Governance Platform. Address: ${walletAddress}. Timestamp: ${timestamp}`
      );

      // Sign the nonce using CIP-8 wallet signature with stake address
      // signData(payload, address) returns a DataSignature object with { signature, key }
      const signatureResult = await wallet.signData(nonce, stakeAddress);

      // Send to backend for verification and JWT generation
      // Send signature object directly (not stringified)
      const response = await apiSignIn(walletAddress, signatureResult, nonce);

      if (response.success && response.data) {
        const { token: jwtToken, userId, drepRegistration } = response.data;

        // Store token in localStorage
        localStorage.setItem(AUTH_STORAGE_KEY, jwtToken);

        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          jwtToken,
          userId,
          walletAddress,
          drepRegistration,
        });
      } else {
        throw new Error("Sign in failed");
      }
    } catch (error) {
      setAuthState((prev) => ({ ...prev, isLoading: false }));

      // Check if user declined/cancelled the signature request
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isUserDeclined =
        errorMessage.toLowerCase().includes("declined") ||
        errorMessage.toLowerCase().includes("cancelled") ||
        errorMessage.toLowerCase().includes("canceled") ||
        errorMessage.toLowerCase().includes("rejected") ||
        errorMessage.toLowerCase().includes("user denied");

      if (isUserDeclined) {
        // User declined to sign - this is expected behavior, don't throw
        console.log("User declined to sign authentication message");
        return;
      }

      // For other errors, still throw so UI can handle them
      throw error;
    }
  }, [wallet, connected]);

  // Sign out
  const signOut = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthState({ ...initialState, isLoading: false });
  }, []);

  // Refresh auth state from backend
  const refreshAuth = useCallback(async () => {
    if (!authState.jwtToken) return;

    try {
      const response = await getMe(authState.jwtToken);
      if (response.success && response.data) {
        setAuthState((prev) => ({
          ...prev,
          userId: response.data.userId,
          walletAddress: response.data.walletAddress,
          drepRegistration: response.data.drepRegistration,
        }));
      }
    } catch (error) {
      console.error("Failed to refresh auth:", error);
      // Token might be invalid, sign out
      signOut();
    }
  }, [authState.jwtToken, signOut]);

  // Update DRep registration (used after claiming)
  const updateDrepRegistration = useCallback(
    (registration: DrepRegistrationInfo) => {
      setAuthState((prev) => ({
        ...prev,
        drepRegistration: registration,
      }));
    },
    []
  );

  // Auto sign-out when wallet disconnects
  useEffect(() => {
    if (!connected && authState.isAuthenticated && !authState.isLoading) {
      signOut();
    }
  }, [connected, authState.isAuthenticated, authState.isLoading, signOut]);

  const value: AuthContextType = {
    ...authState,
    signIn,
    signOut,
    refreshAuth,
    updateDrepRegistration,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
