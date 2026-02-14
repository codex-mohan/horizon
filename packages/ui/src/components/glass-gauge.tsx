"use client";

import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

interface GlassGaugeProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  label?: string;
  colorScheme?: "cyan" | "purple" | "green" | "orange" | "gradient";
  animated?: boolean;
}

const sizes = {
  sm: { size: 100, strokeWidth: 8, fontSize: "text-lg" },
  md: { size: 150, strokeWidth: 10, fontSize: "text-2xl" },
  lg: { size: 200, strokeWidth: 12, fontSize: "text-4xl" },
};

const colorSchemes = {
  cyan: { stroke: "stroke-cyan-500", glow: "from-cyan-500/40 to-blue-500/40" },
  purple: {
    stroke: "stroke-purple-500",
    glow: "from-purple-500/40 to-pink-500/40",
  },
  green: {
    stroke: "stroke-emerald-500",
    glow: "from-emerald-500/40 to-teal-500/40",
  },
  orange: {
    stroke: "stroke-orange-500",
    glow: "from-orange-500/40 to-amber-500/40",
  },
  gradient: {
    stroke: "",
    glow: "from-cyan-500/40 via-blue-500/40 to-purple-500/40",
  },
};

const GlassGauge = React.forwardRef<HTMLDivElement, GlassGaugeProps>(
  (
    {
      className,
      value,
      max = 100,
      size = "md",
      showValue = true,
      label,
      colorScheme = "cyan",
      animated = true,
      ...props
    },
    ref
  ) => {
    const [displayValue, setDisplayValue] = React.useState(0);
    const config = sizes[size];
    const colors = colorSchemes[colorScheme];
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const radius = (config.size - config.strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    React.useEffect(() => {
      if (!animated) {
        setDisplayValue(value);
        return;
      }

      const duration = 1000;
      const steps = 60;
      const increment = value / steps;
      let current = 0;
      let step = 0;

      const timer = setInterval(() => {
        step++;
        current = Math.min(current + increment, value);
        setDisplayValue(Math.round(current));

        if (step >= steps) {
          clearInterval(timer);
          setDisplayValue(value);
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }, [value, animated]);

    const gradientId = React.useId();

    return (
      <div
        className={cn("relative inline-flex flex-col items-center", className)}
        ref={ref}
        {...props}
      >
        {/* Glow effect */}
        <div
          className={cn(
            "absolute rounded-full bg-linear-to-r opacity-60 blur-xl",
            colors.glow
          )}
          style={{
            width: config.size * 0.8,
            height: config.size * 0.8,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        <div
          className="relative"
          style={{ width: config.size, height: config.size }}
        >
          <svg
            className="-rotate-90 transform"
            height={config.size}
            width={config.size}
          >
            {/* Gradient definition */}
            {colorScheme === "gradient" && (
              <defs>
                <linearGradient
                  id={gradientId}
                  x1="0%"
                  x2="100%"
                  y1="0%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            )}

            {/* Background track */}
            <circle
              className="text-white/10"
              cx={config.size / 2}
              cy={config.size / 2}
              fill="none"
              r={radius}
              stroke="currentColor"
              strokeWidth={config.strokeWidth}
            />

            {/* Glass reflection on track */}
            <circle
              className="text-white/5"
              cx={config.size / 2}
              cy={config.size / 2}
              fill="none"
              r={radius - config.strokeWidth / 2}
              stroke="currentColor"
              strokeWidth={1}
            />

            {/* Progress arc */}
            <circle
              className={cn(
                "transition-all duration-1000 ease-out",
                colorScheme !== "gradient" && colors.stroke
              )}
              cx={config.size / 2}
              cy={config.size / 2}
              fill="none"
              r={radius}
              stroke={
                colorScheme === "gradient" ? `url(#${gradientId})` : undefined
              }
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              strokeWidth={config.strokeWidth}
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {showValue && (
              <span className={cn("font-bold text-white", config.fontSize)}>
                {displayValue}
                <span className="text-sm text-white/40">%</span>
              </span>
            )}
            {label && (
              <span className="mt-1 text-sm text-white/60">{label}</span>
            )}
          </div>
        </div>
      </div>
    );
  }
);
GlassGauge.displayName = "GlassGauge";

export { GlassGauge };
