import { motion } from "framer-motion";

interface HorizonLogoProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

/**
 * HorizonLogo — The official Horizon brand logo.
 *
 * Uses the original SVG from the Horizon project with optional
 * Framer Motion entrance animation and subtle pulse glow.
 */
export function HorizonLogo({ size = 48, className = "", animate = true }: HorizonLogoProps) {
  const svgContent = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="gradient-primary" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="gradient-secondary" x1="0" y1="256" x2="512" y2="256" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.4" />
        </linearGradient>
        <filter id="logoGlow">
          <feGaussianBlur stdDeviation="8" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ambient Orbit Rings */}
      <circle cx="256" cy="256" r="230" stroke="url(#gradient-secondary)" strokeWidth="16" opacity="0.2" />
      <circle cx="256" cy="256" r="190" stroke="url(#gradient-primary)" strokeWidth="8" opacity="0.1" />

      {/* Horizon Arch (Rising Sun / Dome) */}
      <path
        d="M 128 230 A 128 128 0 0 1 384 230"
        stroke="url(#gradient-primary)"
        strokeWidth="40"
        strokeLinecap="round"
        filter="url(#logoGlow)"
      />

      {/* Inner Core / Singularity */}
      <circle cx="256" cy="230" r="40" fill="url(#gradient-secondary)" filter="url(#logoGlow)" />
      <circle cx="256" cy="230" r="16" fill="#FFFFFF" opacity="0.9" />

      {/* Main Horizon Line */}
      <line x1="88" y1="300" x2="424" y2="300" stroke="url(#gradient-primary)" strokeWidth="40" strokeLinecap="round" filter="url(#logoGlow)" />

      {/* Lower Reflection Line */}
      <line x1="160" y1="380" x2="352" y2="380" stroke="url(#gradient-secondary)" strokeWidth="40" strokeLinecap="round" opacity="0.85" />
    </svg>
  );

  if (!animate) {
    return svgContent;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      style={{ display: "inline-block" }}
    >
      <motion.div
        animate={{
          filter: [
            "drop-shadow(0 0 4px rgba(255, 255, 255, 0.15))",
            "drop-shadow(0 0 12px rgba(255, 255, 255, 0.3))",
            "drop-shadow(0 0 4px rgba(255, 255, 255, 0.15))",
          ],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {svgContent}
      </motion.div>
    </motion.div>
  );
}

/**
 * HorizonLogoStatic — Non-animated version for headers/nav.
 */
export function HorizonLogoStatic({ size = 32, className = "" }: { size?: number; className?: string }) {
  return <HorizonLogo size={size} className={className} animate={false} />;
}
