import { useState, useCallback } from 'react';
import { FileText, CreditCard, Code, Upload, X, ImageIcon } from 'lucide-react';
import { useNullPin } from '../store/NullPinContext';
import PrintPrefs from './PrintPrefs';
import ActiveTicket from './ActiveTicket';

const MODES = [
  { key: 'file', label: 'File / PDF', icon: FileText, emoji: '📄' },
  { key: 'idcard', label: 'ID Card A4', icon: CreditCard, emoji: '🪪' },
  { key: 'code', label: 'Code / Link', icon: Code, emoji: '💻' },
];

const ACCEPTED_TYPES = {
  file: '.pdf,.png,.jpg,.jpeg,.gif,.docx,.doc,.xlsx,.pptx',
  idcard: '.png,.jpg,.jpeg,.gif,.bmp,.webp',
};

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function DropZone({ accept, onFile, file, onClear, label }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.size <= 10 * 1024 * 1024) onFile(f);
  }, [onFile]);

  const handleChange = useCallback((e) => {
    const f = e.target.files[0];
    if (f && f.size <= 10 * 1024 * 1024) onFile(f);
  }, [onFile]);

  if (file) {
    return (
      <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 animate-scale-in">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-500/20">
          <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">{file.name}</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">{formatFileSize(file.size)}</p>
        </div>
        <button
          onClick={onClear}
          className="p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
        >
          <X className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </button>
      </div>
    );
  }

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`relative flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
        ${dragOver
          ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/5 scale-[1.01]'
          : 'border-slate-300 dark:border-zinc-700 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-zinc-800/50'
        }`}
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 dark:bg-zinc-800">
        <Upload className="w-5 h-5 text-slate-400 dark:text-zinc-500" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
          {label || 'Drop file here or click to browse'}
        </p>
        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">PDF, Images, DOCX up to 10MB</p>
      </div>
      <input
        type="file"
        accept={accept}
        onChange={handleChange}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
    </label>
  );
}

function IDCardUpload({ frontFile, backFile, onFrontFile, onBackFile, onClearFront, onClearBack }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
          Auto-merges onto 1 single A4 page
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">Front Side</p>
          <DropZone
            accept={ACCEPTED_TYPES.idcard}
            onFile={onFrontFile}
            file={frontFile}
            onClear={onClearFront}
            label="Front"
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">Back Side</p>
          <DropZone
            accept={ACCEPTED_TYPES.idcard}
            onFile={onBackFile}
            file={backFile}
            onClear={onClearBack}
            label="Back"
          />
        </div>
      </div>
    </div>
  );
}

function CodeInput({ value, onChange }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Paste code snippet, URL, or text here..."
      rows={6}
      className="w-full p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 
                 border border-slate-200 dark:border-zinc-700/50 
                 text-sm font-mono text-slate-900 dark:text-zinc-100 
                 placeholder:text-slate-400 dark:placeholder:text-zinc-600
                 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500
                 resize-none transition-all duration-200"
    />
  );
}

export default function SenderPanel() {
  const { activeDrop, createDrop } = useNullPin();
  const [mode, setMode] = useState('file');
  const [file, setFile] = useState(null);
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [colorMode, setColorMode] = useState('bw');
  const [sides, setSides] = useState('single');
  const [copies, setCopies] = useState(1);
  const [burnAfterPrint, setBurnAfterPrint] = useState(true);

  const canGenerate =
    (mode === 'file' && file) ||
    (mode === 'idcard' && (frontFile || backFile)) ||
    (mode === 'code' && textContent.trim().length > 0);

  const handleGenerate = () => {
    if (!canGenerate) return;
    createDrop({
      mode,
      file,
      frontFile,
      backFile,
      textContent,
      colorMode,
      sides,
      copies,
      burnAfterPrint,
    });
  };

  const handleReset = () => {
    setFile(null);
    setFrontFile(null);
    setBackFile(null);
    setTextContent('');
    setCopies(1);
  };

  // If there's an active drop, show the ticket view
  if (activeDrop) {
    return <ActiveTicket onReset={handleReset} />;
  }

  return (
    <div className="glass-card p-6 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
          Send a Drop
        </h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
          Upload a file, ID card, or paste code — get a 4-digit PIN
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="pill-toggle w-full mb-5">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`pill-toggle-btn flex-1 flex items-center justify-center gap-1.5 text-xs sm:text-sm ${mode === m.key ? 'active' : ''}`}
          >
            <span>{m.emoji}</span>
            <span className="hidden sm:inline">{m.label}</span>
            <span className="sm:hidden">{m.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="mb-5">
        {mode === 'file' && (
          <DropZone
            accept={ACCEPTED_TYPES.file}
            onFile={setFile}
            file={file}
            onClear={() => setFile(null)}
          />
        )}
        {mode === 'idcard' && (
          <IDCardUpload
            frontFile={frontFile}
            backFile={backFile}
            onFrontFile={setFrontFile}
            onBackFile={setBackFile}
            onClearFront={() => setFrontFile(null)}
            onClearBack={() => setBackFile(null)}
          />
        )}
        {mode === 'code' && (
          <CodeInput value={textContent} onChange={setTextContent} />
        )}
      </div>

      {/* Print Preferences */}
      <PrintPrefs
        colorMode={colorMode}
        setColorMode={setColorMode}
        sides={sides}
        setSides={setSides}
        copies={copies}
        setCopies={setCopies}
        burnAfterPrint={burnAfterPrint}
        setBurnAfterPrint={setBurnAfterPrint}
      />

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="btn-primary mt-5 flex items-center justify-center gap-2 text-base"
      >
        Generate 4-Digit PIN
        <span className="text-lg">→</span>
      </button>
    </div>
  );
}

