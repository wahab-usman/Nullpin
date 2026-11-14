import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, FileText, CreditCard, Code, Sparkles, Shield, User, Award, Layers } from 'lucide-react';
import { sound } from '../utils/sound';

export default function A4PaperPreview({
  mode,
  file,
  frontPreview,
  backPreview,
  textContent,
  colorMode,
  sides,
  copies,
  isFlipped,
  setIsFlipped,
}) {
  const isGrayscale = colorMode === 'bw';
  const isDoubleSided = sides === 'double';

  const handleManualFlip = () => {
    sound.paperFlip();
    setIsFlipped(!isFlipped);
  };

  // Stack shadow depth calculation for copies
  const stackCards = Math.min(Math.max(copies - 1, 0), 3);

  return (
    <div className="relative flex flex-col items-center justify-center py-2 select-none perspective-1000">
      {/* 3D Stack Offset Illusion for Multiple Copies */}
      {stackCards > 0 && (
        <>
          <div
            className="absolute w-[260px] sm:w-[310px] h-[368px] sm:h-[438px] rounded-xl bg-slate-300 dark:bg-zinc-800 -rotate-2 translate-y-3 opacity-40 shadow-sm pointer-events-none"
            style={{ zIndex: 0 }}
          />
          {stackCards > 1 && (
            <div
              className="absolute w-[260px] sm:w-[310px] h-[368px] sm:h-[438px] rounded-xl bg-slate-200 dark:bg-zinc-850 rotate-1 translate-y-1.5 opacity-60 shadow-sm pointer-events-none"
              style={{ zIndex: 1 }}
            />
          )}
        </>
      )}

      {/* Main 3D Flippable Paper Container */}
      <motion.div
        animate={{
          rotateY: isFlipped ? 180 : 0,
          scale: 1,
        }}
        transition={{
          type: 'spring',
          stiffness: 260,
          damping: 24,
        }}
        className="relative z-10 w-[270px] sm:w-[320px] h-[382px] sm:h-[452px] transform-style-3d cursor-default"
      >
        {/* ================= FRONT SIDE ================= */}
        <div
          className={`absolute inset-0 w-full h-full rounded-2xl backface-hidden overflow-hidden p-5 flex flex-col justify-between
            transition-all duration-300 paper-texture
            ${
              isGrayscale
                ? 'bg-[#FAFAFA] text-zinc-900 border border-zinc-300 shadow-[0_20px_45px_rgba(0,0,0,0.12)]'
                : 'bg-white text-zinc-900 border border-zinc-200 shadow-[0_20px_50px_rgba(0,0,0,0.16)]'
            }`}
          style={{
            filter: isGrayscale ? 'grayscale(100%)' : 'grayscale(0%)',
          }}
        >
          {/* Header watermark & print metadata */}
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[9px] font-mono font-bold tracking-wider uppercase text-zinc-500">
                A4 ISO-216 • 210 × 297mm
              </span>
            </div>
            <span className="text-[9px] font-mono text-zinc-400">
              {isDoubleSided ? 'SHEET 1 OF 2 [FRONT]' : 'PAGE 1 OF 1'}
            </span>
          </div>

          {/* Dynamic Content based on Mode */}
          <div className="flex-1 my-3 overflow-hidden flex flex-col">
            {/* 1. DOCUMENT MODE */}
            {mode === 'doc' && (
              <div className="flex-1 flex flex-col justify-between text-left">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="text-xs font-black tracking-tight text-zinc-900 line-clamp-1">
                        {file?.name || 'Academic_Research_Report.pdf'}
                      </h4>
                      <p className="text-[9px] text-zinc-500 font-mono">
                        Dept of Computer Science & Engineering
                      </p>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-[8px] font-mono font-bold text-zinc-600">
                      RAM DRAFT
                    </span>
                  </div>

                  {/* Simulated typography layout */}
                  <div className="space-y-1.5 mt-2">
                    <div className="h-2 w-3/4 bg-zinc-800 rounded-sm" />
                    <div className="h-1.5 w-full bg-zinc-200 rounded-sm" />
                    <div className="h-1.5 w-11/12 bg-zinc-200 rounded-sm" />
                    <div className="h-1.5 w-4/5 bg-zinc-200 rounded-sm" />
                  </div>

                  {/* Two column sample */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-zinc-100">
                    <div className="space-y-1">
                      <div className="h-1.5 w-1/2 bg-zinc-300 rounded-sm" />
                      <div className="h-1 w-full bg-zinc-200 rounded-sm" />
                      <div className="h-1 w-full bg-zinc-200 rounded-sm" />
                      <div className="h-1 w-4/5 bg-zinc-200 rounded-sm" />
                    </div>
                    <div className="space-y-1">
                      <div className="h-1.5 w-1/2 bg-zinc-300 rounded-sm" />
                      <div className="h-1 w-full bg-zinc-200 rounded-sm" />
                      <div className="h-1 w-full bg-zinc-200 rounded-sm" />
                      <div className="h-1 w-3/4 bg-zinc-200 rounded-sm" />
                    </div>
                  </div>
                </div>

                {/* Lab Stamp / Security Badge */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 border border-dashed border-zinc-200 mt-2">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[9px] font-mono font-semibold text-zinc-600">
                      NullPin Verified RAM Stream
                    </span>
                  </div>
                  <span className="text-[8px] font-mono text-zinc-400">ZERO DISK CACHE</span>
                </div>
              </div>
            )}

            {/* 2. ID CARD A4 MERGER MODE */}
            {mode === 'idcard' && (
              <div className="flex-1 flex flex-col justify-around py-1">
                {/* Front Card slot on A4 */}
                <div className="relative p-2.5 rounded-xl border border-zinc-200 bg-white shadow-sm flex items-center gap-3">
                  <div className="w-12 h-14 rounded-lg bg-slate-100 border border-zinc-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {frontPreview ? (
                      <img src={frontPreview} alt="ID Front" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-zinc-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-mono font-black text-emerald-600 uppercase">
                        CR-80 • FRONT SIDE
                      </span>
                      <span className="w-4 h-2.5 rounded-sm bg-amber-400/80 border border-amber-500/50" />
                    </div>
                    <p className="text-[10px] font-bold text-zinc-800 truncate">
                      STUDENT IDENTIFICATION
                    </p>
                    <div className="h-1 w-20 bg-zinc-200 rounded-sm my-1" />
                    <p className="text-[8px] font-mono text-zinc-500">ID: 2026-CS-8942</p>
                  </div>
                </div>

                {/* Perforated Center Alignment Divider */}
                <div className="flex items-center justify-center gap-2 my-1">
                  <div className="flex-1 border-t border-dashed border-zinc-300" />
                  <span className="text-[8px] font-mono font-bold text-zinc-400 uppercase tracking-widest px-1">
                    AUTO-CENTERED A4 CUT LINE
                  </span>
                  <div className="flex-1 border-t border-dashed border-zinc-300" />
                </div>

                {/* Back Card slot on A4 */}
                <div className="relative p-2.5 rounded-xl border border-zinc-200 bg-white shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8px] font-mono font-black text-emerald-600 uppercase">
                      CR-80 • BACK SIDE
                    </span>
                    <span className="text-[7px] font-mono text-zinc-400">MAGNETIC / BARCODE</span>
                  </div>
                  {/* Magnetic strip representation */}
                  <div className="w-full h-3 bg-zinc-900 rounded-sm mb-1.5 opacity-80" />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="h-1 w-16 bg-zinc-300 rounded-sm" />
                      <div className="h-1 w-24 bg-zinc-200 rounded-sm" />
                    </div>
                    {/* Simulated barcode */}
                    <div className="flex items-end gap-0.5 h-4">
                      {[3, 5, 2, 6, 4, 2, 5, 3, 6, 2, 4].map((h, i) => (
                        <div key={i} className="w-[1.5px] bg-zinc-800" style={{ height: `${h * 2}px` }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. SNIPPET / CODE MODE */}
            {mode === 'snippet' && (
              <div className="flex-1 flex flex-col justify-between text-left">
                <div className="flex items-center justify-between pb-1 mb-2 border-b border-zinc-100">
                  <div className="flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-[10px] font-mono font-bold text-zinc-800">
                      {file?.name || 'terminal_drop.sh'}
                    </span>
                  </div>
                  <span className="text-[8px] font-mono text-zinc-400">UTF-8 MONO</span>
                </div>

                {/* Simulated Syntax Highlighting Code Block */}
                <div className="flex-1 p-2.5 rounded-lg bg-zinc-900 text-zinc-100 font-mono text-[9px] leading-relaxed overflow-hidden">
                  <div className="flex gap-2">
                    <div className="text-zinc-500 select-none text-right">
                      1<br />2<br />3<br />4<br />5<br />6
                    </div>
                    <div className="overflow-hidden">
                      <span className="text-emerald-400"># NullPin Volatile Stream</span><br />
                      <span className="text-purple-400">const</span> session = await <span className="text-cyan-400">NullPin</span>.<span className="text-yellow-300">ramPipe</span>();<br />
                      session.<span className="text-blue-400">attach</span>(volatileBuffer);<br />
                      <span className="text-pink-400">printDirect</span>({'{'} wipeAfter: <span className="text-emerald-400">true</span> {'}'});<br />
                      <span className="text-zinc-400">// Direct to laser feed</span><br />
                      console.<span className="text-yellow-300">log</span>(<span className="text-emerald-300">"Burn Complete"</span>);
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer of A4 Paper */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
            <span className="text-[8px] font-mono text-zinc-400">
              NullPin Kinetic Engine • {isGrayscale ? 'Greyscale Mode' : 'CMYK Color'}
            </span>
            <span className="text-[8px] font-mono font-bold text-emerald-600">
              {copies} {copies === 1 ? 'COPY' : 'COPIES'}
            </span>
          </div>
        </div>

        {/* ================= BACK SIDE (For 2-Sided Prints) ================= */}
        <div
          className={`absolute inset-0 w-full h-full rounded-2xl rotate-y-180 backface-hidden overflow-hidden p-5 flex flex-col justify-between
            transition-all duration-300 paper-texture
            ${
              isGrayscale
                ? 'bg-[#F5F5F5] text-zinc-900 border border-zinc-300 shadow-[0_20px_45px_rgba(0,0,0,0.12)]'
                : 'bg-[#FAFAFA] text-zinc-900 border border-zinc-200 shadow-[0_20px_50px_rgba(0,0,0,0.16)]'
            }`}
          style={{
            filter: isGrayscale ? 'grayscale(100%)' : 'grayscale(0%)',
          }}
        >
          {/* Backside Header */}
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
            <span className="text-[9px] font-mono font-bold tracking-wider uppercase text-zinc-500">
              BACK SIDE • DUPLEX REVERSE
            </span>
            <span className="text-[9px] font-mono text-zinc-400">PAGE 2 OF 2</span>
          </div>

          {/* Backside Body */}
          <div className="flex-1 my-4 flex flex-col justify-center items-center text-center p-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center mb-3">
              <RefreshCw className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-xs font-bold text-zinc-800">Duplex Back Side Ready</p>
            <p className="text-[10px] text-zinc-500 max-w-[200px] mt-1">
              Printer will automatically feed this second side onto the reverse of the physical A4 sheet.
            </p>
          </div>

          {/* Backside Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
            <span className="text-[8px] font-mono text-zinc-400">Duplex Alignment: Long Edge (Standard)</span>
            <span className="text-[8px] font-mono font-bold text-zinc-600">REVERSE</span>
          </div>
        </div>
      </motion.div>

      {/* Floating 3D Flip Paper Button (Available in 2-Sided mode) */}
      <AnimatePresence>
        {isDoubleSided && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleManualFlip}
            className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full 
                       bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md 
                       border border-slate-200 dark:border-zinc-700/80 
                       text-xs font-semibold text-slate-700 dark:text-zinc-200
                       shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 transition-transform duration-500 ${isFlipped ? 'rotate-180' : ''}`} />
            <span>{isFlipped ? 'Show Front Side' : '3D Flip to Back Side'}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

