"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/stores/auth";

export default function ChatIndexPage() {
  const { user, isInitialized, refreshUser } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (isInitialized) {
      if (user) {
        // Authenticated, redirect to new conversation
        router.push("/chat/new");
      } else {
        // Not authenticated, redirect to auth
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
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading...</p>
      </motion.div>
    </div>
  );
}
