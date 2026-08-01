import { useState } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, ChevronDown, Book, Zap, Shield, Code2, Mail } from 'lucide-react';
import { PageHeader } from '../components/shared';
import { Card } from '../components/ui';
import { cn } from '../lib/utils';

const faqs = [
  {
    q: 'How does the compression engine work?',
    a: 'The engine uses a multi-agent pipeline where 13 specialized agents work together. Each agent has a single responsibility: input processing, document classification, language detection, token analysis, semantic similarity, duplicate detection, boilerplate removal, code analysis, log analysis, importance scoring, compression, validation, and dashboard generation. The Supervisor Agent orchestrates them through a directed graph.',
  },
  {
    q: 'What compression levels should I use?',
    a: 'Low (~30%) preserves near-original content, great for critical prompts. Medium (~50%) balances compression and quality, ideal for general use. High (~70%) is aggressive, best for cost savings on long documents. Extreme (~85%) aggressively compresses everything, use when tokens matter most.',
  },
  {
    q: 'What file types are supported?',
    a: 'The platform supports: TXT, PDF, DOCX, Markdown (.md), JSON, CSV, Python (.py), JavaScript (.js), TypeScript (.ts), Java (.java), C++ (.cpp), and log files. Each type is processed with type-specific compression strategies.',
  },
  {
    q: 'How is semantic accuracy measured?',
    a: 'The Validation Agent measures semantic similarity using multiple factors: key term preservation, named entity retention, structural preservation, semantic density, and reasoning connector retention. It only approves compressions that meet quality thresholds based on the compression level.',
  },
  {
    q: 'Which LLM providers are supported?',
    a: 'We support OpenAI (GPT), Google Gemini, Anthropic Claude, Meta Llama, DeepSeek, Mistral AI, and Ollama for local models. The architecture allows easy addition of new providers.',
  },
  {
    q: 'How is my data handled?',
    a: 'All data is stored locally in your SQLite database. Passwords are hashed with bcrypt, sessions use JWT tokens, and all API requests are protected with authentication middleware. API keys you add for LLM providers are encrypted at rest.',
  },
  {
    q: 'Can I use this in production?',
    a: 'Yes. The platform is built with production-ready practices: strict TypeScript, error handling, logging, rate limiting, input validation, security middleware (Helmet, CORS), and modular architecture. For high-scale deployments, consider swapping SQLite for PostgreSQL and adding Redis for caching.',
  },
];

const categories = [
  {
    icon: Book,
    title: 'Getting Started',
    description: 'Learn the basics of prompt compression',
    color: 'text-violet-400 bg-violet-500/10',
  },
  {
    icon: Zap,
    title: 'Advanced Features',
    description: 'Multi-agent pipeline and validation',
    color: 'text-cyan-400 bg-cyan-500/10',
  },
  {
    icon: Code2,
    title: 'API Reference',
    description: 'Integrate with your applications',
    color: 'text-emerald-400 bg-emerald-500/10',
  },
  {
    icon: Shield,
    title: 'Security & Privacy',
    description: 'How your data is protected',
    color: 'text-amber-400 bg-amber-500/10',
  },
];

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[hsl(var(--secondary))]/30 transition-colors"
      >
        <span className="text-sm font-medium">{q}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-[hsl(var(--muted-foreground))] transition-transform flex-shrink-0 ml-3',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="px-5 pb-4 text-sm text-[hsl(var(--muted-foreground))] leading-relaxed border-t border-[hsl(var(--border))] pt-3"
        >
          {a}
        </motion.div>
      )}
    </motion.div>
  );
}

export default function HelpPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        title="Help Center"
        description="Find answers, guides, and support for CompressionAI"
      />

      {/* Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((cat, i) => (
          <motion.div
            key={cat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-4 hover:border-[hsl(var(--primary))]/30 cursor-pointer transition-all"
          >
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', cat.color)}>
              <cat.icon className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold mb-1">{cat.title}</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{cat.description}</p>
          </motion.div>
        ))}
      </div>

      {/* FAQs */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-4 h-4 text-[hsl(var(--primary))]" />
          <h2 className="text-lg font-semibold">Frequently Asked Questions</h2>
        </div>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <FaqItem key={i} q={faq.q} a={faq.a} index={i} />
          ))}
        </div>
      </div>

      {/* Contact */}
      <Card padding="lg">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center text-[hsl(var(--primary))] flex-shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold mb-1">Still need help?</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
              Can't find the answer you're looking for? Our team is here to help.
            </p>
            <a
              href="mailto:support@compressionai.dev"
              className="inline-flex items-center gap-2 text-sm text-[hsl(var(--primary))] hover:underline font-medium"
            >
              Contact Support
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
