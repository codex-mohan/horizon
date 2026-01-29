"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SignupWizard } from "@/components/auth/signup-wizard";
import { SigninForm } from "@/components/auth/signin-form";
import { useAuthStore } from "@/lib/stores/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
    const [mode, setMode] = useState<"signin" | "signup">("signin");
    const { user, isInitialized, refreshUser } = useAuthStore();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Check for mode in URL params
    useEffect(() => {
        const urlMode = searchParams.get("mode");
        if (urlMode === "signup") {
            setMode("signup");
        }
    }, [searchParams]);

    // Refresh user on mount
    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    // Redirect if already authenticated
    useEffect(() => {
        if (isInitialized && user) {
            const redirectTo = searchParams.get("redirect") || "/";
            router.push(redirectTo);
        }
    }, [isInitialized, user, router, searchParams]);

    // Show loading while checking auth
    if (!isInitialized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4"
                >
                    <Loader2 className="size-10 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading...</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
            {/* Animated background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-primary/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
            </div>

            {/* Brand logo */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="fixed top-8 left-8"
            >
                <div className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    Horizon
                </div>
                <div className="text-xs text-muted-foreground">by Singularity.ai</div>
            </motion.div>

            {/* Main content */}
            <AnimatePresence mode="wait">
                {mode === "signin" ? (
                    <motion.div
                        key="signin"
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                        <SigninForm onSwitchToSignup={() => setMode("signup")} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="signup"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                        <SignupWizard onSwitchToLogin={() => setMode("signin")} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
