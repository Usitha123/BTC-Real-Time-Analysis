import React, { useState, useEffect } from 'react';
import { PredictionResult, PredictionTimeframe } from '../types/crypto';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Info,
} from 'lucide-react';

interface PredictionDashboardProps {
  predictions: Record<PredictionTimeframe, PredictionResult | null>;
  activeTimeframe: PredictionTimeframe;
  onSelectTimeframe: (tf: PredictionTimeframe) => void;
  currentPrice: number;
  onCommitPrediction?: (pred: PredictionResult) => void;
}

const TIMEFRAMES: PredictionTimeframe[] = ['1m', '5m', '10m', '15m', '30m', '60m'];

export const PredictionDashboard: React.FC<PredictionDashboardProps> = ({
  predictions,
  activeTimeframe,
  onSelectTimeframe,
  currentPrice,
}) => {
  // Live ticker for countdown timer
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (expiryTimestamp: number) => {
    const remainingMs = expiryTimestamp - now;
    if (remainingMs <= 0) return 'Evaluating...';
    const totalSec = Math.floor(remainingMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 tracking-wide uppercase font-mono">
              Quantitative AI Predictions
            </h2>
            <p className="text-xs text-slate-400">
              Multi-horizon statistical forecast with calibrated empirical confidence
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Out-of-sample calibrated</span>
        </div>
      </div>

      {/* Grid of 6 Prediction Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {TIMEFRAMES.map((tf) => {
          const pred = predictions[tf];
          const isSelected = activeTimeframe === tf;

          if (!pred) {
            return (
              <div
                key={tf}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between h-48 opacity-75"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-400">{tf.toUpperCase()} HORIZON</span>
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <div className="text-center py-4">
                  <span className="text-xs font-mono text-amber-400/80 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                    INSUFFICIENT DATA
                  </span>
                  <p className="text-[11px] text-slate-500 mt-2">Streaming initial kline history</p>
                </div>
                <div className="text-[10px] text-slate-600 font-mono text-center">Syncing Binance feed...</div>
              </div>
            );
          }

          const isBull = pred.direction === 'UP';
          const isBear = pred.direction === 'DOWN';
          const isNeutral = pred.direction === 'NEUTRAL';

          const cardTheme = isBull
            ? 'border-emerald-500/40 bg-emerald-950/15 text-emerald-400'
            : isBear
            ? 'border-rose-500/40 bg-rose-950/15 text-rose-400'
            : 'border-slate-700/60 bg-slate-900/40 text-slate-300';

          const badgeBg = isBull
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            : isBear
            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            : 'bg-slate-800 text-slate-300 border-slate-700';

          return (
            <div
              key={tf}
              onClick={() => onSelectTimeframe(tf)}
              className={`relative cursor-pointer transition-all duration-200 rounded-xl p-3.5 border flex flex-col justify-between select-none ${cardTheme} ${
                isSelected
                  ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950 shadow-lg shadow-amber-500/10'
                  : 'hover:border-slate-600 hover:bg-slate-900/70'
              }`}
            >
              {/* Header: Horizon & Expiry Timer */}
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                <span className="font-mono text-xs font-extrabold tracking-wider text-slate-200">
                  {tf.toUpperCase()} HORIZON
                </span>
                <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">
                  <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
                  <span>{formatCountdown(pred.expiryTimestamp)}</span>
                </div>
              </div>

              {/* Main Direction Pill & Predicted Price */}
              <div className="py-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${badgeBg}`}
                  >
                    {isBull && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                    {isBear && <TrendingDown className="w-3 h-3 text-rose-400" />}
                    {isNeutral && <Minus className="w-3 h-3 text-slate-400" />}
                    {pred.direction}
                  </span>
                  <span
                    className={`font-mono text-xs font-bold ${
                      pred.expectedChangePct > 0 ? 'text-emerald-400' : pred.expectedChangePct < 0 ? 'text-rose-400' : 'text-slate-400'
                    }`}
                  >
                    {pred.expectedChangePct > 0 ? '+' : ''}
                    {pred.expectedChangePct}%
                  </span>
                </div>

                {/* Target Price */}
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] text-slate-400 uppercase font-mono">Target:</span>
                  <span className="font-mono text-base font-extrabold text-slate-100 tracking-tight">
                    ${pred.predictedPrice.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </span>
                </div>

                {/* Range corridor */}
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1">
                  <span>Range:</span>
                  <span className="text-slate-300">
                    ${pred.expectedRange[0].toFixed(0)} - ${pred.expectedRange[1].toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Confidence Bar & Validity */}
              <div className="border-t border-slate-800/60 pt-2 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-400">Confidence:</span>
                  <span className="font-bold text-slate-200">{pred.confidence}%</span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      pred.confidence > 65
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    }`}
                    style={{ width: `${pred.confidence}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-0.5">
                  <span className="truncate max-w-[90px]">
                    {pred.calibrationStatus === 'HIGH_VOLATILITY_ADJUSTED' ? 'Vol Adjusted' : 'Empirical Calib'}
                  </span>
                  <span>{new Date(pred.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
