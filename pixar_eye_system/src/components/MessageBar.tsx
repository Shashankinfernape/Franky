import React, { useState } from 'react';
import { Send, Volume2 } from 'lucide-react';

interface MessageBarProps {
  onSendMessage: (text: string) => void;
  isReceiving: boolean;
  receivedWords: string[];
  currentWordIndex: number;
  onSelectPreset?: (presetText: string) => void;
}

export const MessageBar: React.FC<MessageBarProps> = ({
  onSendMessage,
  isReceiving,
  receivedWords,
  currentWordIndex,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isReceiving) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-5xl flex flex-col items-center gap-3">

      {/* AI Response Box — words blur-reveal in sync with audio */}
      {receivedWords.length > 0 && (
        <div className="w-full bg-[#0d111a]/96 backdrop-blur-2xl border border-white/8 shadow-[0_8px_32px_rgba(0,0,0,0.6)] rounded-2xl p-4 md:p-5 flex items-start gap-3.5">
          {/* Speaker icon */}
          <div className="p-2 rounded-full bg-cyan-500/15 text-[#00C8FF] shrink-0 mt-0.5 border border-cyan-500/20">
            <Volume2 className={`w-4 h-4 ${isReceiving ? 'animate-pulse' : ''}`} />
          </div>

          {/* Word-by-word blur reveal */}
          <p className="flex-1 text-sm font-medium leading-relaxed tracking-wide select-none">
            {receivedWords.map((word, idx) => {
              const isPast = currentWordIndex >= 0 && idx < currentWordIndex;
              const isActive = currentWordIndex >= 0 && idx === currentWordIndex;

              return (
                <span
                  key={idx}
                  className="inline-block mr-[0.3em] transition-all duration-200"
                  style={{
                    opacity: 1,
                    transform: isActive ? 'scale(1.08) translateY(0)' : 'translateY(0)',
                    color: isActive
                      ? '#67e8f9'
                      : isPast
                      ? 'rgba(248,250,252,0.95)'
                      : '#475569',
                    fontWeight: isActive ? 700 : 500,
                    textShadow: isActive ? '0 0 12px rgba(103,232,249,0.7)' : 'none',
                  }}
                >
                  {word}
                </span>
              );
            })}
          </p>
        </div>
      )}

      {/* User Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="w-full bg-[#0B0F17]/90 backdrop-blur-2xl border border-slate-800 rounded-full p-2 pl-6 flex items-center justify-between shadow-2xl"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Say something to Emiot..."
          disabled={isReceiving}
          className="flex-1 bg-transparent border-none outline-none text-xs md:text-sm text-slate-100 placeholder-slate-500 font-medium px-1 disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isReceiving}
          className="w-10 h-10 rounded-full bg-[#00C8FF] hover:bg-[#00B4D8] disabled:opacity-40 text-slate-950 transition-all active:scale-95 shadow-lg shadow-cyan-500/25 flex items-center justify-center cursor-pointer shrink-0 ml-2"
        >
          <Send className="w-4 h-4 fill-slate-950 stroke-slate-950 ml-0.5" />
        </button>
      </form>
    </div>
  );
};
