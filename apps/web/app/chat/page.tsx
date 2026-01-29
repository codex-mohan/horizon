"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function ChatIndexPage() {
    const { user, isInitialized, refreshUser } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    useEffect(() => {
        if (isInitialized) {
            if (!user) {
                // Not authenticated, redirect to auth
                router.push("/auth");
            } else {
                // Authenticated, redirect to new conversation
                router.push("/chat/new");
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
                <Loader2 className="size-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading...</p>
            </motion.div>
        </div>
    );
}
