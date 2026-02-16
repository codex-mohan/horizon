"use client";

import { Checkbox } from "@workspace/ui/components/checkbox";
import { GradientButton } from "@workspace/ui/components/gradient-button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Lock, LogIn, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth";

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
      } catch (_error) {
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
      animate={{ opacity: 1, y: 0 }}
      className={cn("mx-auto w-full max-w-md", className)}
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.4 }}
    >
      <div className="glass-strong space-y-8 rounded-2xl p-8">
        {/* Header */}
        <div className="space-y-2 text-center">
          <motion.div
            animate={{ scale: 1 }}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/30"
            initial={{ scale: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20,
              delay: 0.1,
            }}
          >
            <LogIn className="size-8 text-white" />
          </motion.div>

          <motion.h1
            animate={{ opacity: 1, y: 0 }}
            className="font-bold font-display text-3xl tracking-tight"
            initial={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.2 }}
          >
            Welcome Back
          </motion.h1>

          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="font-body text-muted-foreground"
            initial={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.3 }}
          >
            Sign in to continue to Horizon
          </motion.p>
        </div>

        {/* Form */}
        <motion.form
          animate={{ opacity: 1 }}
          className="space-y-6"
          initial={{ opacity: 0 }}
          onSubmit={handleSubmit}
          transition={{ delay: 0.4 }}
        >
          <div className="space-y-2">
            <Label className="flex items-center gap-2" htmlFor="signin-username">
              <User className="size-4" />
              Username
            </Label>
            <Input
              autoComplete="username"
              className="h-12 text-base"
              disabled={isSubmitting}
              id="signin-username"
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              type="text"
              value={username}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2" htmlFor="signin-password">
              <Lock className="size-4" />
              Password
            </Label>
            <div className="relative">
              <Input
                autoComplete="current-password"
                className="h-12 pr-10 text-base"
                disabled={isSubmitting}
                id="signin-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                type="button"
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={rememberMe}
                disabled={isSubmitting}
                id="remember-me"
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label className="cursor-pointer font-normal text-sm" htmlFor="remember-me">
                Remember me for 30 days
              </Label>
            </div>
          </div>

          <GradientButton
            className="h-12 text-base"
            disabled={isSubmitting}
            glowIntensity="medium"
            type="submit"
            useThemeGradient
            width="full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-5 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="mr-2 size-5" />
                Sign In
              </>
            )}
          </GradientButton>
        </motion.form>

        {/* Footer */}
        <motion.div
          animate={{ opacity: 1 }}
          className="text-center text-muted-foreground text-sm"
          initial={{ opacity: 0 }}
          transition={{ delay: 0.5 }}
        >
          Don't have an account?{" "}
          <button
            className="font-medium text-primary hover:underline"
            onClick={onSwitchToSignup}
            type="button"
          >
            Create one
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
