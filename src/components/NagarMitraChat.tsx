import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, Sparkles, Trash2, Bot, User, Globe, HelpCircle, 
  ArrowRight, ShieldCheck, ChevronRight, AlertCircle, RefreshCw
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

const PRESET_PROMPTS = [
  {
    label: "How to file a complaint?",
    text: "How do I file a civic complaint with the Gandhinagar Municipal Corporation (GMC)?"
  },
  {
    label: "RTI Act 2005 rights",
    text: "What are my rights under the Right to Information (RTI) Act 2005 for GMC?"
  },
  {
    label: "Escalate to SWAGAT 2.0",
    text: "How can I escalate my unresolved complaint to SWAGAT 2.0?"
  },
  {
    label: "File on CPGRAMS",
    text: "Can you explain how to file a municipal issue on CPGRAMS?"
  }
];

export default function NagarMitraChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Namaste! I am NagarMitra, your civic assistant for Gandhinagar. How can I help you today? You can ask me how to file complaints, track tickets, learn about your RTI rights, or escalate grievances to SWAGAT 2.0 or CPGRAMS.",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed) return;

    setError(null);
    const userMsg: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      text: trimmed,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      // Build history payload for the API
      const historyPayload = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({
          role: m.role,
          text: m.text
        }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload
        })
      });

      if (!res.ok) {
        throw new Error("Server responded with an error");
      }

      const data = await res.json();
      if (data.success) {
        const botMsg: Message = {
          id: `msg_${Date.now()}_model`,
          role: 'model',
          text: data.response,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        throw new Error(data.error || "Failed to generate response");
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      setError("NagarMitra chat is currently at capacity. To get help with a specific complaint, open any ticket and use the Ask NagarMitra Desk panel — it can answer questions about your ticket's status, escalation, and assigned officer.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage(inputValue);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'model',
        text: "Namaste! I am NagarMitra, your civic assistant for Gandhinagar. How can I help you today? You can ask me how to file complaints, track tickets, learn about your RTI rights, or escalate grievances to SWAGAT 2.0 or CPGRAMS.",
        timestamp: new Date()
      }
    ]);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
      
      {/* Header Info Panel */}
      <div className="bg-white border border-[#e2e2d5] rounded-2xl p-4 mb-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#3a5a40]/10 rounded-xl text-[#3a5a40]">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-[#1a2e1d] flex items-center gap-1.5 uppercase tracking-wide">
              NagarMitra Civic Assistant
            </h2>
            <p className="text-[10px] font-medium text-[#8a8a7a]">
              Municipal helpdesk, RTI Act 2005 guidance, SWAGAT 2.0 & CPGRAMS escalations
            </p>
          </div>
        </div>
        
        <button
          onClick={clearChat}
          disabled={messages.length <= 1}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#e2e2d5] hover:border-rose-200 hover:bg-rose-50/50 rounded-lg text-[10px] font-bold text-[#8a8a7a] hover:text-rose-700 uppercase tracking-wider transition disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          title="Clear Conversation History"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Chat
        </button>
      </div>

      {/* Main Chat Window */}
      <div className="flex-grow bg-white border border-[#e2e2d5] rounded-3xl overflow-hidden flex flex-col shadow-2xs relative">
        
        {/* Messages list container */}
        <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                >
                  {/* Avatar bubble */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-2xs ${
                    isUser 
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-700' 
                      : 'bg-[#3a5a40]/10 border-[#3a5a40]/20 text-[#3a5a40]'
                  }`}>
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  {/* Message bubble card */}
                  <div className="flex flex-col">
                    <div className={`p-4 rounded-2xl text-xs leading-relaxed font-medium ${
                      isUser 
                        ? 'bg-amber-500/10 border border-amber-500/20 text-[#2d332d] rounded-tr-none' 
                        : 'bg-[#fafaf5] border border-[#e2e2d5] text-[#2d332d] rounded-tl-none'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                    <span className={`text-[9px] font-semibold uppercase tracking-wider text-[#8a8a7a] mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Typing thinking state indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 max-w-[85%] mr-auto"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#3a5a40]/10 border border-[#3a5a40]/20 text-[#3a5a40] shadow-2xs">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <div className="bg-[#fafaf5] border border-[#e2e2d5] p-4 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3a5a40] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3a5a40] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3a5a40] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[8px] font-extrabold text-[#3a5a40] uppercase tracking-wider mt-1.5 flex items-center gap-1">
                  <Globe className="w-3 h-3 animate-spin" /> Grounding current procedures with Google Search...
                </span>
              </div>
            </motion.div>
          )}

          {/* Interactive Help / Presets banner if only welcome is present */}
          {messages.length === 1 && !isTyping && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="pt-4 border-t border-dashed border-[#e2e2d5] max-w-xl mx-auto"
            >
              <span className="block text-center text-[10px] font-extrabold text-[#3a5a40] uppercase tracking-widest mb-3">
                Common Municipal Queries
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESET_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(p.text)}
                    className="text-left p-3 rounded-xl border border-[#e2e2d5] bg-[#fafaf5] hover:bg-[#3a5a40]/5 hover:border-[#3a5a40]/30 transition group flex items-start gap-2 cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-[#3a5a40] mt-0.5 opacity-60 group-hover:translate-x-0.5 transition flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-[#1a2e1d] group-hover:text-[#3a5a40]">
                        {p.label}
                      </span>
                      <span className="text-[9px] text-[#8a8a7a] line-clamp-1 mt-0.5 font-medium">
                        {p.text}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Network errors / Alert boxes */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 max-w-xl mx-auto">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <p className="text-[11px] font-semibold text-rose-700 flex-grow">{error}</p>
              <button
                onClick={() => {
                  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                  if (lastUserMsg) {
                    handleSendMessage(lastUserMsg.text);
                  } else {
                    setError(null);
                  }
                }}
                className="p-1 text-rose-700 hover:bg-rose-100 rounded-lg transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom entry actions */}
        <div className="p-3 bg-[#fafaf5] border-t border-[#e2e2d5] flex flex-col gap-2">
          
          {/* User manual input bar */}
          <div className="flex gap-2 relative items-center">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isTyping}
              placeholder="Ask NagarMitra about GMC procedures, ticket tracking, RTI, SWAGAT..."
              className="flex-grow bg-white border border-[#e2e2d5] rounded-xl px-4 py-3 text-xs placeholder-[#8a8a7a] focus:outline-none focus:border-[#3a5a40] focus:ring-1 focus:ring-[#3a5a40] disabled:bg-[#f5f5f0] disabled:cursor-not-allowed font-medium text-[#2d332d] shadow-2xs"
            />
            
            <button
              onClick={() => handleSendMessage(inputValue)}
              disabled={isTyping || !inputValue.trim()}
              className="bg-[#3a5a40] hover:bg-[#2d3a2d] text-white p-3 rounded-xl transition flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-sm cursor-pointer shrink-0"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Static suggested questions below the input box (always visible) */}
          <div className="flex flex-wrap gap-1.5 px-1.5 py-1">
            <span className="text-[9px] font-bold text-[#8a8a7a] self-center uppercase tracking-wider mr-1">Suggestions:</span>
            {[
              "How do I file a civic complaint?",
              "What are my RTI rights under the RTI Act 2005?",
              "How does the escalation process work?"
            ].map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setInputValue(q)}
                className="text-[10px] font-semibold text-[#3a5a40] bg-white hover:bg-[#3a5a40]/5 border border-[#e2e2d5] hover:border-[#3a5a40]/35 rounded-lg px-2.5 py-1 transition cursor-pointer text-left"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Attribution footer (REQUIRED BY SPECIFICATION) */}
          <div className="flex items-center justify-between px-1.5 pt-1 text-[9px] font-bold text-[#8a8a7a] uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#5a7a5a]" />
              Secure Public Information Interface
            </span>
            <span className="flex items-center gap-1 text-[#3a5a40] bg-white border border-[#e2e2d5] px-2 py-0.5 rounded-md">
              <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500 animate-pulse" />
              Powered by Gemini + Google Search
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
