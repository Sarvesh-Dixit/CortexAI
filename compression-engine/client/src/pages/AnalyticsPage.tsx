import { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatNumber, formatCurrency, formatPercentage } from '../lib/utils';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import { TrendingUp, Coins, Zap, Target, Download } from 'lucide-react';
import { Button } from '../components/ui';
import { useChartTheme } from '../hooks';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

interface UsageData {
  date: string;
  count: number;
  savings: number;
  tokens: number;
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [usage, setUsage] = useState<UsageData[]>([]);
  const [period, setPeriod] = useState('30');
  const [loading, setLoading] = useState(true);
  const chartTheme = useChartTheme();

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const handleExport = () => {
    const csvHeader = 'date,compressions,avgRatio,avgAccuracy,tokensSaved,costSaved\n';
    const csvBody = trends
      .map((t) => `${t.date},${t.compressions},${t.avgRatio},${t.avgAccuracy},${t.tokensSaved},${t.costSaved}`)
      .join('\n');
    const csv = csvHeader + csvBody;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${period}d-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Analytics exported');
  };

  const loadAnalytics = async () => {
    try {
      const [overviewRes, trendsRes, docTypesRes, usageRes] = await Promise.all([
        api.get('/analytics/overview'),
        api.get(`/analytics/trends?period=${period}`),
        api.get('/analytics/document-types'),
        api.get('/analytics/usage'),
      ]);

      setOverview(overviewRes.data.data);
      setTrends(trendsRes.data.data);
      setDocTypes(docTypesRes.data.data);
      setUsage(usageRes.data.data.daily);
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-[hsl(var(--muted-foreground))] text-sm mt-1">
            Detailed insights into your compression performance
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['7', '30', '90'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                period === p
                  ? 'bg-[hsl(var(--primary))] text-white'
                  : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              {p}d
            </button>
          ))}
          <Button variant="outline" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />} onClick={handleExport}>
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Avg Compression</span>
            </div>
            <p className="text-xl font-bold">{formatPercentage(overview.avgCompression)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Avg Accuracy</span>
            </div>
            <p className="text-xl font-bold">{formatPercentage(overview.avgAccuracy)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Tokens Saved</span>
            </div>
            <p className="text-xl font-bold">{formatNumber(overview.totalTokensSaved)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Money Saved</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(overview.totalMoneySaved)}</p>
          </motion.div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compression Ratio Trend */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4">Compression & Accuracy Trends</h3>
          <div className="h-64">
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                  <XAxis dataKey="date" stroke={chartTheme.axisStroke} fontSize={11} tickFormatter={(v) => v.slice(5)} />
                  <YAxis stroke={chartTheme.axisStroke} fontSize={11} />
                  <Tooltip contentStyle={{ background: chartTheme.tooltip.background, border: chartTheme.tooltip.border, borderRadius: '8px' }} labelStyle={{ color: chartTheme.tooltip.color }} />
                  <Legend />
                  <Line type="monotone" dataKey="avgRatio" name="Compression %" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="avgAccuracy" name="Accuracy %" stroke="#06b6d4" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[hsl(var(--muted-foreground))] text-sm">No data available</div>
            )}
          </div>
        </motion.div>

        {/* Token Savings */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4">Token Savings</h3>
          <div className="h-64">
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                  <XAxis dataKey="date" stroke={chartTheme.axisStroke} fontSize={11} tickFormatter={(v) => v.slice(5)} />
                  <YAxis stroke={chartTheme.axisStroke} fontSize={11} />
                  <Tooltip contentStyle={{ background: chartTheme.tooltip.background, border: chartTheme.tooltip.border, borderRadius: '8px' }} labelStyle={{ color: chartTheme.tooltip.color }} />
                  <Area type="monotone" dataKey="tokensSaved" name="Tokens Saved" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[hsl(var(--muted-foreground))] text-sm">No data available</div>
            )}
          </div>
        </motion.div>

        {/* Daily Usage */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4">Daily Usage (Last 7 Days)</h3>
          <div className="h-64">
            {usage.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usage}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                  <XAxis dataKey="date" stroke={chartTheme.axisStroke} fontSize={11} tickFormatter={(v) => v.slice(5)} />
                  <YAxis stroke={chartTheme.axisStroke} fontSize={11} />
                  <Tooltip contentStyle={{ background: chartTheme.tooltip.background, border: chartTheme.tooltip.border, borderRadius: '8px' }} labelStyle={{ color: chartTheme.tooltip.color }} />
                  <Bar dataKey="count" name="Compressions" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[hsl(var(--muted-foreground))] text-sm">No data available</div>
            )}
          </div>
        </motion.div>

        {/* Document Types */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4">Document Types Distribution</h3>
          <div className="h-64">
            {docTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={docTypes}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="count"
                    nameKey="type"
                    label={({ name, payload }: any) => `${payload.type || name} (${payload.percentage || 0}%)`}
                  >
                    {docTypes.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: chartTheme.tooltip.background, border: chartTheme.tooltip.border, borderRadius: '8px' }} labelStyle={{ color: chartTheme.tooltip.color }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[hsl(var(--muted-foreground))] text-sm">No data available</div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
