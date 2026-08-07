import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import {
  Zap, FileText, Brain, BarChart3,
  Minimize2, ArrowRight, Check,
  ChevronDown, Menu, X, ScanText, GitCompare,
  Clock, DollarSign, Target, Bot,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const stats = [
  { label: 'Prompts Compressed', value: '2.4M', icon: FileText },
  { label: 'Tokens Saved', value: '86%', icon: Zap },
  { label: 'Cost Reduced', value: '$48K', icon: DollarSign },
  { label: 'Latency Cut', value: '42%', icon: Clock },
];

const features = [
  { title: 'AI Context Compression', desc: 'Distill verbose prompts into sharper, cheaper instructions without losing intent.', icon: Minimize2 },
  { title: 'Multi-Agent Intelligence', desc: '13 specialized agents analyze, classify, and optimize your context.', icon: Brain },
  { title: 'OCR Engine', desc: 'Extract text from screenshots — save 90% on vision tokens.', icon: ScanText },
  { title: 'Adaptive Compression', desc: 'Automatically falls back to lighter compression if accuracy drops.', icon: Target },
  { title: 'Model Playground', desc: 'Benchmark original vs compressed prompts across any LLM.', icon: GitCompare },
  { title: 'Analytics Dashboard', desc: 'Track compression trends, cost savings, and quality metrics.', icon: BarChart3 },
];

const workflow = [
  { step: '01', title: 'Upload', desc: 'Paste prompt, upload PDF, image, or code' },
  { step: '02', title: 'Understand', desc: '13 agents classify, detect language, extract entities' },
  { step: '03', title: 'Optimize', desc: 'Remove filler, deduplicate, compress semantically' },
  { step: '04', title: 'Validate', desc: 'Verify >95% accuracy with fidelity scoring' },
  { step: '05', title: 'Send to LLM', desc: 'Compressed prompt → faster, cheaper AI response' },
];

const pricing = [
  { name: 'Developer', price: 'Free', desc: 'For solo builders', features: ['1,000 compressions/mo', 'Core agents', 'Community support'], accent: false },
  { name: 'Pro', price: '$29', desc: 'For teams shipping AI', features: ['Unlimited compressions', 'All agents + OCR', 'Priority API', 'Model Playground'], accent: true },
  { name: 'Enterprise', price: 'Custom', desc: 'For scale', features: ['SSO & RBAC', 'Dedicated support', 'SLA guarantee', 'On-prem option'], accent: false },
];

const faqs = [
  { q: 'How does CortexAI preserve accuracy?', a: 'Our multi-agent pipeline uses semantic analysis, entity preservation, and reasoning-retention scoring. We guarantee >95% accuracy with adaptive fallback.' },
  { q: 'Which LLMs are supported?', a: 'OpenAI, Gemini, Claude, Llama, DeepSeek, Mistral, and any Ollama-compatible local model.' },
  { q: 'Is my data secure?', a: 'API keys are encrypted with AES-256-GCM. All data is per-user isolated with Row Level Security. We never log plaintext secrets.' },
  { q: 'Can I self-host?', a: 'Yes. The entire platform is open-source. Deploy with Docker or directly to any Node.js hosting.' },
];

const techStack = ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Prisma', 'Tesseract.js', 'Supabase', 'Vercel', 'Railway'];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function GlowOrb({ className }: { className?: string }) {
  return <div className={`absolute rounded-full blur-[120px] pointer-events-none ${className}`} />;
}

