"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/stores/auth";

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
    <div className="flex min-h-screen items-center justify-center bg-background">
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0, scale: 0.9 }}
      >
        <div className="relative">
          <Loader2 className="size-12 animate-spin text-primary" />
          <div className="absolute inset-0 animate-pulse rounded-full bg-primary/30 blur-xl" />
        </div>
        <div className="text-center">
          <h1 className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text font-bold font-display text-2xl text-transparent tracking-tight">
            Horizon
          </h1>
          <p className="font-accent text-muted-foreground text-sm italic">
            Loading...
          </p>
        </div>
      </motion.div>
    </div>
  );
}
