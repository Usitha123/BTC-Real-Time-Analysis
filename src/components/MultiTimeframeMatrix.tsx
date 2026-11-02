import React from 'react';
import { MultiTimeframeSignal } from '../types/crypto';
import {
  GitMerge,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';

interface MultiTimeframeMatrixProps {
  signals: MultiTimeframeSignal[];
}

export const MultiTimeframeMatrix: React.FC<MultiTimeframeMatrixProps> = ({ signals }) => {
  // Compute overall confluence
  const bullCount = signals.filter((s) => s.trend === 'BULLISH').length;
  const bearCount = signals.filter((s) => s.trend === 'BEARISH').length;
  const neutralCount = signals.filter((s) => s.trend === 'NEUTRAL').length;
  const total = signals.length || 7;

  const bullPct = Math.round((bullCount / total) * 100);
  const bearPct = Math.round((bearCount / total) * 100);

  let confluenceTitle = 'Consolidated Multi-Timeframe Neutral';
  let confluenceColor = 'text-slate-300';
  let confluenceDesc = 'Signals across short and higher timeframes are in equilibrium; wait for clear break.';

  if (bullPct >= 70) {
    confluenceTitle = `Strong Bullish Confluence (${bullPct}%)`;
    confluenceColor = 'text-emerald-400';
    confluenceDesc = 'Harmonious trend alignment across micro and macro horizons. High probability continuation setup.';
  } else if (bearPct >= 70) {
    confluenceTitle = `Strong Bearish Confluence (${bearPct}%)`;
    confluenceColor = 'text-rose-400';
    confluenceDesc = 'Uniform downward momentum across micro and macro horizons. High probability short setup.';
  } else if (signals.find((s) => s.timeframe === '1m')?.trend !== signals.find((s) => s.timeframe === '1d')?.trend) {
    confluenceTitle = 'Divergent Timeframe Conflict';
    confluenceColor = 'text-amber-400';
    confluenceDesc =
      'Micro scalp horizons (1m-5m) oppose macro trends (4h-1d). High risk of counter-trend bear/bull traps.';
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md flex flex-col space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <GitMerge className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide font-mono">
              Multi-Timeframe Confluence Matrix
            </h2>
            <p className="text-xs text-slate-400">
              Cross-horizon alignment from 1-minute scalping to 1-day macro structural trend
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded border border-slate-700 bg-slate-950 ${confluenceColor}`}>
            {confluenceTitle}
          </span>
        </div>
      </div>

      {/* Summary Confluence Banner */}
      <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg flex items-start gap-2.5 text-xs">
        {bullPct >= 70 || bearPct >= 70 ? (
          <CheckCircle className={`w-4 h-4 shrink-0 mt-0.5 ${confluenceColor}`} />
        ) : (
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
        )}
        <div className="space-y-1">
          <div className="text-slate-300 font-medium">{confluenceDesc}</div>
          <div className="text-[11px] font-mono text-slate-500">
            Bullish: {bullCount}/{total} | Bearish: {bearCount}/{total} | Neutral: {neutralCount}/{total}
          </div>
        </div>
      </div>

      {/* Responsive Matrix Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 font-mono">
        {signals.map((sig) => {
          const isBull = sig.trend === 'BULLISH';
          const isBear = sig.trend === 'BEARISH';

          const badgeBg = isBull
            ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
            : isBear
            ? 'bg-rose-950/30 border-rose-500/30 text-rose-400'
            : 'bg-slate-950/50 border-slate-800 text-slate-400';

          return (
            <div
              key={sig.timeframe}
              className={`p-3 rounded-lg border flex flex-col justify-between space-y-2 transition-all ${badgeBg}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 text-xs">{sig.timeframe.toUpperCase()}</span>
                {isBull ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                ) : isBear ? (
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Minus className="w-3.5 h-3.5 text-slate-400" />
                )}
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold block mb-1">{sig.trend}</span>
                <div className="text-[10px] text-slate-400 space-y-0.5">
                  <div>RSI: {sig.rsi.toFixed(1)}</div>
                  <div className="truncate">EMA: {sig.emaAlignment}</div>
                </div>
              </div>

              <div className="pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[9px]">
                  <span>Score:</span>
                  <span className={sig.compositeScore >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {sig.compositeScore > 0 ? `+${sig.compositeScore}` : sig.compositeScore}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
