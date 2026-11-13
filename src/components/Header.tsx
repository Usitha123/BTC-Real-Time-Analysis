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
  RefreshCw,
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

  const priceChangePercent = ticker?.priceChangePercent || 0;
  const is24hPositive = priceChangePercent >= 0;

  return (
    <header className="w-full bg-white/95 dark:bg-slate-950/95 border-b border-slate-200 dark:border-slate-800/90 backdrop-blur sticky top-0 z-40 px-4 py-2.5 transition-colors">
      <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Branding & Pair */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <span className="font-extrabold text-amber-600 dark:text-amber-400 text-lg font-mono">₿</span>
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                BTC <span className="text-amber-600 dark:text-amber-400">Signal Desk</span>
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                Binance Live Stream & Technical Structure Analysis
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block"></div>

          {/* Pair Label */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0">
            <span className="font-bold text-slate-900 dark:text-white">BTC / USDT</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">SPOT</span>
          </div>
        </div>

        {/* Center: Live Price & 24h Statistics */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono tabular-nums">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-xl sm:text-2xl font-extrabold transition-colors duration-300 ${
                priceFlash === 'UP'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : priceFlash === 'DOWN'
                  ? 'text-rose-600 dark:text-rose-400'
                  : currentPrice > 0
                  ? 'text-slate-900 dark:text-slate-100'
                  : 'text-slate-400'
              }`}
            >
              ${currentPrice > 0
                ? currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : 'Loading...'}
            </span>

            <span
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap shrink-0 ${
                is24hPositive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25'
              }`}
            >
              {is24hPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {is24hPositive ? '+' : ''}
              {priceChangePercent.toFixed(2)}%
            </span>
          </div>

          {ticker && (
            <div className="hidden xl:flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-800 pl-4">
              <div>
                <span className="text-[10px] text-slate-500 block">24h High</span>
                <span className="text-slate-900 dark:text-slate-200 font-bold">${ticker.highPrice.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">24h Low</span>
                <span className="text-slate-900 dark:text-slate-200 font-bold">${ticker.lowPrice.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">24h Volume (BTC)</span>
                <span className="text-slate-900 dark:text-slate-200 font-bold">
                  {ticker.volume.toLocaleString('en-US', { maximumFractionDigits: 0 })} BTC
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Connection Status & Theme Controls */}
        <div className="flex items-center space-x-2">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono whitespace-nowrap shrink-0 ${
              connectionStatus === 'CONNECTED'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400'
                : connectionStatus === 'RECONNECTING'
                ? 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-400'
                : 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-400'
            }`}
          >
            {connectionStatus === 'CONNECTED' ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            <span className="text-[11px] font-semibold">
              {connectionStatus === 'CONNECTED' ? 'Binance Live' : connectionStatus}
            </span>
            {latencyMs !== undefined && latencyMs > 0 && (
              <span className="text-[10px] opacity-75 border-l border-current/20 pl-1.5">
                {latencyMs}ms
              </span>
            )}
          </div>

          <button
            onClick={onManualRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
            title="Refresh market data & recalculate analysis"
            aria-label="Refresh market data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-500' : ''}`} />
          </button>

          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors active:scale-95 cursor-pointer shrink-0"
            title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
          </button>
        </div>
      </div>
    </header>
  );
};
