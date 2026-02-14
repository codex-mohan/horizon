"use client";

import { cn } from "@workspace/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Circle } from "lucide-react";

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
      <div className="absolute top-8 bottom-8 left-6 w-0.5 bg-gradient-to-b from-primary/30 via-primary/20 to-transparent" />

      <div className="space-y-8">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(index);
          const isCurrent = currentStep === index;
          const isPending = index > currentStep;

          return (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="relative flex items-start gap-4"
              initial={{ opacity: 0, x: -20 }}
              key={step.id}
              transition={{ delay: index * 0.1, duration: 0.3 }}
            >
              {/* Step indicator */}
              <div className="relative z-10 flex items-center justify-center">
                <motion.div
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
                  className={cn(
                    "flex size-12 items-center justify-center rounded-full transition-all duration-500",
                    isCompleted &&
                      "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30 shadow-lg",
                    isCurrent &&
                      "bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/30 ring-4 ring-primary/20",
                    isPending &&
                      "border-2 border-muted-foreground/30 border-dashed bg-muted/50"
                  )}
                  transition={{
                    repeat: isCurrent ? Number.POSITIVE_INFINITY : 0,
                    duration: 2,
                  }}
                >
                  <AnimatePresence mode="wait">
                    {isCompleted ? (
                      <motion.div
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 180 }}
                        initial={{ scale: 0, rotate: -180 }}
                        key="completed"
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                      >
                        <Check className="size-6 text-white" strokeWidth={3} />
                      </motion.div>
                    ) : isCurrent ? (
                      <motion.div
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        initial={{ scale: 0 }}
                        key="current"
                      >
                        <span className="font-bold text-lg text-white">
                          {index + 1}
                        </span>
                      </motion.div>
                    ) : (
                      <motion.div
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        initial={{ scale: 0 }}
                        key="pending"
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
                      "mt-1 text-sm transition-colors duration-300",
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
