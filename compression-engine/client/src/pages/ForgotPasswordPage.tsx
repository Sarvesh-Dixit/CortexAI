import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Zap, Mail, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
      toast.success('Reset link sent to your email');
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl gradient-button flex items-center justify-center">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">CompressionAI</h1>
        </div>

        <div className="glass-card p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[hsl(var(--success))]/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-[hsl(var(--success))]" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Check Your Email</h2>
              <p className="text-[hsl(var(--muted-foreground))] text-sm mb-6">
                We've sent a password reset link to <strong>{email}</strong>
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-[hsl(var(--primary))] hover:underline text-sm"
              >
                <ArrowLeft className="w-4 h-4" /> Back to login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-center mb-2">Forgot Password?</h2>
              <p className="text-[hsl(var(--muted-foreground))] text-center text-sm mb-6">
                Enter your email and we'll send you a reset link
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 gradient-button rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <p className="text-center text-sm text-[hsl(var(--muted-foreground))] mt-6">
                <Link to="/login" className="inline-flex items-center gap-1 text-[hsl(var(--primary))] hover:underline">
                  <ArrowLeft className="w-3 h-3" /> Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
