import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react';
import api from '../api/axios';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function AssistantWidget() {
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
      const res = await api.post('/assistant/chat', { messages: nextMessages });
      setMessages([...nextMessages, { role: 'assistant', content: res.data.reply }]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not reach the assistant, please try again.');
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
        <div className="fixed bottom-24 right-6 w-96 h-[32rem] max-w-[calc(100vw-3rem)] bg-white rounded-2xl border border-gray-200 shadow-xl flex flex-col z-40 overflow-hidden">
          <div className="px-4 py-3 bg-gray-900 text-white flex items-center justify-between shrink-0">
            <span className="font-semibold text-sm flex items-center gap-2">
              <Sparkles size={16} /> RestaurantGo Assistant
            </span>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white" aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-gray-500">
                Hi! Ask me anything about setting up your restaurant on RestaurantGo — menus, QR ordering, delivery payments, or anything else in the dashboard.
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
              placeholder="Ask a question..."
              rows={1}
              className="input flex-1 resize-none max-h-24"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="btn btn-primary p-2.5 shrink-0"
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#ff4757] text-white shadow-lg flex items-center justify-center hover:bg-[#e63e4d] transition-colors z-40"
        aria-label="Toggle assistant"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </>
  );
}
