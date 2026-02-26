import { ipcMain, dialog } from 'electron';
import * as db from '../core/database';
import { previewCsv, importCsv } from '../core/services/csv-importer';
import { generateDiff, getTimeMachine, getMonthlyAudit } from '../core/services/diff-engine';
import { createRule, toggleRule, removeRule } from '../core/services/rule-engine';
import { createAction, updateStatus } from '../core/services/action-engine';
import { chat, isAIConfigured } from '../core/services/ai-engine';
import { loadAIConfig, saveAIConfig, isTranscriptionConfigured } from '../core/services/transcription';
import { importLocationHistory } from '../core/services/location-importer';
import { importCalendarICS } from '../core/services/calendar-importer';
import { importAppleHealth } from '../core/services/health-importer';
import { recordMood } from '../core/services/mood-engine';
import { generateDigest, getDigests } from '../core/services/digest-engine';
import { getFilteredTimeline } from '../core/services/memory-engine';
import { loadTelegramConfig, saveTelegramConfig } from '../server/telegram-config';
import { ipcLogin, ipcLogout, ipcGetCurrentUser, ipcChangePassword } from '../core/services/auth-service';
import type { EventType } from '../core/types';

export function registerIpcHandlers(): void {
  // ── Auth ──
  ipcMain.handle('login', (_event, username: string, password: string) => {
    return ipcLogin(username, password);
  });

  ipcMain.handle('change-password', (_event, oldPassword: string, newPassword: string) => {
    return ipcChangePassword(oldPassword, newPassword);
  });

  ipcMain.handle('get-auth-user', () => {
    return ipcGetCurrentUser();
  });

  ipcMain.handle('logout', () => {
    ipcLogout();
  });

  // ── File Selection ──
  ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'CSV Files', extensions: ['csv', 'txt'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // ── CSV Import ──
  ipcMain.handle('preview-csv', (_event, filePath: string) => {
    return previewCsv(filePath);
  });

  ipcMain.handle('import-csv', (_event, filePath: string, mapping) => {
    return importCsv(filePath, mapping);
  });

  // ── Data Check ──
  ipcMain.handle('has-data', () => {
    return db.getTransactionCount() > 0;
  });

  // ── Transactions ──
  ipcMain.handle('get-transactions', (_event, start?: string, end?: string) => {
    return db.getTransactions(start, end);
  });

  // ── Diffs ──
  ipcMain.handle('generate-diff', (_event, periodType: string, refDate: string) => {
    return generateDiff(periodType as any, refDate);
  });

  ipcMain.handle('get-diffs', (_event, periodType?: string) => {
    return db.getDiffs(periodType);
  });

  // ── Time Machine ──
  ipcMain.handle('get-time-machine', (_event, eventId: string) => {
    return getTimeMachine(eventId);
  });

  // ── Subscriptions ──
  ipcMain.handle('get-subscriptions', () => {
    return db.getSubscriptions();
  });

  // ── Monthly Audit ──
  ipcMain.handle('get-monthly-audit', (_event, month: string) => {
    return getMonthlyAudit(month);
  });

  // ── Rules ──
  ipcMain.handle('get-rules', () => {
    return db.getRules();
  });

  ipcMain.handle('create-rule', (_event, ruleType: string, ruleJson: string) => {
    return createRule(ruleType as any, ruleJson);
  });

  ipcMain.handle('update-rule', (_event, id: string, enabled: number) => {
    toggleRule(id, enabled);
  });

  ipcMain.handle('delete-rule', (_event, id: string) => {
    removeRule(id);
  });

  // ── Actions ──
  ipcMain.handle('create-action', (_event, eventId: string, actionType: string, payloadJson: string) => {
    return createAction(eventId, actionType as any, payloadJson);
  });

  ipcMain.handle('update-action-status', (_event, id: string, status: string) => {
    updateStatus(id, status as any);
  });

  ipcMain.handle('get-actions', () => {
    return db.getActions();
  });

  // ── Quick Note ──
  ipcMain.handle('create-note', async (_event, content: string, source?: string, tags?: string[]) => {
    const { createNote } = await import('../core/services/note-engine');
    const result = createNote(content, (source as any) || 'manual', tags);
    return { event_id: result.event_id };
  });

  // ── Activity Log ──
  ipcMain.handle('get-activity-log', () => {
    return db.getActivityLog();
  });

  // ── AI Chat ──
  ipcMain.handle('send-chat-message', async (_event, message: string) => {
    return chat(message);
  });

  ipcMain.handle('get-chat-history', (_event, limit?: number) => {
    return db.getChatMessages(limit || 50);
  });

  ipcMain.handle('clear-chat-history', () => {
    db.clearChatMessages();
  });

  ipcMain.handle('get-ai-status', () => ({
    configured: isAIConfigured(),
    transcription: isTranscriptionConfigured(),
  }));

  // ── AI Digest ──
  ipcMain.handle('generate-digest', async (_event, period: string) => {
    return generateDigest(period as any);
  });

  ipcMain.handle('get-digests', (_event, limit?: number) => {
    return getDigests(limit || 20);
  });

  // ── Import Hub ──
  ipcMain.handle('get-import-stats', () => {
    return db.getImportStats();
  });

  ipcMain.handle('import-location-history', async (_event, filePath: string) => {
    return importLocationHistory(filePath);
  });

  ipcMain.handle('import-calendar-ics', async (_event, filePath: string) => {
    return importCalendarICS(filePath);
  });

  ipcMain.handle('import-apple-health', async (_event, filePath: string) => {
    return importAppleHealth(filePath);
  });

  ipcMain.handle('select-file-with-filter', async (_event, filterName: string, extensions: string[]) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: filterName, extensions }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // ── Timeline ──
  ipcMain.handle('get-enhanced-timeline', (_event, start: string, end: string, types?: EventType[]) => {
    return getFilteredTimeline(start, end, types);
  });

  ipcMain.handle('get-timeline-stats', () => ({
    totalEvents: db.getEventCount(),
    byType: db.getEventCountsByType(),
    dateRange: db.getDateRange(),
  }));

  // ── Mood ──
  ipcMain.handle('record-mood', (_event, score: number, note?: string) => {
    return recordMood(score, note);
  });

  // ── Notes ──
  ipcMain.handle('get-notes', (_event, limit?: number) => {
    return db.getNotes(limit || 100);
  });

  // ── Memory Search ──
  ipcMain.handle('search-memories', (_event, query: string, limit?: number) => {
    const { searchMemories } = require('../core/services/memory-engine');
    return searchMemories(query, limit || 50);
  });

  // ── Memory Stats ──
  ipcMain.handle('get-memory-stats', () => {
    const { getMemoryStats } = require('../core/services/memory-engine');
    return getMemoryStats();
  });

  // ── Phase 5: Semantic Search ──
  ipcMain.handle('semantic-search', async (_event, query: string, limit?: number) => {
    const { semanticSearch } = await import('../core/services/memory-engine');
    return semanticSearch(query, limit || 20);
  });

  ipcMain.handle('rebuild-embeddings', async () => {
    const { rebuildEmbeddings } = await import('../core/services/embedding-engine');
    return rebuildEmbeddings();
  });

  // ── Settings: AI Config ──
  ipcMain.handle('get-ai-config', () => {
    const config = loadAIConfig();
    return {
      hasAnthropicKey: !!config.anthropicApiKey,
      hasWhisperKey: !!config.whisperApiKey,
      hasOpenaiKey: !!(config.openaiApiKey || config.whisperApiKey),
      embeddingStats: {
        count: db.getEmbeddingCount(),
        total: db.getEventCount(),
      },
      privacyLevel: config.privacyLevel || 'balanced',
    };
  });

  ipcMain.handle('save-ai-config', (_event, config: { anthropicApiKey?: string; whisperApiKey?: string; openaiApiKey?: string; privacyLevel?: string }) => {
    saveAIConfig(config as any);
  });

  // ── Settings: Telegram Config ──
  ipcMain.handle('get-telegram-config', () => {
    const config = loadTelegramConfig();
    if (!config) return null;
    return {
      hasToken: !!config.botToken,
      allowedChatIds: config.allowedChatIds || [],
    };
  });

  ipcMain.handle('save-telegram-config', async (_event, config: { botToken: string; allowedChatIds: number[] }) => {
    try {
      saveTelegramConfig(config);
      // Restart bot with new config
      const { stopTelegramBot, startTelegramBot } = await import('../server/telegram');
      stopTelegramBot();
      const bot = await startTelegramBot();
      return { ok: true, message: bot ? 'Telegram bot started' : 'Config saved but bot failed to start' };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  ipcMain.handle('get-telegram-status', async () => {
    try {
      const { getTelegramBotStatus } = await import('../server/telegram');
      return getTelegramBotStatus();
    } catch {
      return { running: false };
    }
  });

  // ── Settings: System Status ──
  ipcMain.handle('get-system-status', () => ({
    apiServer: true, // If we got here, Electron is running
    dbEvents: db.getEventCount(),
    dbDateRange: db.getDateRange(),
  }));

  // ── Phase 4: Daily Narrative ──
  ipcMain.handle('get-daily-narrative', async (_event, date: string) => {
    const { getDailyNarrative } = await import('../core/services/memory-engine');
    return getDailyNarrative(date);
  });

  // ── Phase 4: Voice File Playback ──
  ipcMain.handle('get-voice-file', async (_event, filePath: string) => {
    const fs = await import('fs');
    const path = await import('path');
    // Security: only allow files under ~/.mirror-history/voice/
    const voiceDir = path.join(require('os').homedir(), '.mirror-history', 'voice');
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(voiceDir)) {
      throw new Error('Access denied: voice files must be in ~/.mirror-history/voice/');
    }
    if (!fs.existsSync(resolved)) {
      throw new Error('Voice file not found');
    }
    const buffer = fs.readFileSync(resolved);
    return buffer.toString('base64');
  });

  // ── Phase 5: Voice Recording (in-app) ──
  ipcMain.handle('save-audio-recording', async (_event, base64Audio: string, durationSeconds: number) => {
    const { saveAudioFile, transcribe } = await import('../core/services/transcription-engine');
    const { embedEventIfConfigured } = await import('../core/services/embedding-engine');

    // Decode base64 audio
    const audioBuffer = Buffer.from(base64Audio, 'base64');
    const timestamp = new Date().toISOString();
    const filename = `recording-${timestamp.replace(/[:.]/g, '-')}.webm`;

    // Save audio file
    const filePath = saveAudioFile(audioBuffer, filename);

    // Create event
    const event = db.insertEvent(
      'voice_memo',
      timestamp,
      'Voice recording',
      { source: 'app_recording', duration: durationSeconds },
      1.0,
      'local_private',
    );

    // Try transcription
    let transcript = '';
    try {
      transcript = await transcribe(filePath);
    } catch (err) {
      console.error('Transcription failed:', err);
    }

    // Save voice memo record
    db.insertVoiceMemo(event.id, transcript, durationSeconds, filePath, 'api');

    // Update event summary with transcript
    if (transcript) {
      db.getDb().prepare('UPDATE events SET summary = ? WHERE id = ?')
        .run(`Voice memo: ${transcript.slice(0, 100)}${transcript.length > 100 ? '...' : ''}`, event.id);
    }

    // Index for FTS
    const ftsContent = [
      'voice memo recording',
      transcript,
    ].filter(Boolean).join(' ');
    db.indexForSearch(event.id, ftsContent);

    // Auto-embed for semantic search
    embedEventIfConfigured(event.id).catch(() => {});

    db.logActivity('voice_recording', `Voice recording: ${durationSeconds}s${transcript ? ' — ' + transcript.slice(0, 80) : ''}`);

    return { event_id: event.id, transcript };
  });

  // ── Phase 5: Transcription Config ──
  ipcMain.handle('get-transcription-config', async () => {
    const { isTranscriptionEngineConfigured } = await import('../core/services/transcription-engine');
    return isTranscriptionEngineConfigured();
  });

  ipcMain.handle('save-transcription-config', async (_event, config: { engine?: string; ollamaUrl?: string; ollamaModel?: string }) => {
    const { saveTranscriptionConfig } = await import('../core/services/transcription-engine');
    saveTranscriptionConfig(config as any);
  });

  // ── Phase 5: Privacy Controls ──
  ipcMain.handle('get-privacy-stats', async () => {
    const { getPrivacyStats } = await import('../core/services/privacy-engine');
    return getPrivacyStats();
  });

  ipcMain.handle('set-retention-policy', async (_event, period: string) => {
    const { savePrivacyConfig, applyRetentionPolicy } = await import('../core/services/privacy-engine');
    savePrivacyConfig({ retentionPeriod: period as any });
    const result = applyRetentionPolicy();
    if (result.deleted > 0) {
      db.logActivity('retention_cleanup', `Retention policy applied: ${result.deleted} events deleted`);
    }
  });

  ipcMain.handle('export-all-data', async (_event, excludeSensitive?: boolean) => {
    const { exportToFile } = await import('../core/services/privacy-engine');
    const filePath = exportToFile(excludeSensitive || false);
    db.logActivity('data_export', `Full data export saved to ${filePath}`);
    return { filePath };
  });

  ipcMain.handle('panic-wipe', async () => {
    const { panicWipe } = await import('../core/services/privacy-engine');
    return panicWipe();
  });

  // ── Phase 5: Connector Framework ──
  ipcMain.handle('connector-list', async () => {
    const { connectorManager } = await import('../core/services/connector-framework');
    return connectorManager.listConnectors();
  });

  ipcMain.handle('connector-authenticate', async (_event, connectorId: string, config: Record<string, string>) => {
    const { connectorManager } = await import('../core/services/connector-framework');
    const connector = connectorManager.getConnector(connectorId);
    if (!connector) return { ok: false, error: `Connector "${connectorId}" not found` };
    return connector.authenticate(config);
  });

  ipcMain.handle('connector-callback', async (_event, connectorId: string, code: string) => {
    const { connectorManager } = await import('../core/services/connector-framework');
    const connector = connectorManager.getConnector(connectorId);
    if (!connector) return { ok: false, error: `Connector "${connectorId}" not found` };
    return connector.handleCallback(code);
  });

  ipcMain.handle('connector-sync', async (_event, connectorId: string) => {
    const { connectorManager } = await import('../core/services/connector-framework');
    return connectorManager.syncConnector(connectorId);
  });

  ipcMain.handle('connector-disconnect', async (_event, connectorId: string) => {
    const { connectorManager } = await import('../core/services/connector-framework');
    const connector = connectorManager.getConnector(connectorId);
    if (!connector) return { ok: false, error: `Connector "${connectorId}" not found` };
    connector.disconnect();
    return { ok: true };
  });

  // ── Phase 5: Moment Detection ──
  ipcMain.handle('get-weekly-highlights', async () => {
    const { getWeeklyHighlights } = await import('../core/services/moment-engine');
    return getWeeklyHighlights();
  });

  // ── Phase 6: Dark Grain — Re-do ──
  ipcMain.handle('get-redo-day', async (_event, date: string) => {
    const { getHourlyReconstruction } = await import('../core/services/redo-engine');
    return getHourlyReconstruction(date);
  });

  ipcMain.handle('get-moment-data', async (_event, timestamp: string, windowMinutes: number) => {
    const { getMomentData } = await import('../core/services/redo-engine');
    return getMomentData(timestamp, windowMinutes);
  });

  // ── Phase 6: Dark Grain — Forensic Zoom ──
  ipcMain.handle('get-forensic-context', async (_event, eventId: string, windowMinutes?: number) => {
    const { getForensicContext } = await import('../core/services/forensic-engine');
    return getForensicContext(eventId, windowMinutes ?? 30);
  });

  // ── Phase 6: Dark Grain — Inconsistency Engine ──
  ipcMain.handle('scan-inconsistencies', async (_event, startDate: string, endDate: string) => {
    const { scanForInconsistencies } = await import('../core/services/inconsistency-engine');
    return scanForInconsistencies(startDate, endDate);
  });

  ipcMain.handle('get-inconsistencies', async (_event, limit?: number) => {
    return db.getInconsistencies(limit ?? 50);
  });

  ipcMain.handle('dismiss-inconsistency', async (_event, id: string) => {
    db.dismissInconsistency(id);
    db.logActivity('inconsistency_dismissed', `Dismissed inconsistency ${id}`);
  });

  // ── Phase 6: Dark Grain — Confrontation Engine ──
  ipcMain.handle('generate-confrontations', async (_event, period: 'weekly' | 'monthly') => {
    const { generateConfrontations } = await import('../core/services/confrontation-engine');
    return generateConfrontations(period || 'weekly');
  });

  ipcMain.handle('get-confrontations', async (_event, limit?: number) => {
    return db.getConfrontations(limit ?? 20);
  });

  ipcMain.handle('acknowledge-confrontation', async (_event, id: string) => {
    db.acknowledgeConfrontation(id);
    db.logActivity('confrontation_acknowledged', `Acknowledged confrontation ${id}`);
  });

  // ── Phase 6: Dark Grain — Comparison Engine ──
  ipcMain.handle('compare-periods', async (_event, p1Start: string, p1End: string, p2Start: string, p2End: string) => {
    const { comparePeriods } = await import('../core/services/comparison-engine');
    return await comparePeriods(p1Start, p1End, p2Start, p2End);
  });

  // ── Phase 7: Visual Memory — "The Grain Sees" ──

  ipcMain.handle('select-multiple-files', async (_event, filterName: string, extensions: string[]) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: filterName, extensions }],
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('import-photos', async (_event, filePaths: string[]) => {
    const { importPhotos } = await import('../core/services/photo-engine');
    return importPhotos(filePaths);
  });

  ipcMain.handle('import-video', async (_event, filePath: string) => {
    const fs = await import('fs');
    const path = await import('path');
    const { saveVideoFile, extractFrames, getVideoMetadata } = await import('../core/services/video-engine');
    const { analyzeImage, summarizeVideoFrames, isVisionConfigured } = await import('../core/services/vision-engine');
    const { embedEventIfConfigured } = await import('../core/services/embedding-engine');

    // 1. Copy video to ~/.mirror-history/videos/
    const filename = path.basename(filePath);
    const savedPath = saveVideoFile(filePath, filename);

    // 2. Get metadata
    const metadata = await getVideoMetadata(savedPath);

    // 3. Create event
    const event = db.insertEvent(
      'video',
      new Date().toISOString(),
      `Video: ${filename} (${Math.round(metadata.duration)}s)`,
      { source: 'import', file_path: savedPath, duration: metadata.duration, width: metadata.width, height: metadata.height },
      1.0,
      'local_private',
    );

    // 4. Extract frames
    const { getFrameDir } = await import('../core/services/video-engine');
    const frameOutputDir = path.join(getFrameDir(), event.id);
    const { frames, duration } = await extractFrames(savedPath, frameOutputDir);

    // 5. Create video record first (frames reference video ID)
    const video = db.insertVideo(event.id, savedPath, duration, frames.length, '', 'import');

    // 6. Analyze each frame with vision (if configured)
    const frameAnalyses: { timestamp: number; description: string }[] = [];
    let framesAnalyzed = 0;
    const interval = duration / Math.max(frames.length, 1);

    if (isVisionConfigured() && frames.length > 0) {
      for (let i = 0; i < frames.length; i++) {
        const ts = Math.round(i * interval);
        try {
          const result = await analyzeImage(frames[i]);
          frameAnalyses.push({ timestamp: ts, description: result.description });
          db.insertVideoFrame(video.id, frames[i], ts, result.description);
          framesAnalyzed++;
        } catch {
          db.insertVideoFrame(video.id, frames[i], ts, '');
        }
      }
    } else {
      for (let i = 0; i < frames.length; i++) {
        db.insertVideoFrame(video.id, frames[i], Math.round(i * interval), '');
      }
    }

    // 7. Summarize video from frame descriptions
    let summary = '';
    if (frameAnalyses.length > 0) {
      try {
        summary = await summarizeVideoFrames(frameAnalyses);
      } catch {
        summary = frameAnalyses.map(f => f.description).join(' ');
      }
      // Update video record with summary
      db.getDb().prepare('UPDATE videos SET summary = ? WHERE id = ?').run(summary, video.id);
    }

    // 8. Update event summary with AI summary
    if (summary) {
      const shortSummary = summary.length > 100 ? `Video: ${summary.slice(0, 100)}...` : `Video: ${summary}`;
      db.getDb().prepare('UPDATE events SET summary = ? WHERE id = ?').run(shortSummary, event.id);
    }

    // 9. Index for search
    const searchContent = ['video', filename, summary].filter(Boolean).join(' ');
    db.indexForSearch(event.id, searchContent);

    // 10. Embed
    embedEventIfConfigured(event.id).catch(() => {});

    db.logActivity('video_imported', `Video imported: ${filename} (${Math.round(duration)}s, ${frames.length} frames)`, {
      event_id: event.id,
      duration,
      frames: frames.length,
      analyzed: framesAnalyzed,
    });

    return { event_id: event.id, frames_extracted: frames.length, summary };
  });

  ipcMain.handle('analyze-photo', async (_event, eventId: string) => {
    const { analyzePhotoByEvent } = await import('../core/services/photo-engine');
    await analyzePhotoByEvent(eventId);
    const photo = db.getPhotoByEvent(eventId);
    if (photo) {
      return db.getPhotoAnalysisByPhoto(photo.id);
    }
    return null;
  });

  ipcMain.handle('get-photo-file', async (_event, filePath: string) => {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    // Security: only allow files under ~/.mirror-history/photos/ or ~/.mirror-history/video-frames/
    const photoDir = path.join(os.homedir(), '.mirror-history', 'photos');
    const frameDir = path.join(os.homedir(), '.mirror-history', 'video-frames');
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(photoDir) && !resolved.startsWith(frameDir)) {
      throw new Error('Access denied: photo files must be in ~/.mirror-history/photos/ or ~/.mirror-history/video-frames/');
    }
    if (!fs.existsSync(resolved)) {
      throw new Error('Photo file not found');
    }
    return fs.readFileSync(resolved).toString('base64');
  });

  ipcMain.handle('get-video-file', async (_event, filePath: string) => {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    // Security: only allow files under ~/.mirror-history/videos/
    const videoDir = path.join(os.homedir(), '.mirror-history', 'videos');
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(videoDir)) {
      throw new Error('Access denied: video files must be in ~/.mirror-history/videos/');
    }
    if (!fs.existsSync(resolved)) {
      throw new Error('Video file not found');
    }
    return fs.readFileSync(resolved).toString('base64');
  });

  ipcMain.handle('get-visual-memories', async (_event, limit?: number) => {
    const maxLimit = limit ?? 50;
    const events = db.getDb().prepare(
      "SELECT * FROM events WHERE type IN ('photo', 'video') ORDER BY timestamp DESC LIMIT ?"
    ).all(maxLimit) as import('../core/types').Event[];

    return events.map(e => {
      const enriched: Record<string, unknown> = { ...e };
      if (e.type === 'photo') {
        const photo = db.getPhotoByEvent(e.id);
        if (photo) {
          const analysis = db.getPhotoAnalysisByPhoto(photo.id);
          enriched.photo = analysis ? { ...photo, analysis } : photo;
        }
      } else if (e.type === 'video') {
        enriched.video = db.getVideoByEvent(e.id);
      }
      return enriched;
    });
  });

  // ── Phase 8: Visual Comparison — "The Grain Compares" ──

  ipcMain.handle('compare-images', async (_event, imagePath1: string, imagePath2: string) => {
    const path = await import('path');
    const os = await import('os');
    const photoDir = path.join(os.homedir(), '.mirror-history', 'photos');
    const frameDir = path.join(os.homedir(), '.mirror-history', 'video-frames');
    for (const p of [imagePath1, imagePath2]) {
      const resolved = path.resolve(p);
      if (!resolved.startsWith(photoDir) && !resolved.startsWith(frameDir)) {
        throw new Error('Access denied: files must be in ~/.mirror-history/photos/ or ~/.mirror-history/video-frames/');
      }
    }
    const { compareImages } = await import('../core/services/visual-comparison-engine');
    return compareImages(imagePath1, imagePath2);
  });

  ipcMain.handle('compare-photo-sets', async (_event, p1Start: string, p1End: string, p2Start: string, p2End: string) => {
    const { comparePhotoSets } = await import('../core/services/visual-comparison-engine');
    return comparePhotoSets(p1Start, p1End, p2Start, p2End);
  });

  ipcMain.handle('get-visual-inconsistencies', async (_event, limit?: number) => {
    const rows = db.getInconsistencies(limit ?? 50);
    return rows.filter(r => r.type === 'visual_mood_mismatch');
  });
}
