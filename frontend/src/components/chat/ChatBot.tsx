import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2, Minimize2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  'Who has overdue certifications?',
  'What projects are in progress?',
  'Show upcoming deadlines this week',
  'Which members have no certifications?',
];

function formatMessage(text: string) {
  // Convert markdown-like formatting to JSX-friendly HTML
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^• /gm, '&bull; ')
    .replace(/\n/g, '<br/>');
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "👋 Hi! I'm your **Team Tracker AI assistant**. I have live access to your team data — ask me anything!\n\nFor example:\n• *Who has overdue certifications?*\n• *What's the status of our projects?*\n• *Which members have upcoming deadlines?*",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages
        .filter(m => m.id !== '0') // Skip the initial greeting
        .map(m => ({ role: m.role, content: m.content }));

      const response = await api.post('/chat', {
        message: text.trim(),
        history,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.reply,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      const errMsg = error.response?.data?.error || 'Something went wrong. Please try again.';
      const isRateLimit = error.response?.status === 429;
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: isRateLimit
          ? '⏳ Too many requests — please wait a few seconds and try again.'
          : `⚠️ ${errMsg}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div className={cn(
          'fixed bottom-20 right-4 sm:right-6 w-[calc(100vw-32px)] sm:w-96 bg-card rounded-2xl shadow-2xl border border-border z-50 flex flex-col overflow-hidden transition-all duration-300',
          isMinimized ? 'h-14' : 'h-[560px] max-h-[80vh]',
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-azure-800 via-azure-700 to-purple-800 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-card/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Team Tracker AI</p>
                <p className="text-white/60 text-[10px]">Powered by Gemini • Live data</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setIsOpen(false)}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
                {messages.map(msg => (
                  <div key={msg.id} className={cn('flex items-start gap-2.5', msg.role === 'user' && 'flex-row-reverse')}>
                    {/* Avatar */}
                    <div className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border',
                      msg.role === 'assistant'
                        ? 'bg-gradient-to-br from-azure-500 to-purple-600 border-transparent'
                        : 'bg-muted/40 border-border'
                    )}>
                      {msg.role === 'assistant'
                        ? <Bot className="w-3.5 h-3.5 text-white" />
                        : <User className="w-3.5 h-3.5 text-muted-foreground" />
                      }
                    </div>

                    {/* Bubble */}
                    <div className={cn(
                      'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed border',
                      msg.role === 'assistant'
                        ? 'bg-card border-border text-foreground rounded-tl-sm shadow-sm'
                        : 'bg-azure-500 text-white border-transparent rounded-tr-sm'
                    )}>
                      <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                      <p className={cn('text-[10px] mt-1.5', msg.role === 'assistant' ? 'text-muted-foreground/60' : 'text-white/60')}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-azure-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                      <div className="flex gap-1 items-center">
                        <div className="w-1.5 h-1.5 bg-azure-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-azure-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-azure-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        <span className="text-[10px] text-muted-foreground ml-1">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggested Questions (show only at start) */}
              {messages.length <= 1 && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5 bg-background">
                  {SUGGESTED_QUESTIONS.map(q => (
                    <button key={q} onClick={() => sendMessage(q)}
                      className="text-[11px] px-2.5 py-1 bg-azure-950/40 text-azure-300 border border-azure-800/40 rounded-full hover:bg-azure-900/20 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="p-3 border-t border-border bg-card flex-shrink-0">
                <div className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border px-3 py-2 focus-within:border-azure-500 focus-within:ring-2 focus-within:ring-azure-500/20 transition-all">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your team data..."
                    disabled={isLoading}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || isLoading}
                    className="w-7 h-7 bg-azure-500 rounded-lg flex items-center justify-center hover:bg-azure-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                  >
                    {isLoading
                      ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                      : <Send className="w-3.5 h-3.5 text-white" />
                    }
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/50 text-center mt-1.5">Gemini AI · Live data from your database</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => { setIsOpen(!isOpen); setIsMinimized(false); }}
        className={cn(
          'fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center z-50 transition-all duration-300 border border-border/10',
          isOpen
            ? 'bg-card hover:bg-muted rotate-0 border-border'
            : 'bg-gradient-to-br from-azure-500 to-purple-600 hover:scale-110 hover:shadow-azure-500/40'
        )}
      >
        {isOpen
          ? <X className="w-5 h-5 text-white" />
          : (
            <div className="relative">
              <MessageCircle className="w-6 h-6 text-white" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-card animate-pulse" />
            </div>
          )
        }
      </button>
    </>
  );
}
