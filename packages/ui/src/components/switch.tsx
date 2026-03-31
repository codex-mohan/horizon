"use client";

import * as React from "react";

interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
}

export function Switch({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled = false,
  className = "",
  id,
  name,
  required,
  ...props
}: SwitchProps) {
  const [isChecked, setIsChecked] = React.useState(defaultChecked ?? false);
  const isControlled = checked !== undefined;
  const isOn = isControlled ? checked : isChecked;

  const handleClick = () => {
    if (disabled) return;

    const newValue = !isOn;

    if (!isControlled) {
      setIsChecked(newValue);
    }

    onCheckedChange?.(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleClick();
    }
  };

  const trackStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    width: "44px",
    height: "24px",
    borderRadius: "12px",
    border: "none",
    padding: "2px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    backgroundColor: isOn ? "var(--primary, #8b5cf6)" : "var(--input, #e5e5e5)",
    transition: "background-color 200ms ease-out",
    outline: "none",
  };

  const thumbStyle: React.CSSProperties = {
    position: "absolute",
    left: isOn ? "22px" : "2px",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    backgroundColor: "#ffffff",
    boxShadow:
      "0 1px 3px rgba(0,0,0,0.25), 0 1px 2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.9)",
    border: "1px solid rgba(0,0,0,0.1)",
    transition: "left 200ms ease-out",
    pointerEvents: "none",
  };

  return (
    <button
      id={id}
      name={name}
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-required={required}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = "0 0 0 2px var(--ring, #8b5cf6)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = "none";
      }}
      style={trackStyle}
      className={className}
      {...props}
    >
      <span style={thumbStyle} />
    </button>
  );
}
