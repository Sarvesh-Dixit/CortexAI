import { motion } from 'framer-motion';
import { Zap, Brain, Shield, Gauge, Globe, Code2, Users, Rocket } from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'Multi-Agent Compression',
    description: 'Our pipeline uses semantic analysis, structural compression, redundancy removal, and token optimization working together.',
  },
  {
    icon: Gauge,
    title: '70%+ Token Reduction',
    description: 'Achieve over 70% reduction in token usage while maintaining 95%+ semantic accuracy on your prompts.',
  },
  {
    icon: Globe,
    title: 'Multi-Provider Support',
    description: 'Works with OpenAI, Gemini, Claude, Llama, DeepSeek, Mistral, and Ollama. Easily extensible for new providers.',
  },
  {
    icon: Code2,
    title: 'Multi-Format Support',
    description: 'Process text, code (Python, JS, Java, C++), PDFs, DOCX, Markdown, JSON, CSV, logs, emails, and legal documents.',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'JWT authentication, rate limiting, input validation, and helmet protection. Your data stays secure.',
  },
  {
    icon: Rocket,
    title: 'Production Ready',
    description: 'Built with TypeScript, clean architecture, modular design, comprehensive error handling, and logging.',
  },
];

const techStack = [
  { category: 'Frontend', items: ['React 18', 'TypeScript', 'Vite', 'Tailwind CSS', 'Framer Motion', 'Recharts', 'Zustand'] },
  { category: 'Backend', items: ['Node.js', 'Express', 'TypeScript', 'Prisma ORM', 'SQLite', 'JWT Auth', 'Winston Logger'] },
  { category: 'AI Engine', items: ['Semantic Compressor', 'Structural Compressor', 'Redundancy Remover', 'Token Optimizer', 'Code Analyzer', 'Text Analyzer'] },
  { category: 'Architecture', items: ['Clean Architecture', 'SOLID Principles', 'Modular Design', 'Dependency Injection', 'Multi-Agent Pipeline'] },
];

export default function AboutPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="w-16 h-16 rounded-2xl gradient-button flex items-center justify-center mx-auto mb-4">
          <Zap className="w-9 h-9 text-white" />
        </div>
        <h1 className="text-3xl font-bold gradient-text mb-3">CortexAI</h1>
        <p className="text-[hsl(var(--muted-foreground))] max-w-xl mx-auto">
          Ultra-Low Resource LLM Context Compression Engine. An intelligent middleware platform that
          reduces token usage by 70%+ while preserving 95%+ reasoning accuracy.
        </p>
      </motion.div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <h2 className="text-lg font-semibold mb-4">How It Works</h2>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center">
          {[
            { step: '1', label: 'Input', desc: 'User sends prompt' },
            { step: '2', label: 'Analyze', desc: 'Detect type & structure' },
            { step: '3', label: 'Compress', desc: 'Multi-stage pipeline' },
            { step: '4', label: 'Validate', desc: 'Semantic preservation' },
            { step: '5', label: 'Output', desc: 'Optimized prompt' },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full gradient-button flex items-center justify-center text-white font-bold text-sm mb-2">
                {item.step}
              </div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{item.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-lg font-semibold mb-4">Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.05 }}
              className="glass-card p-5"
            >
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center text-[hsl(var(--primary))] mb-3">
                <feature.icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold mb-1">{feature.title}</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Tech Stack */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-6"
      >
        <h2 className="text-lg font-semibold mb-4">Technology Stack</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {techStack.map((group) => (
            <div key={group.category}>
              <h4 className="text-xs font-semibold text-[hsl(var(--primary))] uppercase tracking-wider mb-2">{group.category}</h4>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item} className="text-xs text-[hsl(var(--muted-foreground))]">â€¢ {item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Target Users */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-6"
      >
        <h2 className="text-lg font-semibold mb-4">Who Is This For?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { icon: Code2, label: 'AI Developers', desc: 'Building AI-powered applications' },
            { icon: Users, label: 'Software Engineers', desc: 'Debugging large projects with AI' },
            { icon: Globe, label: 'Enterprises', desc: 'Reducing expensive LLM API costs' },
            { icon: Brain, label: 'Researchers', desc: 'Processing long research papers' },
            { icon: Rocket, label: 'Students', desc: 'Optimizing prompts for ChatGPT' },
          ].map((user) => (
            <div key={user.label} className="flex items-center gap-3 p-3 bg-[hsl(var(--secondary))] rounded-xl">
              <user.icon className="w-5 h-5 text-[hsl(var(--primary))]" />
              <div>
                <p className="text-sm font-medium">{user.label}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{user.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Version */}
      <div className="text-center text-xs text-[hsl(var(--muted-foreground))] py-4">
        <p>CortexAI v1.0.0 â€¢ Built with modern AI architecture</p>
      </div>
    </div>
  );
}
