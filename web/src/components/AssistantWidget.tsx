import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { useDraggableFab } from '../hooks/useDraggableFab';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const BUTTON_SIZE = 56;
const PANEL_GAP = 16;

export default function AssistantWidget() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { pos, dragHandlers, wasDragged } = useDraggableFab('rg_assistant_fab_pos', { right: 24, bottom: 24 }, BUTTON_SIZE);
  const [panelPos, setPanelPos] = useState({ right: pos.right, bottom: pos.bottom + BUTTON_SIZE + PANEL_GAP });

  useLayoutEffect(() => {
    if (!open) return;
    const desired = { right: pos.right, bottom: pos.bottom + BUTTON_SIZE + PANEL_GAP };
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      const maxRight = Math.max(8, window.innerWidth - rect.width - 8);
      const maxBottom = Math.max(8, window.innerHeight - rect.height - 8);
      desired.right = Math.min(Math.max(desired.right, 8), maxRight);
      desired.bottom = Math.min(Math.max(desired.bottom, 8), maxBottom);
    }
    setPanelPos(desired);
  }, [open, pos]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const res = await api.post('/v1/assistant/chat', { messages: nextMessages });
      setMessages([...nextMessages, { role: 'assistant', content: res.data.reply }]);
    } catch (err: any) {
      setError(err.response?.data?.message || t('assistant.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          style={{ right: panelPos.right, bottom: panelPos.bottom }}
          className="fixed w-96 h-[32rem] max-w-[calc(100vw-3rem)] bg-white rounded-2xl border border-gray-200 shadow-xl flex flex-col z-40 overflow-hidden"
        >
          <div className="px-4 py-3 bg-[var(--color-secondary)] text-white flex items-center justify-between shrink-0">
            <span className="font-semibold text-sm flex items-center gap-2">
              <Sparkles size={16} /> {t('assistant.title')}
            </span>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white" aria-label={t('assistant.toggleAriaLabel')}>
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-gray-500">{t('assistant.greeting')}</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-xl px-3 py-2">
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                </div>
              </div>
            )}
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          <div className="p-3 border-t border-gray-100 flex items-end gap-2 shrink-0">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('assistant.placeholder')}
              rows={1}
              className="input flex-1 resize-none max-h-24"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="btn btn-primary p-2.5 shrink-0"
              aria-label={t('assistant.toggleAriaLabel')}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => { if (!wasDragged()) setOpen((o) => !o); }}
        {...dragHandlers}
        style={{ right: pos.right, bottom: pos.bottom, touchAction: 'none' }}
        className="fixed w-14 h-14 rounded-full bg-[var(--color-primary)] text-white shadow-[var(--shadow-glow)] flex items-center justify-center hover:opacity-90 transition-opacity z-40 cursor-grab active:cursor-grabbing"
        aria-label={t('assistant.toggleAriaLabel')}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </>
  );
}
