"use client";

import { cn } from "@workspace/ui/lib/utils";
import { motion } from "framer-motion";

interface ShimmerTextProps {
  text: string;
  className?: string;
}

/**
 * Silvery shimmer text effect - gradient moves left to right
 * Similar to ChatGPT/Claude loading states
 */
export function ShimmerText({ text, className }: ShimmerTextProps) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <span className="relative z-10 bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400 bg-clip-text text-transparent">
        {text}
      </span>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  );
}

interface ModernSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Fancy modern spinner with geometric shape
 * Non-circular, morphing polygon design
 */
export function ModernSpinner({ size = "md", className }: ModernSpinnerProps) {
  const sizeClasses = {
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      {/* Outer rotating shape */}
      <motion.div
        className="absolute inset-0"
        animate={{
          rotate: [0, 90, 180, 270, 360],
          scale: [1, 1.1, 1, 0.9, 1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            <linearGradient
              id="spinner-gradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="rgba(99, 102, 241, 0.8)" />
              <stop offset="50%" stopColor="rgba(168, 85, 247, 0.8)" />
              <stop offset="100%" stopColor="rgba(236, 72, 153, 0.8)" />
            </linearGradient>
          </defs>
          <motion.polygon
            points="50,5 90,25 90,75 50,95 10,75 10,25"
            fill="none"
            stroke="url(#spinner-gradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{
              strokeDasharray: ["0 300", "150 150", "300 0"],
              strokeDashoffset: [0, -75, -150],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </svg>
      </motion.div>

      {/* Inner pulsing core */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{
          scale: [0.5, 0.7, 0.5],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <div className="w-2 h-2 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400" />
      </motion.div>

      {/* Orbiting particles */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-white/80"
          style={{
            top: "50%",
            left: "50%",
            marginTop: -3,
            marginLeft: -3,
          }}
          animate={{
            x: [0, Math.cos((i * 120 * Math.PI) / 180) * 20, 0],
            y: [0, Math.sin((i * 120 * Math.PI) / 180) * 20, 0],
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.3,
          }}
        />
      ))}
    </div>
  );
}

interface ToolStatusBadgeProps {
  status: "pending" | "executing" | "completed" | "failed";
  text?: string;
  className?: string;
}

/**
 * Status badge with shimmer effect during loading
 */
export function ToolStatusBadge({
  status,
  text,
  className,
}: ToolStatusBadgeProps) {
  const statusConfig = {
    pending: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/20",
      label: text || "Pending",
    },
    executing: {
      bg: "bg-blue-500/10",
      text: "text-blue-400",
      border: "border-blue-500/20",
      label: text || "Running",
    },
    completed: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/20",
      label: text || "Done",
    },
    failed: {
      bg: "bg-red-500/10",
      text: "text-red-400",
      border: "border-red-500/20",
      label: text || "Failed",
    },
  };

  const config = statusConfig[status];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border",
        config.bg,
        config.text,
        config.border,
        className,
      )}
    >
      {status === "executing" && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-400" />
        </span>
      )}
      {status === "completed" && (
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
      {status === "failed" && (
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      )}
      {status === "pending" && (
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )}
      {status === "executing" ? (
        <ShimmerText text={config.label} />
      ) : (
        <span>{config.label}</span>
      )}
    </div>
  );
}
