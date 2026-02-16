"use client";

export function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="animate-pulse-glow bg-shape bg-shape-1" />
      <div className="animate-pulse-glow bg-shape bg-shape-2" style={{ animationDelay: "1s" }} />
      <div className="animate-pulse-glow bg-shape bg-shape-3" style={{ animationDelay: "2s" }} />
    </div>
  );
}

/* Added pulse-glow animation to the keyframes section in globals.css */
