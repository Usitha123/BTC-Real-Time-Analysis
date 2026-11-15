import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ticker24h, FuturesSymbolInfo } from '../types/crypto';
import { ConnectionStatus } from '../services/binance';
import { formatCoinPrice, getBaseAssetFromSymbol } from '../utils/formatters';
import {
  TrendingUp,
  TrendingDown,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  RefreshCw,
  ChevronDown,
  Search,
  X,
  Check,
} from 'lucide-react';

interface HeaderProps {
  activeSymbol: string;
  futuresSymbols: FuturesSymbolInfo[];
  onSelectSymbol: (symbol: string) => void;
  isSymbolsLoading?: boolean;
  symbolsLoadError?: string | null;
  onRetryLoadSymbols?: () => void;
  pricePrecision?: number;
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
  activeSymbol,
  futuresSymbols,
  onSelectSymbol,
  isSymbolsLoading = false,
  symbolsLoadError = null,
  onRetryLoadSymbols,
  pricePrecision,
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
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const baseAsset = getBaseAssetFromSymbol(activeSymbol);

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

  useEffect(() => {
    if (isDropdownOpen) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 20);
      return () => clearTimeout(timer);
    }
  }, [isDropdownOpen]);

  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  const filteredSymbols = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) {
      return futuresSymbols.slice(0, 100);
    }
    const exactOrPrefix: FuturesSymbolInfo[] = [];
    const partial: FuturesSymbolInfo[] = [];
    for (const item of futuresSymbols) {
      const sym = item.symbol.toUpperCase();
      const base = item.baseAsset.toUpperCase();
      if (base === q || sym === q || base.startsWith(q)) {
        exactOrPrefix.push(item);
      } else if (sym.includes(q) || base.includes(q)) {
        partial.push(item);
      }
    }
    return [...exactOrPrefix, ...partial].slice(0, 120);
  }, [futuresSymbols, searchQuery]);

  const priceChangePercent = ticker?.priceChangePercent || 0;
  const is24hPositive = priceChangePercent >= 0;

  return (
    <header className="w-full bg-white/95 dark:bg-slate-950/95 border-b border-slate-200 dark:border-slate-800/90 backdrop-blur sticky top-0 z-40 px-3 sm:px-4 py-2 sm:py-2.5 transition-colors">
      <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        {/* Left: Branding & Searchable Futures Pair Selector */}
        <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <span className="font-extrabold text-amber-600 dark:text-amber-400 text-[11px] sm:text-xs font-mono">
                {baseAsset.slice(0, 4)}
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                {baseAsset} <span className="text-amber-600 dark:text-amber-400">Signal Desk</span>
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block truncate">
                Binance Futures Live Stream & Technical Analysis
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block"></div>

          {/* Searchable Cryptocurrency Dropdown */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              aria-expanded={isDropdownOpen}
              aria-haspopup="listbox"
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isDropdownOpen
                  ? 'bg-amber-500/10 border-amber-500/50 text-slate-900 dark:text-white'
                  : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <span className="font-bold text-slate-900 dark:text-white">{baseAsset} / USDT</span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">PERP</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 transition-transform ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isDropdownOpen && (
              <div
                role="listbox"
                className="fixed inset-x-3 top-14 sm:inset-x-auto sm:top-auto sm:absolute sm:left-0 sm:mt-2 sm:w-96 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[80vh] flex flex-col"
              >
                {/* Search Box */}
                <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="relative flex items-center flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search futures coin (BTC, ETH, SOL, PEPE...)"
                        className="w-full pl-8 pr-8 py-2 sm:py-1.5 text-base sm:text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            searchInputRef.current?.focus();
                          }}
                          className="absolute right-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                          aria-label="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(false)}
                      className="sm:hidden p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer shrink-0"
                      aria-label="Close coin selector"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1.5 px-0.5 gap-2">
                    <span>USD-M Perpetual Contracts</span>
                    <span>
                      {searchQuery.trim()
                        ? `${filteredSymbols.length} matching`
                        : `${futuresSymbols.length} coins · sorted by 24h vol`}
                    </span>
                  </div>
                </div>

                {/* Coin Rows */}
                <div className="max-h-[58vh] sm:max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-900">
                  {futuresSymbols.length === 0 ? (
                    <div className="py-8 px-4 text-center space-y-2.5">
                      {symbolsLoadError ? (
                        <>
                          <p className="text-xs text-rose-600 dark:text-rose-400 font-mono">
                            {symbolsLoadError}
                          </p>
                          {onRetryLoadSymbols && (
                            <button
                              type="button"
                              onClick={onRetryLoadSymbols}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isSymbolsLoading ? 'animate-spin' : ''}`} />
                              <span>Retry Loading Pairs</span>
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono inline-flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                          <span>Loading Binance USD-M Futures pairs...</span>
                        </div>
                      )}
                    </div>
                  ) : filteredSymbols.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 font-mono">
                      No Futures contract found matching &ldquo;{searchQuery}&rdquo;
                    </div>
                  ) : (
                    filteredSymbols.map((item) => {
                      const isSelected = item.symbol === activeSymbol;
                      const isPos = item.priceChangePercent >= 0;

                      return (
                        <button
                          key={item.symbol}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onSelectSymbol(item.symbol);
                            setIsDropdownOpen(false);
                            setSearchQuery('');
                          }}
                          className={`w-full px-3 py-2.5 sm:py-2 flex items-center justify-between text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/10 dark:bg-amber-500/15'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-900/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold font-mono text-slate-700 dark:text-slate-300">
                                {item.baseAsset.slice(0, 4)}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100 truncate">
                                  {item.baseAsset}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">/ USDT</span>
                                {isSelected && <Check className="w-3 h-3 text-amber-500 shrink-0" />}
                              </div>
                              <div className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                Vol ${(item.quoteVolume / 1_000_000).toFixed(1)}M
                              </div>
                            </div>
                          </div>

                          <div className="text-right font-mono tabular-nums shrink-0 ml-2">
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              ${formatCoinPrice(item.lastPrice, item.lastPrice, item.pricePrecision)}
                            </div>
                            <div
                              className={`text-[10px] font-semibold ${
                                isPos
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {isPos ? '+' : ''}
                              {item.priceChangePercent.toFixed(2)}%
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center + Right on Mobile: Live Price Row + Status Controls */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-3 sm:gap-5 flex-1 sm:flex-initial">
          {/* Live Price & 24h Statistics */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-5 font-mono tabular-nums min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <span
                className={`text-lg sm:text-2xl font-extrabold transition-colors duration-300 truncate ${
                  priceFlash === 'UP'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : priceFlash === 'DOWN'
                    ? 'text-rose-600 dark:text-rose-400'
                    : currentPrice > 0
                    ? 'text-slate-900 dark:text-slate-100'
                    : 'text-slate-400'
                }`}
              >
                ${currentPrice > 0 ? formatCoinPrice(currentPrice, currentPrice, pricePrecision) : 'Loading...'}
              </span>

              <span
                className={`inline-flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold whitespace-nowrap shrink-0 ${
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
                  <span className="text-slate-900 dark:text-slate-200 font-bold">
                    ${formatCoinPrice(ticker.highPrice, ticker.highPrice, pricePrecision)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">24h Low</span>
                  <span className="text-slate-900 dark:text-slate-200 font-bold">
                    ${formatCoinPrice(ticker.lowPrice, ticker.lowPrice, pricePrecision)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">24h Volume ({baseAsset})</span>
                  <span className="text-slate-900 dark:text-slate-200 font-bold">
                    {ticker.volume.toLocaleString('en-US', { maximumFractionDigits: 0 })} {baseAsset}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Connection Status & Theme Controls */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            <div
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg border text-xs font-mono whitespace-nowrap shrink-0 ${
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
              <span className="text-[11px] font-semibold hidden sm:inline">
                {connectionStatus === 'CONNECTED' ? 'Futures Live' : connectionStatus}
              </span>
              {latencyMs !== undefined && latencyMs > 0 && (
                <span className="text-[10px] opacity-75 border-l border-current/20 pl-1.5 hidden sm:inline">
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
      </div>
    </header>
  );
};
