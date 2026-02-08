"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const { user, isInitialized, refreshUser } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (isInitialized) {
      if (user) {
        router.push("/chat/new");
      } else {
        router.push("/auth");
      }
    }
  }, [isInitialized, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative">
          <Loader2 className="size-12 animate-spin text-primary" />
          <div className="absolute inset-0 blur-xl bg-primary/30 rounded-full animate-pulse" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent font-display tracking-tight">
            Horizon
          </h1>
          <p className="text-muted-foreground text-sm font-accent italic">Loading...</p>
        </div>
      </motion.div>
    </div>
  );
}
