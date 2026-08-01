import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3, Coins, Gauge, Zap, Clock, FileText,
  TrendingUp, Minimize2, ArrowRight, Sparkles, Activity, History,
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { AnalyticsService, CompressionService } from '../services';
import { formatNumber, formatCurrency, formatPercentage, formatDateTime, truncate } from '../lib/utils';
import { PageHeader, StatCard, ChartCard } from '../components/shared';
import { Button, CenteredSpinner, EmptyState } from '../components/ui';
import { useChartTheme } from '../hooks';
import type { OverviewAnalytics, TrendData, DocTypeData, CompressionRecord } from '../types';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

export default function DashboardPage() {
  const [overview, setOverview] = useState<OverviewAnalytics | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [docTypes, setDocTypes] = useState<DocTypeData[]>([]);
  const [recent, setRecent] = useState<CompressionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const chartTheme = useChartTheme();

  useEffect(() => {
    (async () => {
      try {
        const [ovr, trd, dt, hist] = await Promise.all([
          AnalyticsService.getOverview().catch(() => null),
          AnalyticsService.getTrends('30').catch(() => []),
          AnalyticsService.getDocumentTypes().catch(() => []),
          CompressionService.getHistory({ page: 1, limit: 5 }).catch(() => ({ compressions: [] as CompressionRecord[], pagination: { page: 1, limit: 5, total: 0, pages: 0 } })),
        ]);
        setOverview(ovr || {
          totalPrompts: 0, totalTokensSaved: 0, avgCompression: 0,
          avgAccuracy: 0, totalMoneySaved: 0, avgLatencyReduction: 0,
        });
        setTrends(trd);
        setDocTypes(dt);
        setRecent(hist.compressions);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const statCards = overview ? [
    { label: 'Total Prompts', value: formatNumber(overview.totalPrompts), icon: FileText, color: 'text-violet-400' },
    { label: 'Tokens Saved', value: formatNumber(overview.totalTokensSaved), icon: Zap, color: 'text-cyan-400' },
    { label: 'Avg Compression', value: formatPercentage(overview.avgCompression), icon: Gauge, color: 'text-emerald-400' },
    { label: 'Avg Accuracy', value: formatPercentage(overview.avgAccuracy), icon: TrendingUp, color: 'text-amber-400' },
    { label: 'Money Saved', value: formatCurrency(overview.totalMoneySaved), icon: Coins, color: 'text-green-400' },
    { label: 'Latency Reduced', value: `${overview.avgLatencyReduction.toFixed(0)}%`, icon: Clock, color: 'text-pink-400' },
  ] : [];

  if (loading) return <CenteredSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your compression activity"
        actions={
          <Link to="/compress">
            <Button variant="gradient" leftIcon={<Minimize2 className="w-4 h-4" />}>
              New Compression
            </Button>
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, index) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            iconColor={stat.color}
            delay={index * 0.05}
          />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          title="Compression Trends"
          description="Last 30 days"
          className="lg:col-span-2"
          delay={0.3}
        >
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                <XAxis dataKey="date" stroke={chartTheme.axisStroke} fontSize={11} tickFormatter={(v) => v.slice(5)} />
                <YAxis stroke={chartTheme.axisStroke} fontSize={11} />
                <Tooltip
                  contentStyle={{ background: chartTheme.tooltip.background, border: chartTheme.tooltip.border, borderRadius: '8px' }}
                  labelStyle={{ color: chartTheme.tooltip.color }}
                />
                <Area type="monotone" dataKey="avgRatio" name="Compression %" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} />
                <Area type="monotone" dataKey="avgAccuracy" name="Accuracy %" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-[hsl(var(--muted-foreground))] text-sm">
              No data yet. Start compressing to see trends.
            </div>
          )}
        </ChartCard>

        <ChartCard title="Document Types" description="Distribution" delay={0.4}>
          {docTypes.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={docTypes}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  dataKey="count"
                  nameKey="type"
                  label={({ payload }: any) => `${payload.type} ${payload.percentage}%`}
                  labelLine={false}
                >
                  {docTypes.map((_e, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: chartTheme.tooltip.background, border: chartTheme.tooltip.border, borderRadius: '8px' }}
                  labelStyle={{ color: chartTheme.tooltip.color }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-[hsl(var(--muted-foreground))] text-sm">
              No documents processed yet
            </div>
          )}
        </ChartCard>
      </div>

      {/* Two column grid: Recent Activity + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2 glass-card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[hsl(var(--primary))]" />
              <h3 className="text-sm font-semibold">Recent Activity</h3>
            </div>
            <Link to="/history" className="text-xs text-[hsl(var(--primary))] hover:underline">
              View all →
            </Link>
          </div>

          {recent.length === 0 ? (
            <EmptyState
              icon={History}
              title="No compressions yet"
              description="Start compressing to see your activity here"
            />
          ) : (
            <div className="space-y-2">
              {recent.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-[hsl(var(--secondary))]/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] text-[10px] rounded-full font-medium capitalize">
                        {r.documentType}
                      </span>
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {formatDateTime(r.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                      {truncate(r.originalText, 80)}
                    </p>
                  </div>
                  <div className="ml-3 text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-emerald-400">
                      {formatPercentage(r.compressionRatio)}
                    </p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {formatCurrency(r.costSavings)} saved
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-[hsl(var(--primary))]" />
            <h3 className="text-sm font-semibold">Quick Actions</h3>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Compress Prompt', path: '/compress', icon: Minimize2, desc: 'Optimize a new prompt' },
              { label: 'Analyze Text', path: '/analysis', icon: FileText, desc: 'Deep-dive analysis' },
              { label: 'API Playground', path: '/playground', icon: Zap, desc: 'Test providers' },
              { label: 'View Analytics', path: '/analytics', icon: BarChart3, desc: 'See detailed metrics' },
            ].map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--secondary))]/50 hover:bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/30 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center text-[hsl(var(--primary))] flex-shrink-0">
                  <action.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{action.label}</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{action.desc}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--primary))] transition-colors" />
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
