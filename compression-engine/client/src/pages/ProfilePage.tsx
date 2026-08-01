import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { User, Mail, Calendar, Lock, Save, Eye, EyeOff, TrendingUp, Coins, Zap, FileText } from 'lucide-react';
import { useAuthStore } from '../store';
import { AuthService, AnalyticsService } from '../services';
import { PageHeader, StatCard } from '../components/shared';
import { Card, Button, Input } from '../components/ui';
import { formatNumber, formatCurrency, formatDate } from '../lib/utils';
import type { OverviewAnalytics } from '../types';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [overview, setOverview] = useState<OverviewAnalytics | null>(null);

  useEffect(() => {
    AnalyticsService.getOverview()
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const updated = await AuthService.updateProfile({ name });
      setUser({ ...user!, name: updated.name });
      toast.success('Profile updated');
    } catch (error) {
      toast.error((error as any).response?.data?.error?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setChangingPassword(true);
    try {
      await AuthService.changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error((error as any).response?.data?.error?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Profile" description="Manage your account and view your usage" />

      {/* Profile card with avatar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-20 h-20 rounded-full gradient-button flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">{user?.name}</h2>
            <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] mt-1">
              <Mail className="w-3.5 h-3.5" />
              <span className="truncate">{user?.email}</span>
            </div>
            {user?.createdAt && (
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] mt-1">
                <Calendar className="w-3 h-3" />
                <span>Member since {formatDate(user.createdAt)}</span>
              </div>
            )}
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1">
            <span className="px-2 py-0.5 text-xs rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-medium capitalize">
              {user?.role || 'user'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Usage stats */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Prompts"
            value={formatNumber(overview.totalPrompts)}
            icon={FileText}
            iconColor="text-violet-400"
          />
          <StatCard
            label="Tokens Saved"
            value={formatNumber(overview.totalTokensSaved)}
            icon={Zap}
            iconColor="text-cyan-400"
            delay={0.1}
          />
          <StatCard
            label="Money Saved"
            value={formatCurrency(overview.totalMoneySaved)}
            icon={Coins}
            iconColor="text-emerald-400"
            delay={0.2}
          />
          <StatCard
            label="Avg Accuracy"
            value={`${(overview.avgAccuracy * 100).toFixed(1)}%`}
            icon={TrendingUp}
            iconColor="text-amber-400"
            delay={0.3}
          />
        </div>
      )}

      {/* Edit profile */}
      <Card padding="lg">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-[hsl(var(--primary))]" />
          <h3 className="text-sm font-semibold">Edit Profile</h3>
        </div>
        <div className="space-y-3">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
          />
          <Input
            label="Email"
            value={user?.email || ''}
            disabled
            leftIcon={<Mail className="w-4 h-4" />}
            className="opacity-50"
          />
          <Button variant="gradient" onClick={handleSaveProfile} loading={saving} leftIcon={<Save className="w-3.5 h-3.5" />}>
            Save Changes
          </Button>
        </div>
      </Card>

      {/* Change password */}
      <Card padding="lg">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-[hsl(var(--primary))]" />
          <h3 className="text-sm font-semibold">Change Password</h3>
        </div>
        <div className="space-y-3">
          <Input
            label="Current password"
            type={showPassword ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            rightIcon={
              <button type="button" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
          <Input
            label="New password"
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
          />
          <Input
            label="Confirm new password"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
          />
          <Button
            variant="gradient"
            onClick={handleChangePassword}
            loading={changingPassword}
            leftIcon={<Save className="w-3.5 h-3.5" />}
          >
            Update Password
          </Button>
        </div>
      </Card>
    </div>
  );
}
