import { motion } from "framer-motion";

/**
 * HorizonTypingIndicator — Animated three-dot loader for AI responses.
 *
 * Three dots pulse in a wave pattern with the Aurora Void gradient.
 * Used when the assistant is generating a response.
 */
export function HorizonTypingIndicator() {
  const dotVariants = {
    initial: { y: 0, opacity: 0.4 },
    animate: (i: number) => ({
      y: [0, -8, 0],
      opacity: [0.4, 1, 0.4],
      transition: {
        duration: 1.2,
        repeat: Infinity,
        ease: "easeInOut" as const,
        delay: i * 0.18,
      },
    }),
  };

  return (
    <div className="flex items-center gap-1.5 py-2">
      <span className="text-[var(--color-text-muted)] text-sm font-satoshi mr-1">
        Horizon is thinking
      </span>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            custom={i}
            variants={dotVariants}
            initial="initial"
            animate="animate"
            className="w-1.5 h-1.5 bg-text-muted"
          />
        ))}
      </div>
    </div>
  );
}

/**
 * HorizonPulseOrb — A single pulsing orb animation.
 *
 * A glowing orb that expands and contracts with a gradient glow.
 * Alternative loading indicator for a more immersive feel.
 */
export function HorizonPulseOrb() {
  return (
    <div className="flex items-center justify-center py-3">
      <motion.div
        className="w-3 h-3 bg-white/50"
        animate={{
          scale: [1, 1.6, 1],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="w-3 h-3 bg-white/30 absolute"
        animate={{
          scale: [1.6, 2.2, 1.6],
          opacity: [0.3, 0.1, 0.3],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

/**
 * HorizonWaveform — Animated waveform bars.
 *
 * Multiple vertical bars oscillate in a wave pattern.
 * Great for indicating voice/audio processing or streaming.
 */
export function HorizonWaveform({ barCount = 5 }: { barCount?: number }) {
  return (
    <div className="flex items-center gap-[2px] h-5 py-1">
      {Array.from({ length: barCount }, (_, i) => (
        <motion.div
          key={i}
          className="w-[3px] bg-text-muted"
          animate={{
            height: ["20%", "80%", "20%"],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.1,
          }}
        />
      ))}
    </div>
  );
}

/**
 * HorizonEventHorizon — The signature loading animation.
 *
 * A particle ring that spins and contracts like matter falling
 * into a black hole. This is the most unique and immersive loader.
 */
export function HorizonEventHorizon() {
  const particles = 8;

  return (
    <div className="flex items-center justify-center py-4">
      <div className="relative w-10 h-10">
        {/* Outer ring */}
        <motion.div
          className="absolute inset-0 border border-white/20 opacity-30"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />

        {/* Inner ring */}
        <motion.div
          className="absolute inset-2 border border-white/15 opacity-40"
          animate={{ rotate: -360 }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        />

        {/* Particles orbiting */}
        {Array.from({ length: particles }, (_, i) => {
          const angle = (i / particles) * 360;
          return (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-text-muted"
              style={{
                top: "50%",
                left: "50%",
                marginLeft: "-2px",
                marginTop: "-2px",
              }}
              animate={{
                x: [
                  Math.cos((angle * Math.PI) / 180) * 16,
                  Math.cos(((angle + 180) * Math.PI) / 180) * 8,
                  Math.cos((angle * Math.PI) / 180) * 16,
                ],
                y: [
                  Math.sin((angle * Math.PI) / 180) * 16,
                  Math.sin(((angle + 180) * Math.PI) / 180) * 8,
                  Math.sin((angle * Math.PI) / 180) * 16,
                ],
                opacity: [0.8, 1, 0.8],
                scale: [1, 1.3, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.1,
              }}
            />
          );
        })}

        {/* Center singularity */}
        <motion.div
          className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-white/60"
          style={{ marginLeft: "-3px", marginTop: "-3px" }}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
    </div>
  );
}
