import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  featureItems,
  liveFeed,
  testimonials,
  timelineItems,
} from "@/components/proofchain/mock-data";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pt-24">
      <div className="ambient-grid pointer-events-none absolute inset-0 opacity-80" />
      <div className="hero-glow pointer-events-none absolute inset-0" />

      <div className="relative mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-glass px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Built on UGF · Base Sepolia
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-2xl text-balance font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            Freelance Payments Without Gas Fees
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            ProofChain routes approvals, escrow release, and NFT proof minting through UGF so clients pay in
            Mock USD while freelancers receive verifiable on-chain completion records.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button asChild className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Link to="/auth">
                Start as Freelancer
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/client/dashboard">
                Hire Talent
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-3"
        >
          <div className="glass-panel relative overflow-hidden rounded-xl p-5">
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-info/20 to-transparent" />
            <div className="relative flex items-center justify-between border-b border-border/60 pb-4">
              <p className="font-semibold text-foreground">Transaction Command Center</p>
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                <span className="status-dot" /> Live
              </span>
            </div>

            <div className="relative mt-4 space-y-3">
              {liveFeed.slice(0, 3).map((item) => (
                <div key={item.detail} className="surface-panel hover-lift rounded-lg p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.type}</span>
                    <span>{item.time}</span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{item.detail}</p>
                  <p className="mt-1 text-xs text-primary">{item.status}</p>
                </div>
              ))}
            </div>

            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 4, ease: "easeInOut" }}
              className="absolute -right-8 -top-8 hidden rounded-full border border-primary/30 bg-surface-glass p-4 lg:block"
            >
              <CircleDashed className="h-10 w-10 text-primary" />
            </motion.div>
          </div>

          <div className="glass-panel rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Command palette</p>
            <div className="mt-2 flex items-center justify-between rounded-lg border border-border/70 bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
              <span>Type a command or search project...</span>
              <span className="rounded border border-border/80 px-1.5 py-0.5 text-[10px]">⌘K</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function FeatureGrid() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Product features</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Startup-grade collaboration + blockchain confidence, without UX compromises.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featureItems.map((feature, index) => (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: index * 0.04 }}
              className={`glass-panel hover-lift rounded-xl p-4 ${
                index % 3 === 0 ? "sm:col-span-2" : ""
              } ${index === 5 ? "lg:col-span-2" : ""}`}
            >
              <div className="inline-flex rounded-md bg-secondary p-2">
                <feature.icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">How it works</h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {timelineItems.map((item, index) => (
            <div key={item.title} className="glass-panel rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-sm font-semibold text-primary">
                  {index + 1}
                </div>
                <item.icon className="h-4 w-4 text-info" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-foreground">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LiveTransactions() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl rounded-xl border border-border/70 bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <h2 className="text-xl font-semibold text-foreground">Live chain activity</h2>
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            1.2s avg settlement latency
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {liveFeed.map((event) => (
            <motion.div
              key={event.detail}
              whileHover={{ scale: 1.01 }}
              className="surface-panel rounded-lg p-3 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{event.type}</span>
                <span>{event.time}</span>
              </div>
              <p className="mt-1 text-sm text-foreground">{event.detail}</p>
              <p className="mt-1 text-xs text-primary">{event.status}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TestimonialsSection() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Loved by Web3 teams shipping fast</h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <article key={testimonial.name} className="glass-panel rounded-xl p-5">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">“{testimonial.quote}”</p>
              <p className="mt-5 font-medium text-foreground">{testimonial.name}</p>
              <p className="text-xs text-muted-foreground">{testimonial.role}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
