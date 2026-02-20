"use client";

import * as React from "react";

interface GradientSliderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  gradientColors?: {
    from?: string;
    via?: string;
    to?: string;
  };
  min?: number;
  max?: number;
  step?: number;
  value?: number[];
  defaultValue?: number[];
  onChange?: (value: number[]) => void;
  onValueChange?: (value: number[]) => void;
  disabled?: boolean;
  orientation?: "horizontal" | "vertical";
  trackClassName?: string;
  thumbClassName?: string;
}

const GradientSlider = React.forwardRef<HTMLDivElement, GradientSliderProps>(
  (
    {
      className = "",
      gradientColors,
      min = 0,
      max = 100,
      step = 1,
      value: controlledValue,
      defaultValue = [50],
      onChange,
      onValueChange,
      disabled = false,
      orientation = "horizontal",
      trackClassName = "",
      thumbClassName = "",
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const [isDragging, setIsDragging] = React.useState(false);
    const trackRef = React.useRef<HTMLDivElement>(null);

    // Support both onChange and onValueChange
    const handleChange = React.useCallback(
      (newValue: number[]) => {
        onChange?.(newValue);
        onValueChange?.(newValue);
      },
      [onChange, onValueChange]
    );

    const valueArray = controlledValue !== undefined ? controlledValue : internalValue;
    const value: any = valueArray[0];

    // Fixed: Provide default gradient colors from global theme
    const fromColor = gradientColors?.from ?? "var(--gradient-from, #ec4899)";
    const viaColor = gradientColors?.via ?? "var(--gradient-via, #8b5cf6)";
    const toColor = gradientColors?.to ?? "var(--gradient-to, #3b82f6)";

    const gradientStyle = {
      background: `linear-gradient(to ${orientation === "horizontal" ? "right" : "top"}, ${fromColor}, ${viaColor}, ${toColor})`,
    };

    const percentage = ((value - min) / (max - min)) * 100;

    const updateValue = React.useCallback(
      (clientX: number, clientY: number) => {
        if (!trackRef.current || disabled) {
          return;
        }

        const rect = trackRef.current.getBoundingClientRect();
        let newPercentage: number;

        if (orientation === "horizontal") {
          newPercentage = ((clientX - rect.left) / rect.width) * 100;
        } else {
          newPercentage = ((rect.bottom - clientY) / rect.height) * 100;
        }

        newPercentage = Math.max(0, Math.min(100, newPercentage));

        let newValue = min + (newPercentage / 100) * (max - min);
        newValue = Math.round(newValue / step) * step;
        newValue = Math.max(min, Math.min(max, newValue));

        // Fix floating point precision errors
        const decimalPlaces = step.toString().split(".")[1]?.length || 0;
        newValue = Number(newValue.toFixed(Math.max(decimalPlaces, 10)));

        if (controlledValue === undefined) {
          setInternalValue([newValue]);
        }
        handleChange([newValue]);
      },
      [min, max, step, disabled, handleChange, controlledValue, orientation]
    );

    const handleMouseDown = (e: React.MouseEvent) => {
      if (disabled) {
        return;
      }
      e.preventDefault();
      setIsDragging(true);
      updateValue(e.clientX, e.clientY);
    };

    const handleThumbMouseDown = (e: React.MouseEvent) => {
      if (disabled) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };

    const handleMouseMove = React.useCallback(
      (e: MouseEvent) => {
        if (isDragging) {
          updateValue(e.clientX, e.clientY);
        }
      },
      [isDragging, updateValue]
    );

    const handleMouseUp = React.useCallback(() => {
      setIsDragging(false);
    }, []);

    const handleTouchStart = (e: React.TouchEvent) => {
      if (disabled) {
        return;
      }
      e.preventDefault();
      setIsDragging(true);
      const touch: any = e.touches[0];
      updateValue(touch.clientX, touch.clientY);
    };

    const handleThumbTouchStart = (e: React.TouchEvent) => {
      if (disabled) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };

    const handleTouchMove = React.useCallback(
      (e: TouchEvent) => {
        if (isDragging) {
          const touch: any = e.touches[0];
          updateValue(touch.clientX, touch.clientY);
        }
      },
      [isDragging, updateValue]
    );

    React.useEffect(() => {
      if (isDragging) {
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        window.addEventListener("touchmove", handleTouchMove);
        window.addEventListener("touchend", handleMouseUp);

        return () => {
          window.removeEventListener("mousemove", handleMouseMove);
          window.removeEventListener("mouseup", handleMouseUp);
          window.removeEventListener("touchmove", handleTouchMove);
          window.removeEventListener("touchend", handleMouseUp);
        };
      }
    }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) {
        return;
      }

      let newValue = value;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          newValue = Math.min(max, value + step);
          e.preventDefault();
          break;
        case "ArrowLeft":
        case "ArrowDown":
          newValue = Math.max(min, value - step);
          e.preventDefault();
          break;
        case "Home":
          newValue = min;
          e.preventDefault();
          break;
        case "End":
          newValue = max;
          e.preventDefault();
          break;
        default:
          return;
      }

      // Fix floating point precision errors
      const decimalPlaces = step.toString().split(".")[1]?.length || 0;
      newValue = Number(newValue.toFixed(Math.max(decimalPlaces, 10)));

      if (controlledValue === undefined) {
        setInternalValue([newValue]);
      }
      handleChange([newValue]);
    };

    const isHorizontal = orientation === "horizontal";

    return (
      <div
        className={`relative flex touch-none select-none items-center ${isHorizontal ? "w-full" : "h-full min-h-44 w-auto flex-col"
          } ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className}`}
        ref={ref}
        {...props}
      >
        {/* Track */}
        <div
          className={`relative overflow-hidden rounded-full border border-white/20 ${isHorizontal ? "w-full" : "h-full"
            } ${isHorizontal ? trackClassName || "h-2" : trackClassName || "w-1.5"
            } ${disabled ? "" : "cursor-pointer"}`}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          ref={trackRef}
          style={gradientStyle}
        />

        {/* Thumb — flat Vercel-style */}
        <div
          aria-disabled={disabled}
          aria-valuemax={max}
          aria-valuemin={min}
          aria-valuenow={value}
          className={`absolute block rounded-full bg-white ${thumbClassName || "h-4 w-4"
            } ${isDragging ? "" : "transition-all duration-100"
            } ${disabled
              ? "pointer-events-none opacity-40"
              : "cursor-grab active:cursor-grabbing hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
            } ${isDragging ? "scale-110" : ""}`}
          onKeyDown={handleKeyDown}
          onMouseDown={handleThumbMouseDown}
          onTouchStart={handleThumbTouchStart}
          role="slider"
          style={{
            [isHorizontal ? "left" : "bottom"]: `${percentage}%`,
            transform: isHorizontal ? "translateX(-50%)" : "translateY(50%)",
            border: "1.5px solid rgba(255,255,255,0.25)",
            boxShadow: isDragging
              ? "0 1px 6px rgba(0,0,0,0.35)"
              : "0 1px 3px rgba(0,0,0,0.25)",
          }}
          tabIndex={disabled ? -1 : 0}
        />
      </div>
    );
  }
);

GradientSlider.displayName = "GradientSlider";

export { GradientSlider };
