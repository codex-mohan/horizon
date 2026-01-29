"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { GradientButton } from "@workspace/ui/components/gradient-button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { WizardTimeline, type WizardStep } from "./wizard-timeline";
import { useAuthStore } from "@/lib/stores/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    User,
    Lock,
    Sparkles,
    ArrowRight,
    ArrowLeft,
    Check,
    X,
    Loader2,
    Eye,
    EyeOff,
} from "lucide-react";

const wizardSteps: WizardStep[] = [
    {
        id: "username",
        title: "Choose Your Identity",
        description: "Pick a unique username for your account",
    },
    {
        id: "password",
        title: "Secure Your Account",
        description: "Create a strong password",
    },
    {
        id: "personalize",
        title: "Personalize",
        description: "Add your display name (optional)",
    },
    {
        id: "complete",
        title: "Ready to Launch",
        description: "Your account is ready!",
    },
];

interface SignupWizardProps {
    onSwitchToLogin?: () => void;
    className?: string;
}

export function SignupWizard({ onSwitchToLogin, className }: SignupWizardProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<number[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [username, setUsername] = useState("");
    const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [displayName, setDisplayName] = useState("");

    const { register } = useAuthStore();
    const router = useRouter();

    // Debounced username check
    useEffect(() => {
        if (username.length < 3) {
            setUsernameStatus("idle");
            return;
        }

        const timeout = setTimeout(async () => {
            setUsernameStatus("checking");
            try {
                const response = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
                const data = await response.json();
                setUsernameStatus(data.available ? "available" : "taken");
            } catch {
                setUsernameStatus("idle");
            }
        }, 500);

        return () => clearTimeout(timeout);
    }, [username]);

    const validateUsername = useCallback(() => {
        if (username.length < 3) {
            toast.error("Username must be at least 3 characters");
            return false;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            toast.error("Username can only contain letters, numbers, and underscores");
            return false;
        }
        if (usernameStatus === "taken") {
            toast.error("This username is already taken");
            return false;
        }
        return true;
    }, [username, usernameStatus]);

    const validatePassword = useCallback(() => {
        if (password.length < 6) {
            toast.error("Password must be at least 6 characters");
            return false;
        }
        if (password !== confirmPassword) {
            toast.error("Passwords do not match");
            return false;
        }
        return true;
    }, [password, confirmPassword]);

    const handleNext = useCallback(async () => {
        if (currentStep === 0) {
            if (!validateUsername()) return;
        } else if (currentStep === 1) {
            if (!validatePassword()) return;
        }

        setCompletedSteps((prev) => [...prev, currentStep]);
        setCurrentStep((prev) => Math.min(prev + 1, wizardSteps.length - 1));
    }, [currentStep, validateUsername, validatePassword]);

    const handleBack = useCallback(() => {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
    }, []);

    const handleComplete = useCallback(async () => {
        setIsSubmitting(true);
        try {
            const result = await register(username, password, displayName || undefined);

            if (result.success) {
                setCompletedSteps((prev) => [...prev, currentStep]);
                toast.success("Welcome to Horizon! 🚀", {
                    description: "Your account has been created successfully.",
                });
                // Small delay for the animation to complete
                setTimeout(() => {
                    router.push("/");
                }, 500);
            } else {
                toast.error("Registration failed", {
                    description: result.error || "Please try again.",
                });
            }
        } catch (error) {
            toast.error("Something went wrong", {
                description: "Please try again later.",
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [username, password, displayName, register, router, currentStep]);

    const getPasswordStrength = useCallback((pwd: string) => {
        if (!pwd) return { strength: 0, label: "" };

        let strength = 0;
        if (pwd.length >= 6) strength += 1;
        if (pwd.length >= 8) strength += 1;
        if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength += 1;
        if (/[0-9]/.test(pwd)) strength += 1;
        if (/[^a-zA-Z0-9]/.test(pwd)) strength += 1;

        const labels = ["", "Weak", "Fair", "Good", "Strong", "Excellent"];
        return { strength, label: labels[strength] || "" };
    }, []);

    const passwordStrength = getPasswordStrength(password);

    const slideVariants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 200 : -200,
            opacity: 0,
            scale: 0.95,
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1,
        },
        exit: (direction: number) => ({
            x: direction < 0 ? 200 : -200,
            opacity: 0,
            scale: 0.95,
        }),
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 0:
                return (
                    <motion.div
                        key="step-0"
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        custom={1}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="space-y-6"
                    >
                        <div className="space-y-2">
                            <Label htmlFor="username" className="text-base flex items-center gap-2">
                                <User className="size-4" />
                                Username
                            </Label>
                            <div className="relative">
                                <Input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                                    placeholder="Choose a unique username"
                                    className="pr-10 text-lg h-12"
                                    autoFocus
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    {usernameStatus === "checking" && (
                                        <Loader2 className="size-5 text-muted-foreground animate-spin" />
                                    )}
                                    {usernameStatus === "available" && (
                                        <Check className="size-5 text-emerald-500" />
                                    )}
                                    {usernameStatus === "taken" && (
                                        <X className="size-5 text-destructive" />
                                    )}
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                3-20 characters, letters, numbers, and underscores only
                            </p>
                        </div>
                    </motion.div>
                );

            case 1:
                return (
                    <motion.div
                        key="step-1"
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        custom={1}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="space-y-6"
                    >
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-base flex items-center gap-2">
                                <Lock className="size-4" />
                                Password
                            </Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Create a strong password"
                                    className="pr-10 text-lg h-12"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                                </button>
                            </div>

                            {/* Password strength indicator */}
                            {password && (
                                <div className="space-y-2">
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map((level) => (
                                            <div
                                                key={level}
                                                className={cn(
                                                    "h-1.5 flex-1 rounded-full transition-all duration-300",
                                                    passwordStrength.strength >= level
                                                        ? level <= 2
                                                            ? "bg-red-500"
                                                            : level <= 3
                                                                ? "bg-yellow-500"
                                                                : "bg-emerald-500"
                                                        : "bg-muted"
                                                )}
                                            />
                                        ))}
                                    </div>
                                    <p className={cn(
                                        "text-sm",
                                        passwordStrength.strength <= 2 && "text-red-500",
                                        passwordStrength.strength === 3 && "text-yellow-500",
                                        passwordStrength.strength >= 4 && "text-emerald-500"
                                    )}>
                                        {passwordStrength.label}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-base">
                                Confirm Password
                            </Label>
                            <div className="relative">
                                <Input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm your password"
                                    className={cn(
                                        "pr-10 text-lg h-12",
                                        confirmPassword && password !== confirmPassword && "border-destructive"
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                                </button>
                            </div>
                            {confirmPassword && password !== confirmPassword && (
                                <p className="text-sm text-destructive">Passwords do not match</p>
                            )}
                        </div>
                    </motion.div>
                );

            case 2:
                return (
                    <motion.div
                        key="step-2"
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        custom={1}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="space-y-6"
                    >
                        <div className="space-y-2">
                            <Label htmlFor="displayName" className="text-base flex items-center gap-2">
                                <Sparkles className="size-4" />
                                Display Name
                                <span className="text-muted-foreground text-sm">(optional)</span>
                            </Label>
                            <Input
                                id="displayName"
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder={username || "How should we call you?"}
                                className="text-lg h-12"
                                autoFocus
                            />
                            <p className="text-sm text-muted-foreground">
                                This is how your name will appear in conversations
                            </p>
                        </div>
                    </motion.div>
                );

            case 3:
                return (
                    <motion.div
                        key="step-3"
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        custom={1}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="space-y-6 text-center"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
                            className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30"
                        >
                            <Sparkles className="size-12 text-white" />
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="space-y-2"
                        >
                            <h3 className="text-2xl font-bold">Almost There!</h3>
                            <p className="text-muted-foreground">
                                You're about to join Horizon as{" "}
                                <span className="font-semibold text-foreground">@{username}</span>
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            className="p-4 rounded-lg bg-muted/50 space-y-2 text-left"
                        >
                            <div className="flex items-center gap-2 text-sm">
                                <Check className="size-4 text-emerald-500" />
                                <span>Username: <strong>@{username}</strong></span>
                            </div>
                            {displayName && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Check className="size-4 text-emerald-500" />
                                    <span>Display name: <strong>{displayName}</strong></span>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                );

            default:
                return null;
        }
    };

    return (
        <div className={cn("w-full max-w-4xl mx-auto", className)}>
            <div className="grid md:grid-cols-[280px_1fr] gap-8">
                {/* Timeline sidebar */}
                <div className="hidden md:block">
                    <div className="sticky top-8">
                        <WizardTimeline
                            steps={wizardSteps}
                            currentStep={currentStep}
                            completedSteps={completedSteps}
                        />
                    </div>
                </div>

                {/* Main content */}
                <div className="glass-strong rounded-2xl p-8 space-y-8">
                    {/* Mobile step indicator */}
                    <div className="md:hidden">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">
                                Step {currentStep + 1} of {wizardSteps.length}
                            </span>
                            <span className="text-sm font-medium">
                                {wizardSteps[currentStep]?.title}
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-primary to-primary/80"
                                initial={{ width: 0 }}
                                animate={{
                                    width: `${((currentStep + 1) / wizardSteps.length) * 100}%`,
                                }}
                                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                            />
                        </div>
                    </div>

                    {/* Step header */}
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            {wizardSteps[currentStep]?.title}
                        </h2>
                        {wizardSteps[currentStep]?.description && (
                            <p className="text-muted-foreground">
                                {wizardSteps[currentStep].description}
                            </p>
                        )}
                    </div>

                    {/* Step content */}
                    <div className="min-h-[200px]">
                        <AnimatePresence mode="wait">
                            {renderStepContent()}
                        </AnimatePresence>
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                        <div>
                            {currentStep > 0 ? (
                                <Button
                                    variant="ghost"
                                    onClick={handleBack}
                                    className="gap-2"
                                    disabled={isSubmitting}
                                >
                                    <ArrowLeft className="size-4" />
                                    Back
                                </Button>
                            ) : (
                                <Button
                                    variant="ghost"
                                    onClick={onSwitchToLogin}
                                    className="text-muted-foreground"
                                >
                                    Already have an account?
                                </Button>
                            )}
                        </div>

                        <div>
                            {currentStep < wizardSteps.length - 1 ? (
                                <GradientButton
                                    onClick={handleNext}
                                    useThemeGradient
                                    glowIntensity="medium"
                                    className="gap-2"
                                    disabled={
                                        (currentStep === 0 && (username.length < 3 || usernameStatus === "taken")) ||
                                        (currentStep === 1 && (!password || password !== confirmPassword || password.length < 6))
                                    }
                                >
                                    Continue
                                    <ArrowRight className="size-4" />
                                </GradientButton>
                            ) : (
                                <GradientButton
                                    onClick={handleComplete}
                                    useThemeGradient
                                    glowIntensity="high"
                                    className="gap-2"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="size-4 animate-spin" />
                                            Creating account...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="size-4" />
                                            Create Account
                                        </>
                                    )}
                                </GradientButton>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
