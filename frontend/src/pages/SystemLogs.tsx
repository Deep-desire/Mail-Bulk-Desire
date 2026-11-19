import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle2, Info, Pause, Play, RefreshCw, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadApi } from '../api/upload.api';
import { CampaignLog, CampaignHealth, Upload } from '../types';

const LEVELS = ['all', 'info', 'warn', 'error'] as const;
type Level = (typeof LEVELS)[number];

const levelStyle: Record<string, { cls: string; Icon: typeof Info }> = {
  info: { cls: 'text-sky-300 bg-sky-500/10 border-sky-500/20', Icon: Info },
  warn: { cls: 'text-amber-300 bg-amber-500/10 border-amber-500/20', Icon: AlertTriangle },
  error: { cls: 'text-red-300 bg-red-500/10 border-red-500/20', Icon: XCircle },
};

function ago(iso: string | null) {
  if (!iso) return 'never';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${(s / 3600).toFixed(1)} h ago`;
}

export default function SystemLogs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const uploadId = searchParams.get('uploadId') || '';
  const [level, setLevel] = useState<Level>('all');
  const [logs, setLogs] = useState<CampaignLog[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [health, setHealth] = useState<CampaignHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const uploadName = useMemo(() => {
    const map: Record<string, string> = {};
    uploads.forEach((u) => (map[u.id] = u.originalName));
    return map;
  }, [uploads]);

  useEffect(() => {
    uploadApi.getAll().then((r) => setUploads(r.data)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, h] = await Promise.all([
        uploadApi.getCampaignLogs({ uploadId: uploadId || undefined, level, limit: 300 }),
        uploadId ? uploadApi.getHealth(uploadId) : Promise.resolve(null),
      ]);
      setLogs(l.data.logs);
      setHealth(h ? h.data : null);
    } catch {
      // keep last data on transient errors
    } finally {
      setLoading(false);
    }
  }, [uploadId, level]);

  useEffect(() => {
    load();
    if (!live) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load, live]);

  const [resuming, setResuming] = useState(false);
  const resume = async () => {
    if (!uploadId || resuming) return;
    if (!window.confirm('Resume sending the remaining pending emails?')) return;
    setResuming(true);
    try {
      const r = await uploadApi.resumeSend(uploadId);
      toast.success(r.data.message);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Resume failed');
    } finally {
      setTimeout(() => setResuming(false), 120000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2"><Activity className="w-6 h-6" /> Activity Logs</h1>
          <p className="text-gray-500 mt-1">What the sender is doing right now, and where it stopped.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setLive((v) => !v)} className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
            {live ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {live ? 'Live (10s)' : 'Paused'}
          </button>
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
        <select
          value={uploadId}
          onChange={(e) => setSearchParams(e.target.value ? { uploadId: e.target.value } : {})}
          className="input-field text-sm py-2 lg:max-w-md"
        >
          <option value="">All campaigns</option>
          {uploads.map((u) => (
            <option key={u.id} value={u.id}>
              {u.originalName} ({u.status})
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider border transition-all ${
                level === l ? 'bg-brand-600/20 text-brand-400 border-brand-500/30' : 'text-gray-400 border-white/10 hover:text-white'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {health && (
        <div
          className={`rounded-2xl border p-5 space-y-3 ${
            health.stalled ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/5 border-emerald-500/20'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold text-white">
              {health.stalled ? <AlertTriangle className="w-5 h-5 text-red-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {health.stalled ? 'Campaign looks stuck' : health.status === 'processing' ? 'Campaign is moving' : `Campaign ${health.status}`}
            </div>
            <div className="flex gap-2">
              <Link to={`/uploads/${uploadId}`} className="btn-secondary text-sm py-2 px-4">Open campaign</Link>
              {health.pending > 0 && (
                <button onClick={resume} disabled={resuming} className="btn-primary text-sm py-2 px-4 flex items-center gap-2">
                  <Play className="w-4 h-4" /> Resume sending ({health.pending})
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><div className="text-gray-500 text-xs">Mode</div><div className="text-gray-200">{health.mode}</div></div>
            <div><div className="text-gray-500 text-xs">Pending</div><div className="text-gray-200">{health.pending}</div></div>
            <div><div className="text-gray-500 text-xs">Last activity</div><div className="text-gray-200">{ago(health.lastActivityAt)}</div></div>
            <div>
              <div className="text-gray-500 text-xs">Azure orchestration</div>
              <div className="text-gray-200">{health.durable?.runtimeStatus || health.durable?.error || 'n/a'}</div>
            </div>
          </div>
          {health.reasons.length > 0 && (
            <ul className="text-sm text-red-300 list-disc pl-5">
              {health.reasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
          )}
          {health.lastError && (
            <p className="text-xs text-red-300/80 break-all">
              Last error ({ago(health.lastError.createdAt)}): {health.lastError.message}
            </p>
          )}
          {health.durable?.output != null && health.durable.runtimeStatus === 'Failed' && (
            <pre className="text-xs text-red-300/80 whitespace-pre-wrap break-all">{String(health.durable.output)}</pre>
          )}
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3 whitespace-nowrap">Time</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Event</th>
                {!uploadId && <th className="px-4 py-3">Campaign</th>}
                <th className="px-4 py-3">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                    {loading ? 'Loading…' : 'No log entries yet. New activity appears here once the updated backend is deployed.'}
                  </td>
                </tr>
              )}
              {logs.map((log) => {
                const st = levelStyle[log.level] || levelStyle.info;
                return (
                  <tr
                    key={log.id}
                    className={`align-top ${log.meta ? 'cursor-pointer hover:bg-white/[0.02]' : ''}`}
                    onClick={() => log.meta && setExpanded(expanded === log.id ? null : log.id)}
                  >
                    <td className="px-4 py-2 whitespace-nowrap text-gray-400 text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] uppercase ${st.cls}`}>
                        <st.Icon className="w-3 h-3" /> {log.level}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-400 whitespace-nowrap">{log.event}</td>
                    {!uploadId && (
                      <td className="px-4 py-2 text-xs">
                        {log.uploadId ? (
                          <button
                            className="text-brand-400 hover:underline text-left"
                            onClick={(e) => { e.stopPropagation(); setSearchParams({ uploadId: log.uploadId! }); }}
                          >
                            {uploadName[log.uploadId] || log.uploadId.slice(0, 8)}
                          </button>
                        ) : '—'}
                      </td>
                    )}
                    <td className="px-4 py-2 break-all">
                      {log.message}
                      {expanded === log.id && log.meta && (
                        <pre className="mt-2 text-xs text-gray-400 whitespace-pre-wrap">{JSON.stringify(log.meta, null, 2)}</pre>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