function AnimatedCounter({ target, suffix = '' }: { target: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const numericPart = target.replace(/[^0-9.]/g, '');
  const prefix = target.replace(/[0-9.]+.*/, '');
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const end = parseFloat(numericPart) || 0;
    const duration = 1500;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * end * 10) / 10);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, numericPart]);

  return (
    <span ref={ref}>
      {prefix}{isInView ? count : 0}{suffix}
    </span>
  );
}

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      className="border border-white/10 rounded-2xl overflow-hidden"
    >
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors">
        <span className="text-sm font-medium text-white">{q}</span>
        <ChevronDown className={`w-4 h-4 text-white/60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <p className="px-5 pb-5 text-sm text-white/60 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#030712] text-white selection:bg-violet-500/30">
      {/* Background orbs */}
      <GlowOrb className="w-96 h-96 bg-violet-600/20 -top-48 -left-48" />
      <GlowOrb className="w-80 h-80 bg-cyan-500/15 top-[20%] -right-40" />
      <GlowOrb className="w-72 h-72 bg-fuchsia-500/10 bottom-[30%] left-[15%]" />

      {/* ─── NAVBAR ──────────────────────────────────────────────────── */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'py-2' : 'py-4'}`}>
        <div className={`mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 py-3 rounded-full border backdrop-blur-xl transition-all ${scrolled ? 'border-white/15 bg-black/60 shadow-2xl' : 'border-white/10 bg-white/5'}`}>
          <Link to="/" className="flex items-center gap-2.5 text-sm font-bold tracking-wider uppercase">
            <motion.div animate={{ rotate: [0, 5, -3, 0] }} transition={{ duration: 5, repeat: Infinity }} className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/40 to-cyan-400/30 border border-violet-400/30 flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-violet-300" />
            </motion.div>
            <span className="hidden sm:inline bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">CortexAI</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#workflow" className="hover:text-white transition">How It Works</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden sm:inline-flex px-4 py-2 text-sm text-white/80 border border-white/10 rounded-full hover:bg-white/10 transition">Login</Link>
            <Link to="/register" className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 rounded-full shadow-[0_10px_30px_rgba(124,58,237,0.3)] hover:scale-[1.03] transition-transform">Get Started</Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-full border border-white/10 hover:bg-white/10">
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* ─── HERO ────────────────────────────────────────────────────── */}
      <motion.section ref={heroRef} style={{ opacity: heroOpacity }} className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-24 pb-16">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-400/20 bg-violet-500/10 text-sm text-violet-200 mb-8">
            <Bot className="w-4 h-4" />
            AI Context Intelligence Platform
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[0.95] tracking-tight">
            Think Less.{' '}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">Context More.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
            The world's first AI middleware that compresses prompts by 70%+ while preserving 95%+ reasoning accuracy. Save tokens. Reduce cost. Increase performance.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link to="/register" className="group px-6 py-3.5 text-sm font-semibold bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 rounded-full shadow-[0_18px_45px_rgba(124,58,237,0.35)] hover:scale-[1.03] transition-transform flex items-center gap-2">
              Start Compressing <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a href="#workflow" className="px-6 py-3.5 text-sm font-semibold text-white/80 border border-white/10 bg-white/5 rounded-full hover:bg-white/10 transition">
              See How It Works
            </a>
          </div>
        </motion.div>

        {/* Animated pipeline visualization */}
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="mt-16 w-full max-w-3xl">
          <div className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
            <div className="grid grid-cols-5 gap-3">
              {['Input', 'Classify', 'Analyze', 'Compress', 'Validate'].map((stage, i) => (
                <motion.div
                  key={stage}
                  animate={{ opacity: [0.5, 1, 0.5], scale: [0.98, 1.02, 0.98] }}
                  transition={{ duration: 2, delay: i * 0.4, repeat: Infinity }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-white/10 bg-gradient-to-b from-white/10 to-transparent"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/30 to-cyan-400/20 flex items-center justify-center text-xs font-bold text-violet-200">
                    {i + 1}
                  </div>
                  <span className="text-[10px] text-white/60 font-medium">{stage}</span>
                </motion.div>
              ))}
            </div>
            <div className="absolute inset-x-6 top-1/2 h-px bg-gradient-to-r from-violet-500/50 via-cyan-400/50 to-fuchsia-500/50 -translate-y-1/2 -z-10" />
          </div>
        </motion.div>
      </motion.section>

      {/* ─── STATS ───────────────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-6xl grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 text-center">
              <stat.icon className="w-5 h-5 text-violet-300 mx-auto mb-3" />
              <p className="text-3xl font-bold text-white"><AnimatedCounter target={stat.value} /></p>
              <p className="text-xs text-white/50 mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ────────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-4">
        <div className="mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-14">
            <p className="text-sm uppercase tracking-[0.3em] text-violet-300 mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Built like an AI operating system.</h2>
          </motion.div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="group rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-transparent p-6 hover:border-violet-400/30 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(124,58,237,0.15)] transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-400/20 flex items-center justify-center text-violet-200 mb-4">
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ────────────────────────────────────────────── */}
      <section id="workflow" className="py-20 px-4">
        <div className="mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-14">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300 mb-3">How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Five stages. One pipeline. Zero waste.</h2>
          </motion.div>
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-violet-500/50 via-cyan-400/50 to-fuchsia-500/30 hidden md:block" />
            <div className="space-y-8">
              {workflow.map((w, i) => (
                <motion.div key={w.step} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="flex gap-6 items-start md:ml-2">
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-400/20 border border-white/10 flex items-center justify-center text-xl font-bold text-violet-200">
                      {w.step}
                    </div>
                  </div>
                  <div className="pt-2">
                    <h3 className="text-lg font-semibold text-white">{w.title}</h3>
                    <p className="text-sm text-white/60 mt-1">{w.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── COMPARISON ──────────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-4xl">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-14">
            <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-300 mb-3">The Difference</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Every token costs money.</h2>
          </motion.div>
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
              <h4 className="text-sm font-semibold text-red-300 mb-4">Without CortexAI</h4>
              <div className="space-y-3 text-sm text-white/70">
                <div className="flex justify-between"><span>Tokens</span><span className="font-mono text-red-300">4,200</span></div>
                <div className="flex justify-between"><span>Latency</span><span className="font-mono text-red-300">850ms</span></div>
                <div className="flex justify-between"><span>Cost per call</span><span className="font-mono text-red-300">$0.126</span></div>
                <div className="flex justify-between"><span>Monthly (10K calls)</span><span className="font-mono text-red-300">$1,260</span></div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-6">
              <h4 className="text-sm font-semibold text-emerald-300 mb-4">With CortexAI</h4>
              <div className="space-y-3 text-sm text-white/70">
                <div className="flex justify-between"><span>Tokens</span><span className="font-mono text-emerald-300">1,260</span></div>
                <div className="flex justify-between"><span>Latency</span><span className="font-mono text-emerald-300">290ms</span></div>
                <div className="flex justify-between"><span>Cost per call</span><span className="font-mono text-emerald-300">$0.038</span></div>
                <div className="flex justify-between"><span>Monthly (10K calls)</span><span className="font-mono text-emerald-300">$378</span></div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── PRICING ─────────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 px-4">
        <div className="mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-14">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300 mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Start free. Scale without limits.</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-5">
            {pricing.map((tier, i) => (
              <motion.div key={tier.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className={`rounded-2xl border p-6 ${tier.accent ? 'border-violet-400/30 bg-gradient-to-br from-violet-500/15 to-cyan-400/10 shadow-[0_20px_60px_rgba(124,58,237,0.2)]' : 'border-white/10 bg-white/5'}`}>
                <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
                <p className="text-3xl font-bold text-white mt-2">{tier.price}<span className="text-sm text-white/50 font-normal">{tier.price !== 'Custom' ? '/mo' : ''}</span></p>
                <p className="text-sm text-white/50 mt-1">{tier.desc}</p>
                <ul className="mt-5 space-y-2">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className={`mt-6 block text-center py-2.5 rounded-full text-sm font-semibold transition ${tier.accent ? 'bg-gradient-to-r from-violet-500 to-cyan-400 text-white hover:scale-[1.02]' : 'border border-white/10 text-white/80 hover:bg-white/10'}`}>
                  {tier.price === 'Custom' ? 'Contact Us' : 'Get Started'}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TECH STACK ──────────────────────────────────────────────── */}
      <section className="py-16 px-4">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm text-white/40 mb-6">Built with modern infrastructure</p>
          <div className="flex flex-wrap justify-center gap-3">
            {techStack.map((tech, i) => (
              <motion.div key={tech} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm text-white/70 hover:border-violet-400/30 hover:text-white transition">
                {tech}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 px-4">
        <div className="mx-auto max-w-3xl">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-14">
            <p className="text-sm uppercase tracking-[0.3em] text-violet-300 mb-3">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Common questions.</h2>
          </motion.div>
          <div className="space-y-3">
            {faqs.map((faq, i) => <FaqItem key={i} q={faq.q} a={faq.a} index={i} />)}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ───────────────────────────────────────────────── */}
      <section className="py-24 px-4 relative overflow-hidden">
        <GlowOrb className="w-[500px] h-[500px] bg-violet-600/20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <div className="relative mx-auto max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl sm:text-5xl font-bold leading-tight">
              Stop paying for{' '}
              <span className="bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">unnecessary tokens.</span>
            </h2>
            <p className="mt-4 text-lg text-white/60 max-w-xl mx-auto">
              Join thousands of developers who compress their prompts before hitting any LLM API.
            </p>
            <Link to="/register" className="mt-8 inline-flex items-center gap-2 px-8 py-4 text-base font-semibold bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 rounded-full shadow-[0_20px_60px_rgba(124,58,237,0.4)] hover:scale-[1.03] transition-transform">
              Get Started Free <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-12 px-4">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Zap className="w-4 h-4 text-violet-400" />
            <span>CortexAI © {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/50">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
            <Link to="/login" className="hover:text-white transition">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
