"use client";

import { cn } from "@workspace/ui/lib/utils";
import { Check, Circle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface WizardStep {
    id: string;
    title: string;
    description?: string;
    icon?: React.ReactNode;
}

interface WizardTimelineProps {
    steps: WizardStep[];
    currentStep: number;
    completedSteps: number[];
    className?: string;
}

export function WizardTimeline({
    steps,
    currentStep,
    completedSteps,
    className,
}: WizardTimelineProps) {
    return (
        <div className={cn("relative", className)}>
            {/* Vertical line */}
            <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gradient-to-b from-primary/30 via-primary/20 to-transparent" />

            <div className="space-y-8">
                {steps.map((step, index) => {
                    const isCompleted = completedSteps.includes(index);
                    const isCurrent = currentStep === index;
                    const isPending = index > currentStep;

                    return (
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1, duration: 0.3 }}
                            className="relative flex items-start gap-4"
                        >
                            {/* Step indicator */}
                            <div className="relative z-10 flex items-center justify-center">
                                <motion.div
                                    className={cn(
                                        "size-12 rounded-full flex items-center justify-center transition-all duration-500",
                                        isCompleted &&
                                        "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30",
                                        isCurrent &&
                                        "bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/30 ring-4 ring-primary/20",
                                        isPending && "bg-muted/50 border-2 border-dashed border-muted-foreground/30"
                                    )}
                                    animate={
                                        isCurrent
                                            ? {
                                                scale: [1, 1.05, 1],
                                                boxShadow: [
                                                    "0 0 0 0 rgba(var(--primary-rgb), 0.3)",
                                                    "0 0 20px 5px rgba(var(--primary-rgb), 0.3)",
                                                    "0 0 0 0 rgba(var(--primary-rgb), 0.3)",
                                                ],
                                            }
                                            : {}
                                    }
                                    transition={{
                                        repeat: isCurrent ? Infinity : 0,
                                        duration: 2,
                                    }}
                                >
                                    <AnimatePresence mode="wait">
                                        {isCompleted ? (
                                            <motion.div
                                                key="completed"
                                                initial={{ scale: 0, rotate: -180 }}
                                                animate={{ scale: 1, rotate: 0 }}
                                                exit={{ scale: 0, rotate: 180 }}
                                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                            >
                                                <Check className="size-6 text-white" strokeWidth={3} />
                                            </motion.div>
                                        ) : isCurrent ? (
                                            <motion.div
                                                key="current"
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                exit={{ scale: 0 }}
                                            >
                                                <span className="text-lg font-bold text-white">
                                                    {index + 1}
                                                </span>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="pending"
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                exit={{ scale: 0 }}
                                            >
                                                <Circle className="size-5 text-muted-foreground/50" />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            </div>

                            {/* Step content */}
                            <div className="flex-1 pt-2">
                                <motion.h3
                                    className={cn(
                                        "font-semibold text-lg transition-colors duration-300",
                                        isCompleted && "text-emerald-500",
                                        isCurrent && "text-foreground",
                                        isPending && "text-muted-foreground/50"
                                    )}
                                >
                                    {step.title}
                                </motion.h3>
                                {step.description && (
                                    <motion.p
                                        className={cn(
                                            "text-sm mt-1 transition-colors duration-300",
                                            isCompleted && "text-emerald-500/70",
                                            isCurrent && "text-muted-foreground",
                                            isPending && "text-muted-foreground/40"
                                        )}
                                    >
                                        {step.description}
                                    </motion.p>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
