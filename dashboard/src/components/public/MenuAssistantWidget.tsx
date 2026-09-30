import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react';
import axios from 'axios';

const PUBLIC_API = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/v1/public`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function MenuAssistantWidget({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      const res = await axios.post(`${PUBLIC_API}/${slug}/assistant/chat`, { messages: nextMessages });
      setMessages([...nextMessages, { role: 'assistant', content: res.data.reply }]);
    } catch (err: any) {
      setError(err.response?.data?.message || t('assistant.unreachable'));
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
        <div className="fixed bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-96 h-[28rem] max-h-[70vh] bg-white rounded-2xl border border-gray-200 shadow-xl flex flex-col z-40 overflow-hidden">
          <div className="px-4 py-3 bg-[#ff4757] text-white flex items-center justify-between shrink-0">
            <span className="font-semibold text-sm flex items-center gap-2">
              <Sparkles size={16} /> {t('assistant.askAboutMenu')}
            </span>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white" aria-label={t('common.close')}>
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-gray-500">
                {t('assistant.intro')}
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-[#ff4757] text-white' : 'bg-gray-100 text-gray-800'
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
              placeholder={t('assistant.askPlaceholder')}
              rows={1}
              className="input flex-1 resize-none max-h-24"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="btn btn-primary p-2.5 shrink-0"
              aria-label={t('assistant.send')}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-14 h-14 rounded-full bg-[#ff4757] text-white shadow-lg flex items-center justify-center hover:bg-[#e63e4d] transition-colors z-40"
        aria-label={t('assistant.toggle')}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </>
  );
}
