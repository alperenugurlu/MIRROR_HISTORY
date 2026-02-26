import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import ChatMessageComponent from '../components/ChatMessage';
import type { ChatMessage } from '../../shared/types';
import { useGrainVoice } from '../contexts/GrainVoiceContext';

const QUICK_ACTIONS = [
  { label: 'Recall this week', prompt: 'Summarize my week — spending, mood, and notable events.' },
  { label: 'Detect patterns', prompt: 'What patterns do you see in my recent life data?' },
  { label: 'Analyze spending', prompt: 'What are my spending patterns and any concerns?' },
  { label: 'How am I doing?', prompt: 'Based on my mood entries and activity, how am I doing overall?' },
];

export default function Oracle() {
  const api = useApi();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { pushWhisper } = useGrainVoice();

  useEffect(() => {
    api.getAIStatus().then(s => setAiConfigured(s.configured)).catch(() => setAiConfigured(false));
    api.getChatHistory().then(setMessages).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    setSending(true);
    setInput('');
    try {
      const { userMsg, assistantMsg } = await api.sendChatMessage(text.trim());
      setMessages(prev => {
        const updated = [...prev, userMsg, assistantMsg];
        // The grain notices deep oracle conversations
        if (updated.length === 6) {
          pushWhisper('Three exchanges deep. The oracle is only as honest as the questions you ask.', 'provocative', 'amused', 'oracle');
        } else if (updated.length >= 12) {
          pushWhisper('You keep asking. Are you looking for answers, or confirmation?', 'confrontational', 'concerned', 'oracle');
        }
        return updated;
      });
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`, role: 'assistant',
        content: 'Error: Could not process your query. Check system status.',
        context_summary: '', created_at: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleClear = async () => {
    await api.clearChatHistory();
    setMessages([]);
  };

  // Oracle Inactive state
  if (aiConfigured === false) {
    return (
      <div className="p-6 max-w-4xl mx-auto animate-grain-load">
        <h1 className="text-[11px] font-mono text-grain-purple uppercase tracking-widest mb-4">The Oracle</h1>
        <div className="grain-card p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-grain-purple/10 flex items-center justify-center mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h2 className="text-sm font-medium text-text-primary">Oracle Inactive</h2>
          <p className="text-xs text-text-secondary max-w-sm mx-auto leading-relaxed">
            The Oracle requires a neural link to function. Without an Anthropic API key, it remains
            inert &mdash; unable to process your memories, detect contradictions, or confront you
            with what you&rsquo;d rather not see.
          </p>
          <button
            onClick={() => navigate('/neural')}
            className="px-5 py-2.5 rounded-lg bg-grain-purple hover:bg-grain-purple/80 text-white text-sm font-medium transition-colors"
          >
            Configure Neural
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-grain-load">
      {/* Header */}
      <div className="px-6 py-4 border-b border-surface-3/50 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-[11px] font-mono text-grain-purple uppercase tracking-widest">The Oracle</h1>
          <p className="text-xs text-text-muted mt-0.5">Query your recorded memories</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="text-xs text-text-muted hover:text-grain-rose transition-colors font-mono"
          >
            Clear history
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12 space-y-6">
            <div>
              <div className="w-12 h-12 rounded-full bg-grain-purple/10 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-sm text-text-secondary">The Oracle awaits your query</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
              {QUICK_ACTIONS.map(qa => (
                <button
                  key={qa.label}
                  onClick={() => send(qa.prompt)}
                  className="px-3 py-1.5 rounded-full bg-surface-2 text-xs text-text-secondary hover:bg-surface-3 hover:text-text-primary border border-surface-3/50 transition-all font-mono"
                >
                  {qa.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <ChatMessageComponent key={msg.id} message={msg} />
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-surface-2 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-text-muted border-l-2 border-grain-purple">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-grain-purple animate-glow-pulse" />
                <span className="font-mono text-xs">Oracle is processing...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-surface-3/50 shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Consult the Oracle..."
            disabled={sending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-surface-1 border border-surface-3/50 text-sm text-text-primary placeholder:text-text-muted font-mono focus:outline-none focus:ring-2 focus:ring-grain-purple/30 focus:border-grain-purple/50 disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="px-5 py-2.5 rounded-xl bg-grain-purple hover:bg-grain-purple/80 disabled:bg-surface-3 disabled:text-text-muted text-white text-sm font-medium transition-all"
          >
            Query
          </button>
        </form>
      </div>
    </div>
  );
}
