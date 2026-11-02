import React, { useEffect, useState } from 'react';
import { Ticker24h } from '../types/crypto';
import { ConnectionStatus } from '../services/binance';
import {
  TrendingUp,
  TrendingDown,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  Cpu,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface HeaderProps {
  ticker: Ticker24h | null;
  currentPrice: number;
  prevPrice: number;
  connectionStatus: ConnectionStatus;
  latencyMs?: number;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onManualRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  ticker,
  currentPrice,
  prevPrice,
  connectionStatus,
  latencyMs,
  isDarkMode,
  onToggleTheme,
  onManualRefresh,
  isRefreshing,
}) => {
  const [priceFlash, setPriceFlash] = useState<'UP' | 'DOWN' | null>(null);

  useEffect(() => {
    if (prevPrice && currentPrice !== prevPrice) {
      if (currentPrice > prevPrice) {
        setPriceFlash('UP');
      } else if (currentPrice < prevPrice) {
        setPriceFlash('DOWN');
      }
      const t = setTimeout(() => setPriceFlash(null), 800);
      return () => clearTimeout(t);
    }
  }, [currentPrice, prevPrice]);

  const priceChange = ticker?.priceChange || 0;
  const priceChangePercent = ticker?.priceChangePercent || 0;
  const is24hPositive = priceChangePercent >= 0;

  return (
    <header className="w-full bg-slate-950/95 border-b border-slate-800/90 backdrop-blur sticky top-0 z-40 px-4 py-2.5 transition-colors">
      <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Branding & Pair selector */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-400 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <span className="font-extrabold text-amber-400 text-lg font-mono">₿</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-extrabold text-slate-100 tracking-tight font-mono flex items-center gap-1">
                  BTC <span className="text-amber-400">AI PREDICTOR</span>
                </h1>
                <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono hidden sm:block">
                Quantitative Machine Learning & Binance Live Stream
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 mx-1 hidden md:block"></div>

          {/* Symbol Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-300">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span className="font-bold text-white">BTC / USDT</span>
            <span className="text-[10px] text-slate-500">SPOT</span>
          </div>
        </div>

        {/* Center: Live Price & 24h Statistics */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono">
          {/* Main Ticker Price */}
          <div className="flex items-baseline gap-2">
            <span
              className={`text-xl sm:text-2xl font-extrabold transition-all duration-300 ${
                priceFlash === 'UP'
                  ? 'text-emerald-400 scale-105'
                  : priceFlash === 'DOWN'
                  ? 'text-rose-400 scale-105'
                  : currentPrice > 0
                  ? 'text-slate-100'
                  : 'text-slate-400'
              }`}
            >
              ${currentPrice > 0
                ? currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : 'Loading...'}
            </span>

            {/* 24h Change Badge */}
            <span
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-bold ${
                is24hPositive
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
              }`}
            >
              {is24hPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {is24hPositive ? '+' : ''}
              {priceChangePercent.toFixed(2)}%
            </span>
          </div>

          {/* 24h High / Low / Volume */}
          {ticker && (
            <div className="hidden xl:flex items-center gap-4 text-xs text-slate-400 border-l border-slate-800 pl-4">
              <div>
                <span className="text-[10px] text-slate-500 block">24h High</span>
                <span className="text-slate-200 font-bold">${ticker.highPrice.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">24h Low</span>
                <span className="text-slate-200 font-bold">${ticker.lowPrice.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">24h Volume (BTC)</span>
                <span className="text-slate-200 font-bold">
                  {ticker.volume.toLocaleString('en-US', { maximumFractionDigits: 0 })} BTC
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Connection Status & Theme Controls */}
        <div className="flex items-center space-x-2.5">
          {/* Binance Connection Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all ${
              connectionStatus === 'CONNECTED'
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400'
                : connectionStatus === 'RECONNECTING'
                ? 'bg-amber-950/40 border-amber-800/60 text-amber-400 animate-pulse'
                : 'bg-rose-950/40 border-rose-800/60 text-rose-400'
            }`}
          >
            {connectionStatus === 'CONNECTED' ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="text-[11px] font-semibold">
              {connectionStatus === 'CONNECTED' ? 'Binance Live' : connectionStatus}
            </span>
            {latencyMs !== undefined && latencyMs > 0 && (
              <span className="text-[9px] text-slate-400 border-l border-slate-700 pl-1">
                {latencyMs}ms
              </span>
            )}
          </div>

          {/* Manual Refresh / Re-compute */}
          <button
            onClick={onManualRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Refresh market data & recalculate predictions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer"
            title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-sky-400" />}
          </button>
        </div>
      </div>
    </header>
  );
};
