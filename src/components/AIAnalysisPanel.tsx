import React from 'react';
import { AIAnalysisData } from '../types/crypto';
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Activity,
  Layers,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface AIAnalysisPanelProps {
  analysis: AIAnalysisData | null;
  isLoading: boolean;
  onRefresh: () => void;
  error?: string | null;
  lastUpdated?: number;
}

export const AIAnalysisPanel: React.FC<AIAnalysisPanelProps> = ({
  analysis,
  isLoading,
  onRefresh,
  error,
  lastUpdated,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md flex flex-col space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide font-mono">
                Gemini AI Institutional Synthesis
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                gemini-3.8-flash
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Real-time deep qualitative and quantitative market structure reasoning
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
              Updated: {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 text-white text-xs font-mono font-medium transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Synthesizing...' : 'Re-Analyze'}</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !analysis && (
        <div className="space-y-4 animate-pulse py-6">
          <div className="h-6 bg-slate-800 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-28 bg-slate-800/60 rounded-lg"></div>
            <div className="h-28 bg-slate-800/60 rounded-lg"></div>
          </div>
          <div className="h-20 bg-slate-800/40 rounded-lg"></div>
        </div>
      )}

      {/* Content */}
      {analysis && (
        <div className="space-y-4">
          {/* Executive Summary Box */}
          <div className="p-3.5 bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 rounded-lg">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-indigo-400 mb-1">
              <Activity className="w-3.5 h-3.5" />
              <span>EXECUTIVE QUANTITATIVE SUMMARY</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">{analysis.executiveSummary}</p>
          </div>

          {/* Core Stance Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] uppercase font-mono text-slate-500">Macro Trend</span>
              <div className="text-xs font-mono font-bold text-slate-200 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                {analysis.marketTrend}
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] uppercase font-mono text-slate-500">Short-Term Direction</span>
              <div className="text-xs font-mono font-bold text-amber-300 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                {analysis.shortTermDirection}
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] uppercase font-mono text-slate-500">Market Uncertainty</span>
              <div className="text-xs font-mono font-bold text-sky-400 mt-1 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-sky-400" />
                {analysis.marketUncertainty}
              </div>
            </div>
          </div>

          {/* Bullish vs Bearish Catalysts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bullish Factors */}
            <div className="bg-emerald-950/15 border border-emerald-900/40 rounded-lg p-3.5 flex flex-col space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400">
                <ArrowUpRight className="w-4 h-4" />
                <span>BULLISH EVIDENCE & CONFLUENCE</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {analysis.bullishFactors.map((factor, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">•</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bearish Factors */}
            <div className="bg-rose-950/15 border border-rose-900/40 rounded-lg p-3.5 flex flex-col space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-rose-400">
                <ArrowDownRight className="w-4 h-4" />
                <span>BEARISH RISKS & HEADWINDS</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {analysis.bearishFactors.map((factor, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-rose-500 mt-0.5">•</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Support / Resistance Levels & Momentum / Volatility */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Key Price Levels */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5 space-y-2">
              <span className="text-[11px] font-mono font-semibold text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" /> KEY PIVOT & S/R LEVELS
              </span>
              <div className="grid grid-cols-2 gap-3 pt-1 font-mono">
                <div>
                  <span className="text-[10px] text-emerald-400 block mb-1">Key Support Levels:</span>
                  {analysis.keySupportLevels?.map((lvl, i) => (
                    <div key={i} className="text-slate-200 font-bold bg-slate-900 px-2 py-0.5 rounded mb-1 border border-slate-800">
                      ${lvl.toLocaleString()}
                    </div>
                  ))}
                </div>
                <div>
                  <span className="text-[10px] text-rose-400 block mb-1">Key Resistance Levels:</span>
                  {analysis.keyResistanceLevels?.map((lvl, i) => (
                    <div key={i} className="text-slate-200 font-bold bg-slate-900 px-2 py-0.5 rounded mb-1 border border-slate-800">
                      ${lvl.toLocaleString()}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Momentum & Volatility */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-400 block mb-0.5">Momentum Assessment</span>
                <p className="text-xs text-slate-300">{analysis.momentumAnalysis}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-400 block mb-0.5">Volatility & Squeeze Structure</span>
                <p className="text-xs text-slate-300">{analysis.volatilityAnalysis}</p>
              </div>
            </div>
          </div>

          {/* Invalidation / Reversal Conditions */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs font-mono text-amber-300/90 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-400">Model Invalidation Trigger: </span>
              {analysis.reversalConditions}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
