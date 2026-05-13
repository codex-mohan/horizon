import type { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function Button({
  children,
  variant = "primary",
  onClick,
  className = "",
  disabled,
}: ButtonProps) {
  const base = "font-satoshi font-medium text-sm transition-all duration-200 border";
  const variants: Record<string, string> = {
    primary:
      "bg-white/[0.06] text-[var(--text-primary)] border-white/[0.08] hover:bg-white/[0.1] hover:border-white/[0.14]",
    secondary:
      "bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]",
    ghost:
      "bg-transparent text-[var(--text-secondary)] border-transparent hover:bg-[var(--bg-surface)]",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}
