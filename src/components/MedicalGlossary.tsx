"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Loader2, Bot } from "lucide-react";

export default function MedicalGlossary({ context }: { context?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "Hi! I'm your medical glossary. Ask me to define any terms from your lab report." }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, context }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (error: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 p-4 rounded-full shadow-lg bg-brand-blue text-white hover:bg-blue-600 transition-transform ${isOpen ? "scale-0" : "scale-100 print:hidden"}`}
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      <div 
        className={`fixed bottom-6 right-6 w-80 sm:w-96 glass-panel rounded-2xl overflow-hidden flex flex-col transition-all duration-300 transform origin-bottom-right print:hidden
        ${isOpen ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"}`}
        style={{ height: "500px", maxHeight: "80vh" }}
      >
        <div className="bg-white/10 border-b border-white/10 p-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5" />
            <h3 className="font-semibold">Glossary Assistant</h3>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-white hover:text-blue-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-transparent">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                msg.role === "user" ? "bg-brand-blue text-white rounded-br-none" : "bg-white/10 border border-white/10 text-white rounded-bl-none"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/10 border border-white/10 text-white p-3 rounded-2xl rounded-bl-none">
                <Loader2 className="w-4 h-4 animate-spin text-brand-blue" />
              </div>
            </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        <div className="p-3 bg-transparent border-t border-white/10">
          <div className="flex items-center space-x-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-brand-blue focus-within:border-transparent">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="What does 'RBC' mean?"
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 outline-none"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="text-brand-blue disabled:text-slate-400"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
