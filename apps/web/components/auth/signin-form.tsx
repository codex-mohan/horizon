"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@workspace/ui/lib/utils";
import { GradientButton } from "@workspace/ui/components/gradient-button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { useAuthStore } from "@/lib/stores/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { User, Lock, Eye, EyeOff, Loader2, LogIn } from "lucide-react";

interface SigninFormProps {
    onSwitchToSignup?: () => void;
    className?: string;
}

export function SigninForm({ onSwitchToSignup, className }: SigninFormProps) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { login } = useAuthStore();
    const router = useRouter();

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();

            if (!username.trim()) {
                toast.error("Please enter your username");
                return;
            }

            if (!password) {
                toast.error("Please enter your password");
                return;
            }

            setIsSubmitting(true);

            try {
                const result = await login(username, password, rememberMe);

                if (result.success) {
                    toast.success("Welcome back! 👋", {
                        description: "You've been signed in successfully.",
                    });
                    router.push("/");
                } else {
                    toast.error("Sign in failed", {
                        description: result.error || "Invalid username or password.",
                    });
                }
            } catch (error) {
                toast.error("Something went wrong", {
                    description: "Please try again later.",
                });
            } finally {
                setIsSubmitting(false);
            }
        },
        [username, password, rememberMe, login, router]
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={cn("w-full max-w-md mx-auto", className)}
        >
            <div className="glass-strong rounded-2xl p-8 space-y-8">
                {/* Header */}
                <div className="text-center space-y-2">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                        className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30"
                    >
                        <LogIn className="size-8 text-white" />
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-3xl font-bold"
                    >
                        Welcome Back
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-muted-foreground"
                    >
                        Sign in to continue to Horizon
                    </motion.p>
                </div>

                {/* Form */}
                <motion.form
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    onSubmit={handleSubmit}
                    className="space-y-6"
                >
                    <div className="space-y-2">
                        <Label htmlFor="signin-username" className="flex items-center gap-2">
                            <User className="size-4" />
                            Username
                        </Label>
                        <Input
                            id="signin-username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            className="h-12 text-base"
                            autoComplete="username"
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="signin-password" className="flex items-center gap-2">
                            <Lock className="size-4" />
                            Password
                        </Label>
                        <div className="relative">
                            <Input
                                id="signin-password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                className="h-12 text-base pr-10"
                                autoComplete="current-password"
                                disabled={isSubmitting}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                tabIndex={-1}
                            >
                                {showPassword ? (
                                    <EyeOff className="size-5" />
                                ) : (
                                    <Eye className="size-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="remember-me"
                                checked={rememberMe}
                                onCheckedChange={(checked) => setRememberMe(checked === true)}
                                disabled={isSubmitting}
                            />
                            <Label
                                htmlFor="remember-me"
                                className="text-sm font-normal cursor-pointer"
                            >
                                Remember me for 30 days
                            </Label>
                        </div>
                    </div>

                    <GradientButton
                        type="submit"
                        width="full"
                        useThemeGradient
                        glowIntensity="medium"
                        className="h-12 text-base"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="size-5 mr-2 animate-spin" />
                                Signing in...
                            </>
                        ) : (
                            <>
                                <LogIn className="size-5 mr-2" />
                                Sign In
                            </>
                        )}
                    </GradientButton>
                </motion.form>

                {/* Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-center text-sm text-muted-foreground"
                >
                    Don't have an account?{" "}
                    <button
                        type="button"
                        onClick={onSwitchToSignup}
                        className="text-primary hover:underline font-medium"
                    >
                        Create one
                    </button>
                </motion.div>
            </div>
        </motion.div>
    );
}
