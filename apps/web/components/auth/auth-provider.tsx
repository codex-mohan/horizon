"use client";

import { useEffect, createContext, useContext, type ReactNode } from "react";
import { useAuthStore, type AuthUser } from "@/lib/stores/auth";

interface AuthContextValue {
    user: AuthUser | null;
    isLoading: boolean;
    isInitialized: boolean;
}

const AuthContext = createContext<AuthContextValue>({
    user: null,
    isLoading: false,
    isInitialized: false,
});

export function useAuth() {
    return useContext(AuthContext);
}

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const { user, isLoading, isInitialized, refreshUser } = useAuthStore();

    // Refresh user on mount
    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    return (
        <AuthContext.Provider value={{ user, isLoading, isInitialized }}>
            {children}
        </AuthContext.Provider>
    );
}
