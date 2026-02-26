import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useGrainVoice } from '../contexts/GrainVoiceContext';

export default function Neural() {
  const api = useApi();
  const { pushWhisper } = useGrainVoice();

  // AI state
  const [aiStatus, setAiStatus] = useState<{
    hasAnthropicKey: boolean;
    hasWhisperKey: boolean;
    hasOpenaiKey: boolean;
    embeddingStats: { count: number; total: number };
    privacyLevel: string;
  } | null>(null);
  const [anthropicKey, setAnthropicKey] = useState('');
  const [whisperKey, setWhisperKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState('balanced');
  const [aiSaving, setAiSaving] = useState(false);
  const [aiMsg, setAiMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Embedding state
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildMsg, setRebuildMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Telegram state
  const [showTelegramGuide, setShowTelegramGuide] = useState(false);
  const [tgStatus, setTgStatus] = useState<{ running: boolean; botUsername?: string } | null>(null);
  const [tgConfig, setTgConfig] = useState<{ hasToken: boolean; allowedChatIds: number[] } | null>(null);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [tgSaving, setTgSaving] = useState(false);
  const [tgMsg, setTgMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Connector state
  const [connectors, setConnectors] = useState<{
    id: string; name: string; icon: string;
    status: { connected: boolean; lastSync: string | null; lastError: string | null; eventCount: number };
  }[]>([]);
  const [gcClientId, setGcClientId] = useState('');
  const [gcClientSecret, setGcClientSecret] = useState('');
  const [connectorMsg, setConnectorMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [connectorSyncing, setConnectorSyncing] = useState(false);

  // System state
  const [system, setSystem] = useState<{ apiServer: boolean; dbEvents: number; dbDateRange: { min: string; max: string } | null } | null>(null);

  // Privacy state
  const [privacyStats, setPrivacyStats] = useState<{
    retentionPeriod: string; totalEvents: number; sensitiveEvents: number;
    voiceFiles: number; dbSizeBytes: number;
  } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [privacyMsg, setPrivacyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [wipeConfirm, setWipeConfirm] = useState(false);
  const [wipeWhisperSent, setWipeWhisperSent] = useState(false);

  const loadAll = async () => {
    try {
      const [ai, tg, tgStat, sys, priv, conns] = await Promise.all([
        api.getAIConfig(),
        api.getTelegramConfig(),
        api.getTelegramStatus(),
        api.getSystemStatus(),
        api.getPrivacyStats(),
        api.connectorList(),
      ]);
      setAiStatus(ai);
      setPrivacyLevel(ai.privacyLevel || 'balanced');
      setTgConfig(tg);
      setTgStatus(tgStat);
      setSystem(sys);
      setPrivacyStats(priv);
      setConnectors(conns);
      if (tg?.allowedChatIds?.length) {
        setChatId(tg.allowedChatIds[0].toString());
      }
    } catch {
      // silently fail on mock
    }
  };

  useEffect(() => { loadAll(); }, []);

  const saveAI = async () => {
    setAiSaving(true);
    setAiMsg(null);
    try {
      const config: Record<string, string> = { privacyLevel };
      if (anthropicKey) config.anthropicApiKey = anthropicKey;
      if (whisperKey) config.whisperApiKey = whisperKey;
      if (openaiKey) config.openaiApiKey = openaiKey;
      await api.saveAIConfigSettings(config);
      setAnthropicKey('');
      setWhisperKey('');
      setOpenaiKey('');
      setAiMsg({ ok: true, text: 'Oracle engine configuration saved' });
      pushWhisper('Neural pathways reconfigured. The grain adapts.', 'ambient', 'watching', 'neural');
      // Refresh status
      const updated = await api.getAIConfig();
      setAiStatus(updated);
    } catch {
      setAiMsg({ ok: false, text: 'Failed to save' });
    } finally {
      setAiSaving(false);
    }
  };

  const handleRebuildEmbeddings = async () => {
    setRebuilding(true);
    setRebuildMsg(null);
    try {
      const result = await api.rebuildEmbeddings();
      setRebuildMsg({
        ok: result.errors === 0,
        text: `Indexed ${result.embedded}/${result.total} events${result.errors > 0 ? ` (${result.errors} errors)` : ''}`,
      });
      // Refresh AI status to update counts
      const updated = await api.getAIConfig();
      setAiStatus(updated);
    } catch {
      setRebuildMsg({ ok: false, text: 'Failed to rebuild memory index' });
    } finally {
      setRebuilding(false);
    }
  };

  const saveTelegram = async () => {
    if (!botToken.trim()) return;
    setTgSaving(true);
    setTgMsg(null);
    try {
      const ids = chatId.trim() ? [parseInt(chatId.trim(), 10)] : [];
      const result = await api.saveTelegramConfig({ botToken: botToken.trim(), allowedChatIds: ids });
      setBotToken('');
      setTgMsg({ ok: result.ok, text: result.message });
      // Refresh
      const [tg, stat] = await Promise.all([api.getTelegramConfig(), api.getTelegramStatus()]);
      setTgConfig(tg);
      setTgStatus(stat);
    } catch {
      setTgMsg({ ok: false, text: 'Failed to connect' });
    } finally {
      setTgSaving(false);
    }
  };

  const aiHasChanges = !!(anthropicKey || whisperKey || openaiKey || privacyLevel !== (aiStatus?.privacyLevel || 'balanced'));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-grain-load">
      <div>
        <h1 className="text-[11px] font-mono text-grain-cyan uppercase tracking-widest">Neural Configuration</h1>
        <p className="text-xs text-text-muted mt-0.5">Configure integrations and API keys</p>
      </div>

      {/* -- Oracle Engine -- */}
      <section className="grain-card rounded-xl border border-surface-3/50 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] uppercase font-mono tracking-widest text-grain-purple">Oracle Engine</h2>
          </div>
          <StatusBadge ok={aiStatus?.hasAnthropicKey ?? false} labelOn="Connected" labelOff="Not configured" />
        </div>

        <div className="space-y-3">
          <FieldGroup label="Anthropic API Key" hint={aiStatus?.hasAnthropicKey ? 'Key is set. Enter a new one to replace.' : 'Required for AI Chat and Digests'}>
            <input
              type="password"
              value={anthropicKey}
              onChange={e => setAnthropicKey(e.target.value)}
              placeholder={aiStatus?.hasAnthropicKey ? 'sk-ant-\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (saved)' : 'sk-ant-...'}
              className="input-field"
            />
          </FieldGroup>

          <FieldGroup label="OpenAI API Key" hint={aiStatus?.hasOpenaiKey ? 'Key is set. Used for embeddings and transcription.' : 'For semantic search embeddings + Whisper transcription'}>
            <input
              type="password"
              value={openaiKey}
              onChange={e => setOpenaiKey(e.target.value)}
              placeholder={aiStatus?.hasOpenaiKey ? 'sk-\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (saved)' : 'sk-...'}
              className="input-field"
            />
          </FieldGroup>

          <FieldGroup label="Privacy Level">
            <select
              value={privacyLevel}
              onChange={e => setPrivacyLevel(e.target.value)}
              className="input-field"
            >
              <option value="balanced">Balanced — Send context to AI</option>
              <option value="strict">Strict — Minimal data sent</option>
            </select>
          </FieldGroup>
        </div>

        {aiMsg && <Msg ok={aiMsg.ok} text={aiMsg.text} />}

        <button
          onClick={saveAI}
          disabled={aiSaving || !aiHasChanges}
          className="btn-primary"
        >
          {aiSaving ? 'Saving...' : 'Save Oracle Config'}
        </button>
      </section>

      {/* -- Memory Index -- */}
      <section className="grain-card rounded-xl border border-surface-3/50 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] uppercase font-mono tracking-widest text-grain-cyan">Memory Index</h2>
          </div>
          <StatusBadge
            ok={(aiStatus?.embeddingStats?.count ?? 0) > 0}
            labelOn={`${aiStatus?.embeddingStats?.count ?? 0} indexed`}
            labelOff="No embeddings"
          />
        </div>

        <p className="text-xs text-text-muted">
          Memory index uses AI embeddings to find memories by meaning, not just keywords.
          For example, searching "stressful day" will find entries about being overwhelmed even if they don't contain those exact words.
        </p>

        {aiStatus && (
          <div className="flex items-center gap-3 text-xs">
            <div className="bg-surface-0 rounded-lg px-3 py-2 flex-1">
              <span className="text-text-muted">Indexed: </span>
              <span className="text-text-primary font-mono font-medium">
                {aiStatus.embeddingStats.count} / {aiStatus.embeddingStats.total} events
              </span>
            </div>
            {aiStatus.embeddingStats.total > 0 && (
              <div className="bg-surface-0 rounded-lg px-3 py-2">
                <span className="text-text-muted">Coverage: </span>
                <span className="text-text-primary font-mono font-medium">
                  {aiStatus.embeddingStats.total > 0
                    ? Math.round((aiStatus.embeddingStats.count / aiStatus.embeddingStats.total) * 100)
                    : 0}%
                </span>
              </div>
            )}
          </div>
        )}

        {rebuildMsg && <Msg ok={rebuildMsg.ok} text={rebuildMsg.text} />}

        <button
          onClick={handleRebuildEmbeddings}
          disabled={rebuilding || !(aiStatus?.hasOpenaiKey)}
          className="btn-primary"
        >
          {rebuilding ? 'Rebuilding index...' : 'Rebuild Memory Index'}
        </button>

        {!aiStatus?.hasOpenaiKey && (
          <p className="text-xs text-grain-amber">
            Set an OpenAI API key above to enable memory indexing.
          </p>
        )}
      </section>

      {/* -- Telegram Relay -- */}
      <section className="grain-card rounded-xl border border-surface-3/50 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] uppercase font-mono tracking-widest text-grain-cyan">Telegram Relay</h2>
          </div>
          <StatusBadge
            ok={tgStatus?.running ?? false}
            labelOn={`Running${tgStatus?.botUsername ? ' @' + tgStatus.botUsername : ''}`}
            labelOff="Not connected"
          />
        </div>

        <div className="space-y-3">
          <FieldGroup label="Bot Token" hint="Create a bot via @BotFather on Telegram">
            <input
              type="password"
              value={botToken}
              onChange={e => setBotToken(e.target.value)}
              placeholder={tgConfig?.hasToken ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (saved)' : '123456:ABC-DEF...'}
              className="input-field"
            />
          </FieldGroup>

          <FieldGroup label="Your Chat ID" hint="Send /start to your bot, the bot will show your Chat ID">
            <input
              type="text"
              value={chatId}
              onChange={e => setChatId(e.target.value)}
              placeholder="e.g. 123456789"
              className="input-field"
            />
          </FieldGroup>
        </div>

        {tgMsg && <Msg ok={tgMsg.ok} text={tgMsg.text} />}

        <button
          onClick={saveTelegram}
          disabled={tgSaving || !botToken.trim()}
          className="btn-primary"
        >
          {tgSaving ? 'Connecting...' : 'Connect Relay'}
        </button>

        {/* Telegram Command Reference */}
        <div className="mt-4 border-t border-surface-3/50 pt-4">
          <button
            onClick={() => setShowTelegramGuide(!showTelegramGuide)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-xs uppercase text-text-muted font-mono tracking-widest">Bot Command Reference</span>
            <span className="text-text-muted text-xs">{showTelegramGuide ? '▲' : '▼'}</span>
          </button>
          {showTelegramGuide && (
            <div className="mt-3 bg-surface-2 rounded-lg p-4 space-y-2 text-xs font-mono text-text-secondary">
              <div className="text-xs uppercase text-grain-cyan tracking-widest mb-2 font-semibold">Commands</div>
              <div className="grid gap-1.5">
                <div><span className="text-grain-cyan">/note</span> <span className="text-text-muted">&lt;text&gt;</span> — Save a quick note</div>
                <div><span className="text-grain-cyan">/thought</span> <span className="text-text-muted">&lt;text&gt;</span> — Record a thought</div>
                <div><span className="text-grain-cyan">/decision</span> <span className="text-text-muted">&lt;text&gt;</span> — Log a decision</div>
                <div><span className="text-grain-cyan">/remember</span> <span className="text-text-muted">&lt;query&gt;</span> — Search memories</div>
                <div><span className="text-grain-cyan">/ask</span> <span className="text-text-muted">&lt;question&gt;</span> — Ask AI about your life</div>
                <div><span className="text-grain-cyan">/mood</span> <span className="text-text-muted">&lt;1-5&gt; [note]</span> — Record neural state</div>
                <div><span className="text-grain-cyan">/weekly</span> — Generate weekly digest</div>
                <div><span className="text-grain-cyan">/diff</span> — Monthly spending scan</div>
                <div><span className="text-grain-cyan">/status</span> — System status</div>
              </div>
              <div className="border-t border-surface-3/50 pt-2 mt-2">
                <div className="text-xs uppercase text-grain-amber tracking-widest mb-2 font-semibold">Auto-Capture</div>
                <div className="grid gap-1.5">
                  <div>🎤 <span className="text-text-secondary">Voice messages</span> — Auto-transcribed &amp; saved</div>
                  <div>📸 <span className="text-text-secondary">Photos</span> — Saved with caption</div>
                  <div>📍 <span className="text-text-secondary">Location</span> — Reverse geocoded &amp; saved</div>
                  <div>💬 <span className="text-text-secondary">Plain text</span> — Auto-saved as note</div>
                </div>
              </div>
              <div className="border-t border-surface-3/50 pt-2 mt-2">
                <div className="text-xs uppercase text-grain-purple tracking-widest mb-2 font-semibold">Scheduled</div>
                <div className="grid gap-1.5">
                  <div>☀️ <span className="text-text-secondary">10:00 AM + 7:00 PM</span> — Mood check prompt</div>
                  <div>🌙 <span className="text-text-secondary">10:00 PM</span> — Auto daily summary</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* -- Memory Vault -- */}
      <section className="grain-card rounded-xl border border-surface-3/50 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] uppercase font-mono tracking-widest text-grain-rose">Memory Vault</h2>
          </div>
        </div>

        {/* Retention Policy */}
        <FieldGroup label="Data Retention" hint="Automatically delete events older than the selected period">
          <select
            value={privacyStats?.retentionPeriod || 'forever'}
            onChange={async (e) => {
              try {
                await api.setRetentionPolicy(e.target.value);
                const updated = await api.getPrivacyStats();
                setPrivacyStats(updated);
                setPrivacyMsg({ ok: true, text: 'Retention policy updated' });
              } catch {
                setPrivacyMsg({ ok: false, text: 'Failed to update policy' });
              }
            }}
            className="input-field"
          >
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
            <option value="1y">1 year</option>
            <option value="forever">Keep forever</option>
          </select>
        </FieldGroup>

        {/* Data stats */}
        {privacyStats && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-surface-0 rounded-lg px-3 py-2">
              <div className="text-text-muted">Total events</div>
              <div className="text-text-primary font-mono font-medium">{privacyStats.totalEvents.toLocaleString()}</div>
            </div>
            <div className="bg-surface-0 rounded-lg px-3 py-2">
              <div className="text-text-muted">Voice files</div>
              <div className="text-text-primary font-mono font-medium">{privacyStats.voiceFiles}</div>
            </div>
            <div className="bg-surface-0 rounded-lg px-3 py-2">
              <div className="text-text-muted">Database size</div>
              <div className="text-text-primary font-mono font-medium">{(privacyStats.dbSizeBytes / 1024 / 1024).toFixed(1)} MB</div>
            </div>
            <div className="bg-surface-0 rounded-lg px-3 py-2">
              <div className="text-text-muted">Sensitive events</div>
              <div className="text-text-primary font-mono font-medium">{privacyStats.sensitiveEvents}</div>
            </div>
          </div>
        )}

        {privacyMsg && <Msg ok={privacyMsg.ok} text={privacyMsg.text} />}

        {/* Export */}
        <button
          onClick={async () => {
            setExporting(true);
            setPrivacyMsg(null);
            try {
              const result = await api.exportAllData(false);
              setPrivacyMsg({ ok: true, text: `Data exported to ${result.filePath}` });
            } catch {
              setPrivacyMsg({ ok: false, text: 'Export failed' });
            } finally {
              setExporting(false);
            }
          }}
          disabled={exporting}
          className="w-full px-4 py-2.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-sm text-text-secondary font-medium transition-colors disabled:opacity-50"
        >
          {exporting ? 'Exporting...' : 'Export All Data (JSON)'}
        </button>

        {/* Panic Wipe */}
        <div className="pt-2 border-t border-surface-3/50">
          {!wipeConfirm ? (
            <button
              onClick={() => {
                setWipeConfirm(true);
                if (!wipeWhisperSent) {
                  pushWhisper('You\'re considering erasing everything. The grain noticed.', 'confrontational', 'concerned', 'neural');
                  setWipeWhisperSent(true);
                }
              }}
              className="w-full px-4 py-2.5 rounded-lg bg-grain-rose/10 hover:bg-grain-rose/20 text-sm text-grain-rose font-medium transition-colors"
            >
              Panic Wipe — Delete All Data
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-grain-rose font-medium">
                This will permanently delete all your data, voice files, and configuration. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setWiping(true);
                    try {
                      const result = await api.panicWipe();
                      setPrivacyMsg({ ok: result.success, text: result.message });
                      if (result.success) {
                        setWipeConfirm(false);
                        loadAll();
                      }
                    } catch {
                      setPrivacyMsg({ ok: false, text: 'Wipe failed' });
                    } finally {
                      setWiping(false);
                    }
                  }}
                  disabled={wiping}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-grain-rose hover:bg-grain-rose/80 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {wiping ? 'Wiping...' : 'Confirm Panic Wipe'}
                </button>
                <button
                  onClick={() => setWipeConfirm(false)}
                  className="px-4 py-2.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-sm text-text-secondary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* -- Data Pathways -- */}
      <section className="grain-card rounded-xl border border-surface-3/50 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] uppercase font-mono tracking-widest text-grain-emerald">Data Pathways</h2>
        </div>
        <p className="text-xs text-text-muted">
          Automatically sync data from external services. Events are imported and deduplicated.
        </p>

        {connectors.map(c => {
          const isGCal = c.id === 'google-calendar';
          return (
            <div key={c.id} className="bg-surface-0 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{c.icon}</span>
                  <span className="text-sm font-medium text-text-primary">{c.name}</span>
                </div>
                <StatusBadge
                  ok={c.status.connected}
                  labelOn={`${c.status.eventCount} events`}
                  labelOff="Not connected"
                />
              </div>

              {c.status.connected ? (
                <div className="space-y-2">
                  {c.status.lastSync && (
                    <p className="text-xs text-text-muted font-mono">
                      Last sync: {new Date(c.status.lastSync).toLocaleString()}
                    </p>
                  )}
                  {c.status.lastError && (
                    <p className="text-xs text-grain-rose">Error: {c.status.lastError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setConnectorSyncing(true);
                        setConnectorMsg(null);
                        try {
                          const result = await api.connectorSync(c.id);
                          setConnectorMsg({ ok: true, text: `Synced: ${result.imported} new events` });
                          const updated = await api.connectorList();
                          setConnectors(updated);
                        } catch {
                          setConnectorMsg({ ok: false, text: 'Sync failed' });
                        } finally {
                          setConnectorSyncing(false);
                        }
                      }}
                      disabled={connectorSyncing}
                      className="flex-1 px-3 py-2 rounded-lg bg-grain-cyan/10 hover:bg-grain-cyan/20 text-xs text-grain-cyan font-medium transition-colors disabled:opacity-50"
                    >
                      {connectorSyncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await api.connectorDisconnect(c.id);
                          setConnectorMsg({ ok: true, text: `${c.name} disconnected` });
                          const updated = await api.connectorList();
                          setConnectors(updated);
                        } catch {
                          setConnectorMsg({ ok: false, text: 'Disconnect failed' });
                        }
                      }}
                      className="px-3 py-2 rounded-lg bg-grain-rose/10 hover:bg-grain-rose/20 text-xs text-grain-rose font-medium transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : isGCal ? (
                <div className="space-y-3">
                  <FieldGroup label="Google Cloud Client ID" hint="Create at console.cloud.google.com > APIs > Credentials">
                    <input
                      type="text"
                      value={gcClientId}
                      onChange={e => setGcClientId(e.target.value)}
                      placeholder="1234....apps.googleusercontent.com"
                      className="input-field"
                    />
                  </FieldGroup>
                  <FieldGroup label="Client Secret">
                    <input
                      type="password"
                      value={gcClientSecret}
                      onChange={e => setGcClientSecret(e.target.value)}
                      placeholder="GOCSPX-..."
                      className="input-field"
                    />
                  </FieldGroup>
                  <button
                    onClick={async () => {
                      setConnectorMsg(null);
                      try {
                        const result = await api.connectorAuthenticate(c.id, {
                          client_id: gcClientId.trim(),
                          client_secret: gcClientSecret.trim(),
                        });
                        if (result.ok && result.authUrl) {
                          window.open(result.authUrl, '_blank');
                          setConnectorMsg({ ok: true, text: 'Auth window opened. Complete sign-in in your browser.' });
                        } else {
                          setConnectorMsg({ ok: false, text: result.error || 'Auth failed' });
                        }
                      } catch {
                        setConnectorMsg({ ok: false, text: 'Auth failed' });
                      }
                    }}
                    disabled={!gcClientId.trim() || !gcClientSecret.trim()}
                    className="btn-primary"
                  >
                    Connect Google Calendar
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}

        {connectorMsg && <Msg ok={connectorMsg.ok} text={connectorMsg.text} />}
      </section>

      {/* -- Grain Diagnostics -- */}
      <section className="grain-card rounded-xl border border-surface-3/50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] uppercase font-mono tracking-widest text-grain-cyan">Grain Diagnostics</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <StatusRow label="Local API Server" value={system?.apiServer ? 'Running (port 31072)' : 'Not running'} ok={system?.apiServer ?? false} />
          <StatusRow label="Database Events" value={system ? `${system.dbEvents.toLocaleString()} events` : '...'} ok={(system?.dbEvents ?? 0) > 0} />
          <StatusRow label="Oracle Engine" value={aiStatus?.hasAnthropicKey ? 'Configured' : 'No API key'} ok={aiStatus?.hasAnthropicKey ?? false} />
          <StatusRow label="Telegram Relay" value={tgStatus?.running ? 'Online' : 'Offline'} ok={tgStatus?.running ?? false} />
          <StatusRow label="Memory Index" value={aiStatus?.hasOpenaiKey ? `${aiStatus.embeddingStats.count} embeddings` : 'No OpenAI key'} ok={aiStatus?.hasOpenaiKey ?? false} />
          <StatusRow
            label="Data Range"
            value={system?.dbDateRange ? `${system.dbDateRange.min} \u2014 ${system.dbDateRange.max}` : 'No data'}
            ok={!!system?.dbDateRange}
          />
        </div>
      </section>
    </div>
  );
}

// -- Sub-components --

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-text-muted mt-1">{hint}</p>}
    </div>
  );
}

function StatusBadge({ ok, labelOn, labelOff }: { ok: boolean; labelOn: string; labelOff: string }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-medium ${
      ok ? 'bg-grain-cyan/10 text-grain-cyan' : 'bg-surface-2 text-text-muted'
    }`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${ok ? 'bg-grain-cyan' : 'bg-grain-rose'}`} />
      {ok ? labelOn : labelOff}
    </span>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 bg-surface-0 rounded-lg px-3 py-2">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? 'bg-grain-cyan' : 'bg-grain-rose'}`} />
      <div className="min-w-0">
        <div className="text-text-muted">{label}</div>
        <div className="text-text-primary font-mono font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function Msg({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={`rounded-lg px-3 py-2 text-xs ${ok ? 'bg-grain-emerald/10 text-grain-emerald' : 'bg-grain-rose/10 text-grain-rose'}`}>
      {text}
    </div>
  );
}
