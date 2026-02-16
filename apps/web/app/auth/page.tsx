"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SigninForm } from "@/components/auth/signin-form";
import { SignupWizard } from "@/components/auth/signup-wizard";
import { useAuthStore } from "@/lib/stores/auth";

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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.9 }}
        >
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      {/* Animated background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 h-full w-full animate-pulse rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-3xl" />
        <div
          className="absolute -right-1/2 -bottom-1/2 h-full w-full animate-pulse rounded-full bg-gradient-to-tl from-primary/10 to-transparent blur-3xl"
          style={{ animationDelay: "1s" }}
        />
      </div>

      {/* Brand logo */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-8 left-8"
        initial={{ opacity: 0, y: -20 }}
      >
        <div className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text font-bold font-display text-2xl text-transparent tracking-tight">
          Horizon
        </div>
        <div className="font-accent text-muted-foreground text-xs italic">by Singularity.ai</div>
      </motion.div>

      {/* Main content */}
      <AnimatePresence mode="wait">
        {mode === "signin" ? (
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            initial={{ opacity: 0, x: -50 }}
            key="signin"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <SigninForm onSwitchToSignup={() => setMode("signup")} />
          </motion.div>
        ) : (
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            initial={{ opacity: 0, x: 50 }}
            key="signup"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <SignupWizard onSwitchToLogin={() => setMode("signin")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
