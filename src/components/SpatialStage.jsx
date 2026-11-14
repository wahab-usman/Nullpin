import { motion, AnimatePresence } from 'framer-motion';
import { Send, KeyRound } from 'lucide-react';
import { useNullPin } from '../store/NullPinContext';
import { sound } from '../utils/sound';
import SendComposer from './SendComposer';
import KineticPinKeypad from './KineticPinKeypad';
import HolographicTicket from './HolographicTicket';
import PrintStudio from './PrintStudio';

export default function SpatialStage() {
  const { 
    activeStageTab, 
    setActiveStageTab, 
    currentView 
  } = useNullPin();

  const isPortalMode = currentView === 'portal';

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
      {/* Centered Segmented Switcher (Visible in portal mode) */}
      <AnimatePresence>
        {isPortalMode && (
          <div className="flex justify-center mb-4 sm:mb-6 w-full px-2">
            <div className="relative inline-flex p-1.5 rounded-full bg-slate-200/70 dark:bg-zinc-900/80 backdrop-blur-md border border-slate-300/60 dark:border-white/[0.08] shadow-sm w-full max-w-xs sm:w-auto justify-center">
              {/* Send Drop Tab (FIRST) */}
              <button
                type="button"
                onClick={() => {
                  sound.toggleSnap();
                  setActiveStageTab('send');
                }}
                className={`relative z-10 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-colors cursor-pointer touch-manipulation min-h-[44px] ${
                  activeStageTab === 'send'
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                {activeStageTab === 'send' && (
                  <motion.div
                    layoutId="mainStageSwitcher"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="absolute inset-0 rounded-full bg-white dark:bg-zinc-800 shadow-md border border-slate-200 dark:border-zinc-700/60"
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Send Drop</span>
                </span>
              </button>

              {/* Enter PIN Tab (SECOND) */}
              <button
                type="button"
                onClick={() => {
                  sound.toggleSnap();
                  setActiveStageTab('unlock');
                }}
                className={`relative z-10 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-colors cursor-pointer touch-manipulation min-h-[44px] ${
                  activeStageTab === 'unlock'
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                {activeStageTab === 'unlock' && (
                  <motion.div
                    layoutId="mainStageSwitcher"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="absolute inset-0 rounded-full bg-white dark:bg-zinc-800 shadow-md border border-slate-200 dark:border-zinc-700/60"
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Enter PIN</span>
                </span>
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {currentView === 'ticket' ? (
          <motion.div
            key="ticket-view"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="w-full"
          >
            <HolographicTicket />
          </motion.div>
        ) : currentView === 'studio' ? (
          <motion.div
            key="studio-view"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="w-full"
          >
            <PrintStudio />
          </motion.div>
        ) : activeStageTab === 'send' ? (
          <motion.div
            key="send-view"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="w-full"
          >
            <SendComposer />
          </motion.div>
        ) : (
          <motion.div
            key="unlock-view"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="w-full"
          >
            <KineticPinKeypad />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
