import { useState } from 'react';
import { Send, KeyRound } from 'lucide-react';

export default function MobileSwitcher({ activeTab, onTabChange }) {
  return (
    <div className="lg:hidden pill-toggle w-full mb-5">
      <button
        onClick={() => onTabChange('send')}
        className={`pill-toggle-btn flex-1 flex items-center justify-center gap-2 py-2.5 ${activeTab === 'send' ? 'active' : ''}`}
      >
        <Send className="w-4 h-4" />
        Send Drop
      </button>
      <button
        onClick={() => onTabChange('receive')}
        className={`pill-toggle-btn flex-1 flex items-center justify-center gap-2 py-2.5 ${activeTab === 'receive' ? 'active' : ''}`}
      >
        <KeyRound className="w-4 h-4" />
        Enter PIN
      </button>
    </div>
  );
}

