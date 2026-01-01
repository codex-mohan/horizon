"use client"

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="bg-shape bg-shape-1 animate-pulse-glow" />
      <div className="bg-shape bg-shape-2 animate-pulse-glow" style={{ animationDelay: "1s" }} />
      <div className="bg-shape bg-shape-3 animate-pulse-glow" style={{ animationDelay: "2s" }} />
    </div>
  )
}

/* Added pulse-glow animation to the keyframes section in globals.css */
