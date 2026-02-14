"use client";

import React from "react";

// Utility function to merge class names
const cn = (...classes: (string | undefined | false | null | any)[]) => {
  return classes.filter(Boolean).join(" ");
};

interface GradientButtonProps {
  children?: React.ReactNode;
  className?: string;
  width?: number | "full" | string;
  height?: number | "full" | string;
  type?: "button" | "reset" | "submit";
  color?: string;
  fromColor?: string;
  viaColor?: string;
  toColor?: string;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  variant?: "default" | "outline" | "ghost" | "solid";
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  glowIntensity?: "none" | "low" | "medium" | "high" | "extreme";
  iconOnly?: boolean;
  useThemeGradient?: boolean;
  radius?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
}

export const GradientButton: React.FC<GradientButtonProps> = ({
  children,
  className = "",
  height = "12",
  width = "48",
  color = "text-white",
  type = "button",
  fromColor,
  viaColor,
  toColor,
  onClick,
  disabled = false,
  variant = "default",
  icon,
  iconPosition = "left",
  glowIntensity = "medium",
  iconOnly = false,
  useThemeGradient = !(fromColor || toColor),
  radius = "md", // Default radius
}: GradientButtonProps) => {
  const [isHovered, setIsHovered] = React.useState(false);

  // Glow intensity settings
  const glowSettings = {
    none: { blur: 0, opacity: 0 },
    low: { blur: 12, opacity: 0.4 },
    medium: { blur: 20, opacity: 0.7 },
    high: { blur: 28, opacity: 0.9 },
    extreme: { blur: 40, opacity: 1 },
  };

  const currentGlow = glowSettings[glowIntensity];

  // Auto-detect icon-only mode if icon exists but no children
  const isIconOnly = iconOnly || (icon && !children);

  const gradientStyle = useThemeGradient
    ? {
        background: viaColor
          ? "linear-gradient(to right, var(--gradient-from), var(--gradient-via), var(--gradient-to))"
          : "linear-gradient(to right, var(--gradient-from), var(--gradient-to))",
      }
    : {};

  // Build gradient class for Tailwind-based gradients
  const gradientClass =
    !useThemeGradient && fromColor && toColor
      ? viaColor
        ? `bg-gradient-to-r ${fromColor} ${viaColor} ${toColor}`
        : `bg-gradient-to-r ${fromColor} ${toColor}`
      : "";

  // For icon-only buttons, make them square if width/height not explicitly set
  const buttonWidth = isIconOnly && width === "48" ? "12" : width;
  const buttonHeight = isIconOnly && height === "12" ? "12" : height;
  const finalWidthStyle =
    buttonWidth === "full"
      ? "100%"
      : typeof buttonWidth === "number"
        ? `${buttonWidth * 4}px`
        : buttonWidth;
  const finalHeightStyle =
    buttonHeight === "full"
      ? "100%"
      : typeof buttonHeight === "number"
        ? `${buttonHeight * 4}px`
        : buttonHeight;

  // Variant styles
  const getVariantStyles = () => {
    switch (variant) {
      case "outline":
        return {
          button: "bg-transparent border-2",
          borderGradient: true,
          textGradient: true,
        };
      case "ghost":
        return {
          button: "bg-transparent",
          borderGradient: false,
          textGradient: true,
        };
      case "solid":
        return {
          button: useThemeGradient ? "" : gradientClass,
          borderGradient: false,
          textGradient: false,
        };
      default: // "default"
        return {
          button: useThemeGradient ? "" : gradientClass,
          borderGradient: false,
          textGradient: false,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const radiusClass = radius === "full" ? "rounded-full" : `rounded-${radius}`;

  return (
    <div
      className={cn("relative inline-block p-2", radiusClass, className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow layer */}
      <div
        className={cn(!useThemeGradient && gradientClass, radiusClass)}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          filter: `blur(${currentGlow.blur}px)`,
          opacity: isHovered && !disabled ? currentGlow.opacity : 0,
          transition: "opacity 300ms ease-in-out",
          pointerEvents: "none",
          ...(useThemeGradient ? gradientStyle : {}),
        }}
      />

      {/* Border gradient for outline variant */}
      {variant === "outline" && (
        <div
          className={cn(
            !useThemeGradient && gradientClass,
            "absolute inset-0",
            radiusClass
          )}
          style={{
            padding: "2px",
            ...(useThemeGradient ? gradientStyle : {}),
          }}
        >
          <div className={cn("h-full w-full bg-gray-950", radiusClass)} />
        </div>
      )}

      {/* Button */}
      <button
        className={cn(
          "relative inline-flex items-center justify-center whitespace-nowrap",
          !isIconOnly && "gap-2 px-6 py-2",
          radiusClass,
          "transition-all duration-300 ease-in-out",
          "[&_svg]:size-4 [&_svg]:shrink-0",
          isIconOnly && "gap-0 px-0 py-0",
          !useThemeGradient && variantStyles.button,
          variantStyles.textGradient &&
            !useThemeGradient &&
            `bg-gradient-to-r ${fromColor} ${viaColor || ""} ${toColor} bg-clip-text text-transparent`,
          !variantStyles.textGradient && color,
          variant === "outline" && "border-transparent",
          !disabled && "cursor-pointer active:scale-95",
          !disabled && isHovered && "scale-105",
          disabled && "cursor-not-allowed opacity-50"
        )}
        disabled={disabled}
        onClick={disabled ? undefined : onClick}
        style={{
          width: finalWidthStyle,
          height: finalHeightStyle,
          filter:
            isHovered && !disabled && variant !== "ghost"
              ? "brightness(1.1)"
              : "brightness(1)",
          transition: "all 300ms ease-in-out",
          ...(useThemeGradient && (variant === "default" || variant === "solid")
            ? gradientStyle
            : {}),
          ...(useThemeGradient && variantStyles.textGradient
            ? {
                background: viaColor
                  ? "linear-gradient(to right, var(--gradient-from), var(--gradient-via), var(--gradient-to))"
                  : "linear-gradient(to right, var(--gradient-from), var(--gradient-to))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }
            : {}),
        }}
        type={type}
      >
        {icon && iconPosition === "left" && !isIconOnly && (
          <span className="inline-flex">{icon}</span>
        )}
        {isIconOnly ? <span className="inline-flex">{icon}</span> : children}
        {icon && iconPosition === "right" && !isIconOnly && (
          <span className="inline-flex">{icon}</span>
        )}
      </button>
    </div>
  );
};
