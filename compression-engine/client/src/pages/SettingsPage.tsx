import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Save, Plus, Trash2, Key, User as UserIcon, Palette, Bell, Zap } from 'lucide-react';
import { SettingsService, AuthService } from '../services';
import api from '../lib/api';
import { useAuthStore, useUiStore } from '../store';
import { LLM_PROVIDERS } from '../lib/providers';
import { PageHeader } from '../components/shared';
import { Card, Button, Input, Select, Switch, Badge, ConfirmDialog } from '../components/ui';
import type { ApiKeyRecord } from '../types';

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const currentTheme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const [settings, setSettings] = useState({
    // Initialize theme from the currently applied UI store value so the
    // dropdown always reflects what's visible on screen.
    theme: currentTheme,
    language: 'en',
    preferredLlm: 'openai',
    defaultCompression: 'medium',
  });
  const [notifications, setNotifications] = useState({
    email: true,
    compressionComplete: true,
    weeklyReport: false,
    productUpdates: true,
  });
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [newKey, setNewKey] = useState({ provider: 'openai', key: '', label: '' });
  const [profileName, setProfileName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [showAddKey, setShowAddKey] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKeyRecord | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await SettingsService.get();
      // Prefer the UI store's current theme (what's actually applied), but
      // fall back to the DB value if the store hasn't loaded yet.
      setSettings({
        theme: (currentTheme || data.theme || 'dark') as 'dark' | 'light',
        language: data.language || 'en',
        preferredLlm: data.preferredLlm || 'openai',
        defaultCompression: data.defaultCompression || 'medium',
      });
      setApiKeys(data.apiKeys || []);
    } catch {
      // Use defaults
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      // Persist to DB so preferences survive across devices
      await SettingsService.update(settings);
      // Apply the theme locally so it takes effect immediately.
      // useTheme() will pick this up and swap the CSS class on <html>.
      if (settings.theme === 'dark' || settings.theme === 'light') {
        setTheme(settings.theme);
      }
      toast.success('Preferences saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    try {
      const updated = await AuthService.updateProfile({ name: profileName });
      setUser({ ...user!, name: updated.name });
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    }
  };

  const handleAddApiKey = async () => {
    if (!newKey.key) {
      toast.error('API key is required');
      return;
    }
    try {
      const created = await SettingsService.addApiKey(newKey);
      setApiKeys([...apiKeys, created]);
      setNewKey({ provider: 'openai', key: '', label: '' });
      setShowAddKey(false);
      toast.success('API key added');
    } catch (error) {
      toast.error((error as any).response?.data?.error?.message || 'Failed to add key');
    }
  };

  const handleDeleteKey = async () => {
    if (!keyToDelete) return;
    try {
      await SettingsService.deleteApiKey(keyToDelete.id);
      setApiKeys(apiKeys.filter((k) => k.id !== keyToDelete.id));
      setKeyToDelete(null);
      toast.success('API key deleted');
    } catch {
      toast.error('Failed to delete key');
    }
  };

  const handleToggleKey = async (id: string) => {
    try {
      const updated = await SettingsService.toggleApiKey(id);
      setApiKeys(apiKeys.map((k) => (k.id === id ? { ...k, isActive: updated.isActive } : k)));
    } catch {
      toast.error('Failed to toggle key');
    }
  };

  const handleTestKey = async (key: ApiKeyRecord) => {
    setTestingKey(key.id);
    try {
      const { data } = await api.post('/llm/test', { provider: key.provider });
      if (data.success && !data.data.simulated) {
        toast.success(`${key.provider} works! Latency: ${data.data.latencyMs}ms`);
      } else if (data.data.simulated) {
        toast(`${key.provider}: simulated (integration pending)`, { icon: '⚠️' });
      } else {
        toast.error(`${key.provider} failed: ${data.data.error || 'unknown error'}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Test failed');
    } finally {
      setTestingKey(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Settings" description="Configure your preferences and API keys" />

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <UserIcon className="w-4 h-4 text-[hsl(var(--primary))]" />
            <h3 className="text-sm font-semibold">Profile</h3>
          </div>
          <div className="space-y-3">
            <Input
              label="Name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              value={user?.email || ''}
              disabled
              className="opacity-50"
            />
            <Button variant="gradient" size="sm" onClick={handleSaveProfile} leftIcon={<Save className="w-3.5 h-3.5" />}>
              Save Profile
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Preferences */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-4 h-4 text-[hsl(var(--primary))]" />
            <h3 className="text-sm font-semibold">Preferences</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Theme"
              value={settings.theme}
              onChange={(e) => {
                const value = e.target.value as 'dark' | 'light';
                setSettings({ ...settings, theme: value });
                // Apply immediately so users see the change before hitting Save
                setTheme(value);
              }}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
            />
            <Select
              label="Language"
              value={settings.language}
              onChange={(e) => setSettings({ ...settings, language: e.target.value })}
              options={[
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Spanish' },
                { value: 'fr', label: 'French' },
                { value: 'de', label: 'German' },
                { value: 'ja', label: 'Japanese' },
                { value: 'hi', label: 'Hindi' },
              ]}
            />
            <Select
              label="Preferred LLM"
              value={settings.preferredLlm}
              onChange={(e) => setSettings({ ...settings, preferredLlm: e.target.value })}
              options={LLM_PROVIDERS.map((p) => ({ value: p.id, label: p.name }))}
            />
            <Select
              label="Default Compression"
              value={settings.defaultCompression}
              onChange={(e) => setSettings({ ...settings, defaultCompression: e.target.value })}
              options={[
                { value: 'low', label: 'Low (~30%)' },
                { value: 'medium', label: 'Medium (~50%)' },
                { value: 'high', label: 'High (~70%)' },
                { value: 'extreme', label: 'Extreme (~85%)' },
              ]}
            />
          </div>
          <Button
            variant="gradient"
            size="sm"
            className="mt-4"
            onClick={handleSaveSettings}
            loading={saving}
            leftIcon={<Save className="w-3.5 h-3.5" />}
          >
            Save Preferences
          </Button>
        </Card>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-[hsl(var(--primary))]" />
            <h3 className="text-sm font-semibold">Notifications</h3>
          </div>
          <div className="space-y-3">
            <Switch
              checked={notifications.email}
              onChange={(v) => setNotifications({ ...notifications, email: v })}
              label="Email notifications"
              description="Receive important updates via email"
            />
            <Switch
              checked={notifications.compressionComplete}
              onChange={(v) => setNotifications({ ...notifications, compressionComplete: v })}
              label="Compression complete"
              description="Get notified when large compressions finish"
            />
            <Switch
              checked={notifications.weeklyReport}
              onChange={(v) => setNotifications({ ...notifications, weeklyReport: v })}
              label="Weekly usage report"
              description="A summary of your compression activity"
            />
            <Switch
              checked={notifications.productUpdates}
              onChange={(v) => setNotifications({ ...notifications, productUpdates: v })}
              label="Product updates"
              description="New features and improvements"
            />
          </div>
        </Card>
      </motion.div>

      {/* API Keys */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-[hsl(var(--primary))]" />
              <h3 className="text-sm font-semibold">API Keys</h3>
            </div>
            <Button variant="ghost" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowAddKey(!showAddKey)}>
              Add Key
            </Button>
          </div>

          {showAddKey && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4 p-4 bg-[hsl(var(--secondary))] rounded-xl overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <Select
                  value={newKey.provider}
                  onChange={(e) => setNewKey({ ...newKey, provider: e.target.value })}
                  options={LLM_PROVIDERS.map((p) => ({ value: p.id, label: p.name }))}
                />
                <Input
                  type="password"
                  value={newKey.key}
                  onChange={(e) => setNewKey({ ...newKey, key: e.target.value })}
                  placeholder="API Key"
                />
                <Input
                  value={newKey.label}
                  onChange={(e) => setNewKey({ ...newKey, label: e.target.value })}
                  placeholder="Label (optional)"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="gradient" size="sm" onClick={handleAddApiKey}>
                  Add API Key
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAddKey(false)}>
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}

          {apiKeys.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
              No API keys configured
            </p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-3 bg-[hsl(var(--secondary))]/50 rounded-xl gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${key.isActive ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize truncate">{key.provider}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{key.label || 'No label'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleTestKey(key)}
                      disabled={testingKey === key.id}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--primary))]/10 hover:text-[hsl(var(--primary))] transition-colors disabled:opacity-50"
                      title="Test connection to provider"
                    >
                      <Zap className="w-3 h-3" />
                      {testingKey === key.id ? 'Testing…' : 'Test'}
                    </button>
                    <button
                      onClick={() => handleToggleKey(key.id)}
                      className="focus:outline-none"
                    >
                      <Badge variant={key.isActive ? 'success' : 'default'}>
                        {key.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </button>
                    <button
                      onClick={() => setKeyToDelete(key)}
                      className="p-1 hover:bg-red-500/10 text-[hsl(var(--muted-foreground))] hover:text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      <ConfirmDialog
        open={!!keyToDelete}
        onClose={() => setKeyToDelete(null)}
        onConfirm={handleDeleteKey}
        title="Delete API key?"
        description={`This will remove your ${keyToDelete?.provider} API key. You can add it again later.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
