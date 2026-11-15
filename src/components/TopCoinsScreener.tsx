import React, { useMemo, useState } from 'react';
import {
  ScreenerResponse,
  ScreenerSetupEntry,
  TradeHorizon,
} from '../types/crypto';
import { HORIZON_CONFIG, TRADE_HORIZONS } from '../services/signalAnalyzer';
import { formatCoinPrice, formatCompactCoinPrice } from '../utils/formatters';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ArrowUpRight,
  AlertCircle,
} from 'lucide-react';

interface TopCoinsScreenerProps {
  screenerData: ScreenerResponse | null;
  isLoading: boolean;
  error: string | null;
  activeHorizon: TradeHorizon;
  activeSymbol: string;
  onChangeHorizon: (horizon: TradeHorizon) => void;
  onRefresh: () => void;
  onSelectCoin: (entry: ScreenerSetupEntry) => void;
}

type SignalFilter = 'ALL' | 'BUY' | 'SELL' | 'WAIT';
type SortMode = 'RANK' | 'CONFIDENCE' | 'WINRATE' | 'RR' | 'VOLUME';

function formatUsdCompact(n: number): string {
  if (!n || isNaN(n)) return '$0';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export const TopCoinsScreener: React.FC<TopCoinsScreenerProps> = ({
  screenerData,
  isLoading,
  error,
  activeHorizon,
  activeSymbol,
  onChangeHorizon,
  onRefresh,
  onSelectCoin,
}) => {
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('RANK');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);

  const setups = screenerData?.setups || [];

  const buyLeaders = useMemo(
    () => setups.filter((s) => s.action === 'BUY'),
    [setups]
  );
  const sellLeaders = useMemo(
    () => setups.filter((s) => s.action === 'SELL'),
    [setups]
  );

  const filteredAndSorted = useMemo(() => {
    const filtered = setups.filter((entry) => {
      if (signalFilter === 'ALL') return true;
      return entry.action === signalFilter;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortMode) {
        case 'CONFIDENCE':
          return b.confidenceScore - a.confidenceScore || b.rankScore - a.rankScore;
        case 'WINRATE':
          return b.backtestWinRate - a.backtestWinRate || b.rankScore - a.rankScore;
        case 'RR':
          return b.riskRewardRatio - a.riskRewardRatio || b.rankScore - a.rankScore;
        case 'VOLUME':
          return b.quoteVolume - a.quoteVolume;
        case 'RANK':
        default:
          return b.rankScore - a.rankScore;
      }
    });

    return sorted;
  }, [setups, signalFilter, sortMode]);

  const handleCopySetup = (entry: ScreenerSetupEntry) => {
    const fp = (v: number) => formatCoinPrice(v, entry.entryPrice, entry.pricePrecision);
    const text = `${entry.symbol} Perpetual Futures · ${entry.action} (${entry.horizonLabel} · ${entry.timeframe} Closed Chart)
Entry Price: $${fp(entry.entryPrice)} (Zone: $${fp(entry.entryZone[0])} - $${fp(entry.entryZone[1])})
Stop Loss: $${fp(entry.stopLoss)} (${entry.slPct}%)
Take Profit 1: $${fp(entry.takeProfit1)} (${entry.tp1Pct >= 0 ? '+' : ''}${entry.tp1Pct}%)
Take Profit 2: $${fp(entry.takeProfit2)} (${entry.tp2Pct >= 0 ? '+' : ''}${entry.tp2Pct}%)
Safe Leverage: ${entry.recommendedLeverage}x Isolated (Max Safe: ${entry.maxSafeLeverage}x)
Risk/Reward: 1 : ${entry.riskRewardRatio} | Confidence: ${entry.confidenceScore}% | Backtest Win: ${entry.backtestWinRate}% (${entry.backtestTrades} trades)
Criteria (${entry.totalCriteria}): ${entry.bullishCount} Bullish / ${entry.bearishCount} Bearish / ${entry.neutralCount} Neutral · MTF ${entry.mtfBullCount}B/${entry.mtfBearCount}S`;
    navigator.clipboard.writeText(text);
    setCopiedSymbol(entry.symbol);
    setTimeout(() => setCopiedSymbol(null), 2000);
  };

  const scannedTimeStr = screenerData?.generatedAt
    ? new Date(screenerData.generatedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  const topBuy = buyLeaders[0] || null;
  const topSell = sellLeaders[0] || null;

  return (
    <div className="space-y-5">
      {/* Unified Screener Panel */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {/* Header Bar */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              <span>Binance USD-M Perpetual Screener</span>
              <span aria-hidden="true">·</span>
              <span>{screenerData?.scannedCount ?? 16} Liquid Pairs</span>
              <span aria-hidden="true">·</span>
              <span>20 Indicators + 7 Timeframes (1m–1d)</span>
              <span aria-hidden="true">·</span>
              <span>Updated {scannedTimeStr}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Top Coins to Trade Now ({HORIZON_CONFIG[activeHorizon].label})
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Every coin is evaluated from strictly closed historical candles ({HORIZON_CONFIG[activeHorizon].chartTf} primary) plus real-time funding, open interest, taker volume, and historical backtest outcomes.
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Horizon Tabs */}
            <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              {TRADE_HORIZONS.map((h) => (
                <button
                  key={h}
                  onClick={() => onChangeHorizon(h)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeHorizon === h
                      ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {HORIZON_CONFIG[h].shortLabel}
                </button>
              ))}
            </div>

            {/* Signal Filter */}
            <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              {(
                [
                  { id: 'ALL', label: `All (${setups.length})` },
                  { id: 'BUY', label: `Buy (${buyLeaders.length})` },
                  { id: 'SELL', label: `Sell (${sellLeaders.length})` },
                  { id: 'WAIT', label: `Wait (${Math.max(0, setups.length - buyLeaders.length - sellLeaders.length)})` },
                ] as { id: SignalFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSignalFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    signalFilter === tab.id
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sort Select */}
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label="Sort screened coins"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:border-amber-500"
            >
              <option value="RANK">Sort: Best Setup Score</option>
              <option value="CONFIDENCE">Sort: Highest Confidence</option>
              <option value="WINRATE">Sort: Backtest Win %</option>
              <option value="RR">Sort: Best Risk / Reward</option>
              <option value="VOLUME">Sort: 24h Volume</option>
            </select>

            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Scanning...' : 'Scan Live Market'}</span>
            </button>
          </div>
        </div>

        {/* Summary Highlight Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="p-4">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Top Ranked Opportunity
            </span>
            {setups[0] ? (
              <button
                onClick={() => onSelectCoin(setups[0])}
                className="mt-1 text-left w-full group cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-bold font-mono text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">
                    {setups[0].symbol}
                  </span>
                  <span
                    className={`text-xs font-bold font-mono ${
                      setups[0].action === 'BUY'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : setups[0].action === 'SELL'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {setups[0].action} · {setups[0].confidenceScore}%
                  </span>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 block mt-0.5">
                  Entry ${formatCompactCoinPrice(setups[0].entryPrice, setups[0].entryPrice, setups[0].pricePrecision)} · TP1 ${formatCompactCoinPrice(setups[0].takeProfit1, setups[0].entryPrice, setups[0].pricePrecision)} · SL ${formatCompactCoinPrice(setups[0].stopLoss, setups[0].entryPrice, setups[0].pricePrecision)}
                </span>
              </button>
            ) : (
              <span className="text-sm font-mono text-slate-400 mt-1 block">Scanning...</span>
            )}
          </div>

          <div className="p-4">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              #1 Buy (Long) Setup
            </span>
            {topBuy ? (
              <button
                onClick={() => onSelectCoin(topBuy)}
                className="mt-1 text-left w-full group cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 group-hover:underline">
                    {topBuy.symbol}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {topBuy.bullishCount}/{topBuy.totalCriteria} Bull · 1:{topBuy.riskRewardRatio}
                  </span>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 block mt-0.5">
                  Entry ${formatCompactCoinPrice(topBuy.entryPrice, topBuy.entryPrice, topBuy.pricePrecision)} · TP1 +{topBuy.tp1Pct}% · {topBuy.recommendedLeverage}x
                </span>
              </button>
            ) : (
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1.5 block">
                {isLoading ? 'Evaluating pairs...' : 'No qualifying Long setup in top 16'}
              </span>
            )}
          </div>

          <div className="p-4">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              #1 Sell (Short) Setup
            </span>
            {topSell ? (
              <button
                onClick={() => onSelectCoin(topSell)}
                className="mt-1 text-left w-full group cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-bold font-mono text-rose-600 dark:text-rose-400 group-hover:underline">
                    {topSell.symbol}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {topSell.bearishCount}/{topSell.totalCriteria} Bear · 1:{topSell.riskRewardRatio}
                  </span>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 block mt-0.5">
                  Entry ${formatCompactCoinPrice(topSell.entryPrice, topSell.entryPrice, topSell.pricePrecision)} · TP1 {topSell.tp1Pct}% · {topSell.recommendedLeverage}x
                </span>
              </button>
            ) : (
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1.5 block">
                {isLoading ? 'Evaluating pairs...' : 'No qualifying Short setup in top 16'}
              </span>
            )}
          </div>

          <div className="p-4">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Active Market Breadth
            </span>
            <div className="flex items-baseline gap-3 mt-1 font-mono tabular-nums">
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {buyLeaders.length} Buy
              </span>
              <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                {sellLeaders.length} Sell
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {Math.max(0, setups.length - buyLeaders.length - sellLeaders.length)} Wait
              </span>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 block mt-0.5">
              Hold Horizon: {HORIZON_CONFIG[activeHorizon].label}
            </span>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-rose-500/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={onRefresh}
              className="px-3 py-1 rounded-md text-xs font-semibold bg-rose-600 text-white hover:bg-rose-500 cursor-pointer"
            >
              Retry Scan
            </button>
          </div>
        )}

        {/* Loading State (initial empty) */}
        {isLoading && setups.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <RefreshCw className="w-6 h-6 text-amber-500 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Scanning Top 16 Binance USD-M Futures Perpetual Contracts...
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
              Fetching closed chart candles (1m, 5m, 15m, 30m, 1h, 4h, 1d), Open Interest, Funding Rates, Long/Short ratios, and running full 20-indicator backtests.
            </p>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              No coins match the {signalFilter} filter on {HORIZON_CONFIG[activeHorizon].label}.
            </p>
            <button
              onClick={() => setSignalFilter('ALL')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Show All {setups.length} Scanned Coins
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950/30">
                  <th className="py-3 px-4"># & Coin</th>
                  <th className="py-3 px-3">Live Price / 24h</th>
                  <th className="py-3 px-3">Signal</th>
                  <th className="py-3 px-3">Entry Price / Zone</th>
                  <th className="py-3 px-3">TP1 / TP2</th>
                  <th className="py-3 px-3">Stop Loss / R:R</th>
                  <th className="py-3 px-3">Safe Lev</th>
                  <th className="py-3 px-3">20 Criteria & MTF</th>
                  <th className="py-3 px-3">Backtest / Conf</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {filteredAndSorted.map((entry, idx) => {
                  const isBuy = entry.action === 'BUY';
                  const isSell = entry.action === 'SELL';
                  const isExpanded = expandedSymbol === entry.symbol;
                  const isCurrent = entry.symbol === activeSymbol;
                  const fP = (v: number) => formatCoinPrice(v, entry.entryPrice, entry.pricePrecision);
                  const fC = (v: number) => formatCompactCoinPrice(v, entry.entryPrice, entry.pricePrecision);

                  return (
                    <React.Fragment key={entry.symbol}>
                      <tr
                        className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                          isCurrent ? 'bg-amber-500/5 dark:bg-amber-500/5' : ''
                        }`}
                      >
                        {/* Rank & Symbol */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono tabular-nums text-[11px] text-slate-400 w-5">
                              {idx + 1}.
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                                  {entry.baseAsset}/USDT
                                </span>
                                {isCurrent && (
                                  <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                Vol {formatUsdCompact(entry.quoteVolume)} · {entry.detectedPattern}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Live Price & 24h Change */}
                        <td className="py-3.5 px-3 font-mono tabular-nums whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            ${fP(entry.lastPrice)}
                          </div>
                          <div
                            className={`text-[11px] ${
                              entry.priceChangePercent >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {entry.priceChangePercent >= 0 ? '+' : ''}
                            {entry.priceChangePercent.toFixed(2)}%
                          </div>
                        </td>

                        {/* Signal */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold font-mono ${
                              isBuy
                                ? 'bg-emerald-600 text-white'
                                : isSell
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {isBuy && <TrendingUp className="w-3 h-3" />}
                            {isSell && <TrendingDown className="w-3 h-3" />}
                            {!isBuy && !isSell && <Minus className="w-3 h-3" />}
                            {entry.action}
                          </span>
                          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                            Score {entry.rankScore}
                          </div>
                        </td>

                        {/* Entry */}
                        <td className="py-3.5 px-3 font-mono tabular-nums whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            ${fP(entry.entryPrice)}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            ${fC(entry.entryZone[0])} – ${fC(entry.entryZone[1])}
                          </div>
                        </td>

                        {/* TP1 / TP2 */}
                        <td className="py-3.5 px-3 font-mono tabular-nums whitespace-nowrap">
                          <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                            ${fP(entry.takeProfit1)} ({entry.tp1Pct >= 0 ? '+' : ''}{entry.tp1Pct}%)
                          </div>
                          <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
                            TP2 ${fC(entry.takeProfit2)} ({entry.tp2Pct >= 0 ? '+' : ''}{entry.tp2Pct}%)
                          </div>
                        </td>

                        {/* Stop Loss & R:R */}
                        <td className="py-3.5 px-3 font-mono tabular-nums whitespace-nowrap">
                          <div className="font-semibold text-rose-600 dark:text-rose-400">
                            ${fP(entry.stopLoss)} ({entry.slPct}%)
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            R:R 1 : {entry.riskRewardRatio}
                          </div>
                        </td>

                        {/* Safe Leverage */}
                        <td className="py-3.5 px-3 font-mono tabular-nums whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {entry.recommendedLeverage}x Iso
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Max {entry.maxSafeLeverage}x
                          </div>
                        </td>

                        {/* 20 Criteria & MTF */}
                        <td className="py-3.5 px-3 font-mono tabular-nums whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              {entry.bullishCount}B
                            </span>
                            <span className="text-slate-400">/</span>
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">
                              {entry.bearishCount}S
                            </span>
                            <span className="text-slate-400">/</span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {entry.neutralCount}N
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            MTF {entry.mtfBullCount}B · {entry.mtfBearCount}S / 7
                          </div>
                        </td>

                        {/* Backtest Win & Confidence */}
                        <td className="py-3.5 px-3 font-mono tabular-nums whitespace-nowrap">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {entry.backtestTrades > 0 ? `${entry.backtestWinRate}% win (${entry.backtestTrades})` : 'Low sample'}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Conf {entry.confidenceScore}% · Fund {(entry.fundingRate * 100).toFixed(3)}%
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() =>
                                setExpandedSymbol(isExpanded ? null : entry.symbol)
                              }
                              className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>{entry.totalCriteria} Audit</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => onSelectCoin(entry)}
                              className="px-2.5 py-1.5 rounded-md text-xs font-semibold bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 hover:opacity-90 transition-opacity inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>Trade</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Full 20-Indicator & Futures Positioning Audit Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 dark:bg-slate-950/60">
                          <td colSpan={10} className="p-5 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                              <div className="space-y-1">
                                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                  {entry.symbol} Complete {entry.totalCriteria}-Indicator & Futures Audit ({entry.horizonLabel})
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                  {entry.summary}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleCopySetup(entry)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  {copiedSymbol === entry.symbol ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                  <span>{copiedSymbol === entry.symbol ? 'Copied Order' : 'Copy Setup'}</span>
                                </button>
                                <button
                                  onClick={() => onSelectCoin(entry)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <span>Open {entry.baseAsset} Signal & Chart</span>
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Key Levels & Futures Stats Strip */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs font-mono tabular-nums pb-3 border-b border-slate-200 dark:border-slate-800">
                              <div>
                                <span className="text-[11px] font-sans text-slate-500 block">Swing Support</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">${fP(entry.swingSupport)}</span>
                              </div>
                              <div>
                                <span className="text-[11px] font-sans text-slate-500 block">Swing Resistance</span>
                                <span className="font-semibold text-rose-600 dark:text-rose-400">${fP(entry.swingResistance)}</span>
                              </div>
                              <div>
                                <span className="text-[11px] font-sans text-slate-500 block">Floor Pivot (PP)</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">${fP(entry.pivotPoint)}</span>
                              </div>
                              <div>
                                <span className="text-[11px] font-sans text-slate-500 block">Supertrend (10,3)</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">${fP(entry.supertrendLevel)}</span>
                              </div>
                              <div>
                                <span className="text-[11px] font-sans text-slate-500 block">Open Interest</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatUsdCompact(entry.openInterestUsd)}</span>
                              </div>
                              <div>
                                <span className="text-[11px] font-sans text-slate-500 block">8h Funding</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {entry.fundingRate >= 0 ? '+' : ''}{(entry.fundingRate * 100).toFixed(4)}%
                                </span>
                              </div>
                              <div>
                                <span className="text-[11px] font-sans text-slate-500 block">Long / Short Accts</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {entry.longAccountPct.toFixed(0)}%L / {entry.shortAccountPct.toFixed(0)}%S
                                </span>
                              </div>
                              <div>
                                <span className="text-[11px] font-sans text-slate-500 block">Taker Buy/Sell</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {entry.takerBuySellRatio.toFixed(2)}x
                                </span>
                              </div>
                            </div>

                            {/* All 20 Criteria Audit Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 divide-y divide-slate-200 dark:divide-slate-800">
                              {entry.criteria.map((crit) => {
                                const cBull = crit.signal === 'BULLISH';
                                const cBear = crit.signal === 'BEARISH';
                                return (
                                  <div
                                    key={crit.id}
                                    className="py-2 flex items-start justify-between gap-3"
                                  >
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                        {crit.name}{' '}
                                        <span className="font-normal text-slate-500 dark:text-slate-400">
                                          · {crit.category}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                                        {crit.reason}
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0 font-mono tabular-nums">
                                      <div
                                        className={`text-xs font-bold ${
                                          cBull
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : cBear
                                            ? 'text-rose-600 dark:text-rose-400'
                                            : 'text-slate-500 dark:text-slate-400'
                                        }`}
                                      >
                                        {crit.signal === 'BULLISH'
                                          ? 'Bullish'
                                          : crit.signal === 'BEARISH'
                                          ? 'Bearish'
                                          : 'Neutral'}
                                      </div>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {crit.value}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
