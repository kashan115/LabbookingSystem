import { useState, useEffect, useCallback } from 'react';
import { agentApi, AgentStatus, AgentLogEntry } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  action: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const TASK_LABELS: Record<string, string> = {
  booking_expiry_check: '⏰ Expiry Check',
  booking_reminder: '📧 Reminder Sent',
  booking_completed: '✅ Auto-Complete',
  server_status_sync: '🔄 Status Sync',
  weekly_summary: '📊 Weekly Summary',
  utilization_analysis: '📈 Analysis',
  agent_cycle: '🤖 Agent Cycle',
};

export function AgentDashboard({ isAdmin }: { isAdmin: boolean }) {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filterTask, setFilterTask] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        agentApi.status(),
        agentApi.logs(50, filterTask || undefined),
      ]);
      setStatus(s);
      setLogs(l);
    } catch (err) {
      console.error('Failed to load agent data:', err);
    } finally {
      setLoading(false);
    }
  }, [filterTask]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(loadData, 30000);
    return () => clearInterval(id);
  }, [loadData]);

  const handleRunCycle = async () => {
    setRunning(true);
    try {
      const result = await agentApi.runCycle();
      toast.success(`Agent cycle complete: ${result.reminders.reminded} reminders, ${result.completions.completed} completions, ${result.statusSync.fixed} fixes (${result.duration}ms)`);
      await loadData();
    } catch (err) {
      toast.error(`Agent cycle failed: ${(err as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  const handleWeeklySummary = async () => {
    try {
      const result = await agentApi.weeklySummary();
      toast.success(result.message);
      await loadData();
    } catch (err) {
      toast.error(`Weekly summary failed: ${(err as Error).message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mr-3" />
        Loading Agent Dashboard…
      </div>
    );
  }

  if (!status) return <div className="text-center py-20 text-muted-foreground">Failed to load agent status.</div>;

  const snap = status.systemSnapshot;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            🤖 LabOps Sentinel Agent
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered monitoring • Auto-complete expired bookings • Smart reminders • Utilization analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status.enabled ? 'default' : 'secondary'} className="text-xs">
            {status.enabled ? '● Active' : '○ Disabled'}
          </Badge>
          <Badge variant={status.llmConfigured ? 'default' : 'outline'} className="text-xs">
            {status.llmConfigured ? '🧠 AI Mode' : '📋 Rule-Based'}
          </Badge>
          <Badge variant={status.emailConfigured ? 'default' : 'outline'} className="text-xs">
            {status.emailConfigured ? '📧 Email On' : '📧 Email Off'}
          </Badge>
        </div>
      </div>

      {/* System Snapshot Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard label="Total Servers" value={snap.totalServers} color="text-foreground" />
        <StatCard label="Available" value={snap.available} color="text-green-600 dark:text-green-400" />
        <StatCard label="Booked" value={snap.booked} color="text-blue-600 dark:text-blue-400" />
        <StatCard label="Maintenance" value={snap.maintenance} color="text-yellow-600 dark:text-yellow-400" />
        <StatCard label="Offline" value={snap.offline} color="text-red-600 dark:text-red-400" />
        <StatCard label="Active Bookings" value={snap.activeBookings} color="text-foreground" />
        <StatCard label="Expiring ≤3d" value={snap.expiringIn3Days} color={snap.expiringIn3Days > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'} />
        <StatCard label="Utilization" value={`${snap.utilizationRate}%`} color={snap.utilizationRate > 80 ? 'text-red-600' : snap.utilizationRate > 50 ? 'text-yellow-600' : 'text-green-600'} />
      </div>

      {/* Overdue Alert */}
      {snap.overdueBookings > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">{snap.overdueBookings} Overdue Booking{snap.overdueBookings !== 1 ? 's' : ''}</p>
            <p className="text-sm text-red-600 dark:text-red-400">These bookings have passed their end date. Run an agent cycle to auto-complete them.</p>
          </div>
        </div>
      )}

      {/* AI Insight Panel */}
      {status.lastCycle?.aiInsight && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-5">
          <h3 className="font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-2 mb-3">
            🧠 Latest AI Analysis
          </h3>
          <div className="text-sm text-indigo-800 dark:text-indigo-200 whitespace-pre-line leading-relaxed">
            {status.lastCycle.aiInsight}
          </div>
          <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-3">
            Last cycle: {new Date(status.lastCycle.timestamp).toLocaleString()}
          </p>
        </div>
      )}

      {/* Activity + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 24h Activity */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="font-semibold text-foreground mb-3">📊 Last 24 Hours</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Actions taken</span>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">{status.activity24h.actions}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Warnings raised</span>
              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">{status.activity24h.warnings}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Errors</span>
              <Badge className={status.activity24h.errors > 0 ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-muted text-muted-foreground'}>{status.activity24h.errors}</Badge>
            </div>
          </div>
        </div>

        {/* Agent Schedule */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="font-semibold text-foreground mb-3">🕐 Schedule</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-lg">🔄</span>
              <div>
                <p className="font-medium text-foreground">Monitoring Cycle</p>
                <p className="text-muted-foreground">Every 4 hours</p>
                <p className="text-xs text-muted-foreground">Checks expiring bookings, auto-completes, syncs statuses</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-lg">📊</span>
              <div>
                <p className="font-medium text-foreground">AI Weekly Summary</p>
                <p className="text-muted-foreground">Mondays at 09:00 UTC</p>
                <p className="text-xs text-muted-foreground">Utilization analysis sent to admins</p>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Controls */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="font-semibold text-foreground mb-3">⚡ Agent Controls</h3>
          {isAdmin ? (
            <div className="space-y-3">
              <Button onClick={handleRunCycle} disabled={running} className="w-full" variant="default">
                {running ? (
                  <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />Running…</>
                ) : '🤖 Run Agent Cycle Now'}
              </Button>
              <Button onClick={handleWeeklySummary} className="w-full" variant="outline">
                📊 Generate Weekly Summary
              </Button>
              <Button onClick={loadData} className="w-full" variant="ghost">
                🔄 Refresh Dashboard
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Admin access required to trigger agent actions.</p>
          )}
        </div>
      </div>

      {/* Agent Logs */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">📋 Agent Activity Log</h3>
          <div className="flex items-center gap-2">
            <select
              value={filterTask}
              onChange={e => setFilterTask(e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground"
            >
              <option value="">All Tasks</option>
              <option value="agent_cycle">Agent Cycles</option>
              <option value="booking_reminder">Reminders</option>
              <option value="booking_completed">Auto-Complete</option>
              <option value="server_status_sync">Status Sync</option>
              <option value="utilization_analysis">Analysis</option>
              <option value="weekly_summary">Weekly Summary</option>
            </select>
          </div>
        </div>
        <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <span className="text-3xl block mb-2">🤖</span>
              No agent activity yet. Run an agent cycle to get started.
            </div>
          ) : logs.map(log => (
            <div key={log.id} className="p-3 hover:bg-accent/50 transition-colors">
              <div className="flex items-start gap-3">
                <span className="text-sm mt-0.5">{TASK_LABELS[log.taskType]?.split(' ')[0] || '🔹'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{log.title}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 ${SEVERITY_COLORS[log.severity] || ''}`}>
                      {log.severity}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {TASK_LABELS[log.taskType]?.split(' ').slice(1).join(' ') || log.taskType}
                    </span>
                  </div>
                  {log.detail && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{log.detail}</p>
                  )}
                  {log.aiInsight && (
                    <div className="mt-1.5 text-xs bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 rounded px-2 py-1.5 line-clamp-3">
                      🧠 {log.aiInsight}
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
