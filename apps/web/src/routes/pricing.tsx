import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Check, Sparkles, Zap, Building2 } from "lucide-react";
import { HorizonLogo } from "@/components/animated-logo";

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "Get started with Horizon",
    icon: Sparkles,
    features: [
      "Up to 50 messages/day",
      "Access to GPT-4o mini",
      "Basic tool support",
      "Community support",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Pro",
    price: "$20",
    period: "/month",
    description: "For serious builders",
    icon: Zap,
    features: [
      "Unlimited messages",
      "Access to GPT-4o & Claude 3.5",
      "Advanced tools & agents",
      "Priority support",
      "Custom model settings",
      "API access",
    ],
    cta: "Upgrade to Pro",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For teams and organizations",
    icon: Building2,
    features: [
      "Everything in Pro",
      "SSO & SAML",
      "Audit logs & compliance",
      "Dedicated infrastructure",
      "SLA guarantee",
      "Custom integrations",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export function PricingPage() {
  return (
    <div className="min-h-screen bg-bg-void text-text-primary relative overflow-hidden">
      <div className="ambient-blobs">
        <div className="blob blob-1" />
        <div className="blob blob-3" />
      </div>

      <div className="relative z-10">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <Link to="/" className="flex items-center gap-2">
            <HorizonLogo size={28} />
            <span className="font-sora font-semibold text-sm">Horizon</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              Sign in
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 text-sm bg-white/[0.06] text-white font-medium border border-white/[0.08] hover:bg-white/[0.1]"
            >
              Get Started
            </Link>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center mb-16"
          >
            <h1 className="font-sora text-4xl font-bold text-text-primary mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-text-secondary text-lg max-w-xl mx-auto">
              Choose the plan that fits your workflow. Upgrade or downgrade at any time.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tiers.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className={`bg-bg-surface border p-6 flex flex-col ${
                  tier.popular ? "border-white/20" : "border-border-subtle"
                }`}
              >
                {tier.popular && (
                  <div className="mb-4">
                    <span className="px-2 py-1 text-xs font-medium bg-white/[0.06] text-text-secondary border border-white/[0.12]">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <tier.icon size={20} className="text-text-secondary" />
                  <h2 className="font-sora text-lg font-semibold">{tier.name}</h2>
                </div>

                <div className="mb-2">
                  <span className="font-sora text-3xl font-bold">{tier.price}</span>
                  <span className="text-text-muted text-sm">{tier.period}</span>
                </div>

                <p className="text-sm text-text-secondary mb-6">{tier.description}</p>

                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-text-secondary">
                      <Check size={16} className="text-text-secondary shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  className={`w-full py-2.5 text-sm font-medium transition-all ${
                    tier.popular
                      ? "bg-white/[0.06] text-white border border-white/[0.08] hover:bg-white/[0.1]"
                      : "bg-bg-elevated border border-border-subtle text-text-primary hover:border-border-hover"
                  }`}
                >
                  {tier.cta}
                </button>
              </motion.div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
