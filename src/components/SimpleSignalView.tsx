import React, { useEffect, useState } from 'react';
import {
  Candle,
  ChartTimeframe,
  TechnicalIndicators,
  PredictionResult,
  TradeHorizon,
  ScreenerSetupEntry,
} from '../types/crypto';
import {
  TradeSignalSetup,
  TechnicalCriterion,
  HORIZON_CONFIG,
  TRADE_HORIZONS,
} from '../services/signalAnalyzer';
import { TradingChart } from './TradingChart';
import {
  formatCoinPrice,
  formatCompactCoinPrice,
  getPriceDecimals,
  roundToPricePrecision,
} from '../utils/formatters';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Copy,
  Check,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  Unlock,
  Clock,
  ShieldAlert,
} from 'lucide-react';

interface LockedTradePlan {
  symbol: string;
  horizon: TradeHorizon;
  action: 'BUY' | 'SELL' | 'WAIT';
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  leverage: number;
  marginMode: 'Isolated' | 'Cross';
  liquidationPrice: number;
  lockedAt: number;
  expiresAt: number;
  chartTf: ChartTimeframe;
}

const LOCK_STORAGE_KEY = 'crypto_locked_trade_plan_v3';

interface SimpleSignalViewProps {
  symbol: string;
  baseAsset: string;
  pricePrecision?: number;
  activeHorizon: TradeHorizon;
  onSelectHorizon: (h: TradeHorizon) => void;
  allHorizonSignals: Record<TradeHorizon, TradeSignalSetup | null>;
  signal: TradeSignalSetup | null;
  currentPrice: number;
  candles: Candle[];
  timeframe: ChartTimeframe;
  onTimeframeChange: (tf: ChartTimeframe) => void;
  indicators: TechnicalIndicators | null;
  activePrediction: PredictionResult | null;
  isDarkMode: boolean;
  onSwitchToPro: () => void;
  topCoins?: ScreenerSetupEntry[];
  isTopCoinsLoading?: boolean;
  onOpenScreener?: () => void;
  onSelectScreenerCoin?: (entry: ScreenerSetupEntry) => void;
}

type CriteriaFilter = 'All' | TechnicalCriterion['category'];

function formatClockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Horizon Complete';
  const totalMins = Math.floor(ms / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`;
}

export const SimpleSignalView: React.FC<SimpleSignalViewProps> = ({
  symbol,
  baseAsset,
  pricePrecision,
  activeHorizon,
  onSelectHorizon,
  allHorizonSignals,
  signal,
  currentPrice,
  candles,
  timeframe,
  onTimeframeChange,
  indicators,
  activePrediction,
  isDarkMode,
  onSwitchToPro,
  topCoins,
  isTopCoinsLoading,
  onOpenScreener,
  onSelectScreenerCoin,
}) => {
  const [criteriaFilter, setCriteriaFilter] = useState<CriteriaFilter>('All');
  const [accountEquity, setAccountEquity] = useState<number>(2000);
  const [riskPct, setRiskPct] = useState<number>(1.5);
  const [leverage, setLeverage] = useState<number>(10);
  const [marginMode, setMarginMode] = useState<'Isolated' | 'Cross'>('Isolated');
  const [copied, setCopied] = useState<boolean>(false);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [lockedPlan, setLockedPlan] = useState<LockedTradePlan | null>(() => {
    try {
      const raw = localStorage.getItem(LOCK_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as LockedTradePlan) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  if (!signal) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Loading {symbol} closed chart candles &amp; USD-M Futures metrics across 1h, 2h, 5h, 10h, and 24h ranges...
        </p>
      </div>
    );
  }

  const isBuy = signal.action === 'BUY';
  const isSell = signal.action === 'SELL';

  const actionText = isBuy
    ? 'text-emerald-600 dark:text-emerald-400'
    : isSell
    ? 'text-rose-600 dark:text-rose-400'
    : 'text-amber-600 dark:text-amber-400';

  const actionSurface = isBuy
    ? 'bg-emerald-600 text-white'
    : isSell
    ? 'bg-rose-600 text-white'
    : 'bg-slate-700 text-white dark:bg-slate-800';

  const filteredCriteria =
    criteriaFilter === 'All'
      ? signal.criteria
      : signal.criteria.filter((c) => c.category === criteriaFilter);

  const bullPct = (signal.bullishCount / signal.totalCriteria) * 100;
  const neutPct = (signal.neutralCount / signal.totalCriteria) * 100;
  const bearPct = (signal.bearishCount / signal.totalCriteria) * 100;

  const decimals = getPriceDecimals(signal.entryPrice, pricePrecision ?? signal.pricePrecision);
  const fPrice = (v: number) => formatCoinPrice(v, signal.entryPrice, decimals);
  const fCompact = (v: number) => formatCompactCoinPrice(v, signal.entryPrice, decimals);
  const rPrice = (v: number) => roundToPricePrecision(v, signal.entryPrice, decimals);

  // Position & Futures Leverage Math
  const dollarRisk = (accountEquity * riskPct) / 100;
  const slDistance = Math.abs(signal.entryPrice - signal.stopLoss);
  const positionQty = slDistance > 0 ? dollarRisk / slDistance : 0;
  const notionalUsd = positionQty * signal.entryPrice;
  const requiredMargin = leverage > 0 ? notionalUsd / leverage : notionalUsd;
  const marginUtilizationPct = accountEquity > 0 ? (requiredMargin / accountEquity) * 100 : 0;
  const potentialTp1Profit = positionQty * Math.abs(signal.takeProfit1 - signal.entryPrice);
  const qtyDecimals = signal.entryPrice >= 1000 ? 4 : signal.entryPrice >= 10 ? 2 : 0;

  // Isolated Maintenance Margin ~ 0.5% for USD-M Perpetual
  const mmr = 0.005;
  const estLiquidationPrice =
    signal.action === 'SELL'
      ? rPrice(signal.entryPrice * (1 + 1 / Math.max(1, leverage) - mmr))
      : rPrice(signal.entryPrice * Math.max(0.05, 1 - 1 / Math.max(1, leverage) + mmr));

  const roeTp1Pct = Math.abs(signal.tp1Pct) * leverage;
  const roeTp2Pct = Math.abs(signal.tp2Pct) * leverage;
  const roeSlPct = -Math.abs(signal.slPct) * leverage;

  const isLiqSafe = leverage <= signal.recommendedLeverage;
  const isLiqCaution = leverage > signal.recommendedLeverage && leverage <= signal.maxSafeLeverage;
  const liqSafetyLabel = isLiqSafe
    ? `Safe (${signal.recommendedLeverage}x rec.) — Liquidation well past Stop Loss`
    : isLiqCaution
    ? `Tight Buffer — Max Safe Leverage is ${signal.maxSafeLeverage}x`
    : `High Risk — Lower leverage to ≤ ${signal.maxSafeLeverage}x so SL triggers before Liquidation`;

  const targetExitTime = formatClockTime(nowTick + signal.durationMs);
  const closedCandleLabel = formatClockTime(signal.closedCandleTime * 1000);
  const liveDiffFromEntry = currentPrice > 0 ? currentPrice - signal.entryPrice : 0;
  const liveInZone =
    currentPrice > 0 &&
    currentPrice >= signal.entryZone[0] &&
    currentPrice <= signal.entryZone[1];

  const handleLockTradeNow = () => {
    const entryAnchor = currentPrice > 0 ? rPrice(currentPrice) : signal.entryPrice;
    const slDelta = signal.stopLoss - signal.entryPrice;
    const tp1Delta = signal.takeProfit1 - signal.entryPrice;
    const tp2Delta = signal.takeProfit2 - signal.entryPrice;
    const lockedLiq =
      signal.action === 'SELL'
        ? rPrice(entryAnchor * (1 + 1 / Math.max(1, leverage) - mmr))
        : rPrice(entryAnchor * Math.max(0.05, 1 - 1 / Math.max(1, leverage) + mmr));

    const now = Date.now();
    const plan: LockedTradePlan = {
      symbol,
      horizon: signal.horizon,
      action: signal.action,
      entryPrice: entryAnchor,
      stopLoss: rPrice(entryAnchor + slDelta),
      takeProfit1: rPrice(entryAnchor + tp1Delta),
      takeProfit2: rPrice(entryAnchor + tp2Delta),
      leverage,
      marginMode,
      liquidationPrice: lockedLiq,
      lockedAt: now,
      expiresAt: now + signal.durationMs,
      chartTf: signal.timeframe,
    };
    setLockedPlan(plan);
    try {
      localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(plan));
    } catch {}
  };

  const handleUnlockTrade = () => {
    setLockedPlan(null);
    try {
      localStorage.removeItem(LOCK_STORAGE_KEY);
    } catch {}
  };

  const handleCopyLevels = () => {
    const text = `${symbol} Perpetual Futures · ${signal.action} (${signal.horizonLabel} · ${signal.timeframe} Closed Chart)
Leverage: ${leverage}x ${marginMode} (Recommended Safe: ${signal.recommendedLeverage}x | Max Safe: ${signal.maxSafeLeverage}x)
Entry Price: $${fPrice(signal.entryPrice)} (Zone: $${fPrice(signal.entryZone[0])} - $${fPrice(signal.entryZone[1])})
Stop Loss: $${fPrice(signal.stopLoss)} (${signal.slPct}% | ${roeSlPct.toFixed(1)}% ROE)
Take Profit 1: $${fPrice(signal.takeProfit1)} (+${Math.abs(signal.tp1Pct)}% | +${roeTp1Pct.toFixed(1)}% ROE)
Take Profit 2: $${fPrice(signal.takeProfit2)} (+${Math.abs(signal.tp2Pct)}% | +${roeTp2Pct.toFixed(1)}% ROE)
Est. Liquidation Price: $${fPrice(estLiquidationPrice)}
Hold Duration: ${signal.horizonLabel} (Target End: ${targetExitTime})
Risk/Reward: 1 : ${signal.riskRewardRatio}
Criteria: ${signal.bullishCount} Bullish / ${signal.bearishCount} Bearish / ${signal.neutralCount} Neutral`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Evaluate Locked Trade live leveraged ROE if viewing the locked symbol
  let lockedSpotPnlPct = 0;
  let lockedRoePct = 0;
  let lockedStatusText = 'Active — Monitoring';
  let lockedStatusColor = 'text-amber-600 dark:text-amber-400';
  const isLockedSameSymbol = lockedPlan ? (lockedPlan.symbol || 'BTCUSDT') === symbol : false;

  if (lockedPlan && isLockedSameSymbol && currentPrice > 0) {
    const dir = lockedPlan.action === 'SELL' ? -1 : 1;
    lockedSpotPnlPct = (((currentPrice - lockedPlan.entryPrice) / lockedPlan.entryPrice) * 100) * dir;
    lockedRoePct = lockedSpotPnlPct * (lockedPlan.leverage || 1);
    if (lockedPlan.action === 'BUY') {
      if (currentPrice >= lockedPlan.takeProfit2) {
        lockedStatusText = 'TP2 Target Reached';
        lockedStatusColor = 'text-emerald-600 dark:text-emerald-400';
      } else if (currentPrice >= lockedPlan.takeProfit1) {
        lockedStatusText = 'TP1 Target Reached';
        lockedStatusColor = 'text-emerald-600 dark:text-emerald-400';
      } else if (currentPrice <= lockedPlan.stopLoss) {
        lockedStatusText = 'Stop Loss Triggered';
        lockedStatusColor = 'text-rose-600 dark:text-rose-400';
      }
    } else if (lockedPlan.action === 'SELL') {
      if (currentPrice <= lockedPlan.takeProfit2) {
        lockedStatusText = 'TP2 Target Reached';
        lockedStatusColor = 'text-emerald-600 dark:text-emerald-400';
      } else if (currentPrice <= lockedPlan.takeProfit1) {
        lockedStatusText = 'TP1 Target Reached';
        lockedStatusColor = 'text-emerald-600 dark:text-emerald-400';
      } else if (currentPrice >= lockedPlan.stopLoss) {
        lockedStatusText = 'Stop Loss Triggered';
        lockedStatusColor = 'text-rose-600 dark:text-rose-400';
      }
    }
  } else if (lockedPlan && !isLockedSameSymbol) {
    lockedStatusText = `Viewing ${symbol} · Select ${lockedPlan.symbol} for live P&L`;
  }

  const fm = signal.futuresMetrics;
  const nextFundingStr = fm?.nextFundingTime ? formatRemaining(fm.nextFundingTime - nowTick) : '8h cycle';

  return (
    <div className="space-y-6">
      {/* Holding Timeframe Bar */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 sm:px-5 py-3.5">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Trade Duration</span>
          </span>

          <div className="grid grid-cols-5 sm:inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 gap-1 w-full sm:w-auto">
            {TRADE_HORIZONS.map((h) => {
              const cfg = HORIZON_CONFIG[h];
              const active = activeHorizon === h;
              return (
                <button
                  key={h}
                  onClick={() => onSelectHorizon(h)}
                  className={`px-1.5 sm:px-3 py-2 sm:py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer text-center ${
                    active
                      ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {cfg.label.replace(' Trade', '')}
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-[11px] sm:text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
          Locked on {signal.timeframe} close ({closedCandleLabel}) · Exit window {targetExitTime}
        </div>
      </section>

      {/* Top Coins Quick Recommendations Strip */}
      {(isTopCoinsLoading || (topCoins && topCoins.length > 0)) && onOpenScreener && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Top Coins to Trade Now ({HORIZON_CONFIG[activeHorizon].shortLabel} · Ranked by 20 Indicators & MTF)
            </div>
            <button
              onClick={onOpenScreener}
              className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Open Full {topCoins?.length || 16}-Coin Screener</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {topCoins && topCoins.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
              {topCoins.slice(0, 3).map((pick, i) => {
                const pBuy = pick.action === 'BUY';
                const pSell = pick.action === 'SELL';
                return (
                  <button
                    key={pick.symbol}
                    onClick={() => onSelectScreenerCoin?.(pick)}
                    className="p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                        #{i + 1} {pick.baseAsset}/USDT
                      </span>
                      <span
                        className={`text-xs font-bold font-mono ${
                          pBuy
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : pSell
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {pick.action} · {pick.confidenceScore}%
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-mono tabular-nums">
                      <span className="text-slate-600 dark:text-slate-300">
                        Entry ${formatCompactCoinPrice(pick.entryPrice, pick.entryPrice, pick.pricePrecision)}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        TP1 ${formatCompactCoinPrice(pick.takeProfit1, pick.entryPrice, pick.pricePrecision)}
                      </span>
                      <span className="text-rose-600 dark:text-rose-400">
                        SL ${formatCompactCoinPrice(pick.stopLoss, pick.entryPrice, pick.pricePrecision)}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {pick.bullishCount}B / {pick.bearishCount}S of {pick.totalCriteria} · Win {pick.backtestWinRate}% · {pick.recommendedLeverage}x Iso
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-3 text-xs font-mono text-slate-500 dark:text-slate-400">
              Scanning top liquid USD-M Perpetual pairs across all 20 indicators & 7 timeframes...
            </div>
          )}
        </section>
      )}

      {/* Active Locked Trade Plan Banner */}
      {lockedPlan && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-bold text-slate-800 dark:text-slate-200">{lockedPlan.symbol || 'BTCUSDT'}</span>
                <span aria-hidden="true">·</span>
                <span>
                  Locked {HORIZON_CONFIG[lockedPlan.horizon].label} ({lockedPlan.leverage || 10}x {lockedPlan.marginMode || 'Isolated'})
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {formatClockTime(lockedPlan.lockedAt)} → {formatClockTime(lockedPlan.expiresAt)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatRemaining(lockedPlan.expiresAt - nowTick)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums text-sm">
                <span className="font-bold text-slate-900 dark:text-white">
                  {lockedPlan.action} @ ${formatCoinPrice(lockedPlan.entryPrice, lockedPlan.entryPrice)}
                </span>
                <span className="text-rose-600 dark:text-rose-400">
                  SL ${formatCoinPrice(lockedPlan.stopLoss, lockedPlan.entryPrice)}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  TP1 ${formatCoinPrice(lockedPlan.takeProfit1, lockedPlan.entryPrice)}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  TP2 ${formatCoinPrice(lockedPlan.takeProfit2, lockedPlan.entryPrice)}
                </span>
                {lockedPlan.liquidationPrice > 0 && (
                  <span className="text-slate-500 dark:text-slate-400 text-xs">
                    Liq ~${formatCoinPrice(lockedPlan.liquidationPrice, lockedPlan.entryPrice)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-4">
              <div className="text-left sm:text-right font-mono tabular-nums">
                <span className={`text-xs font-bold block ${lockedStatusColor}`}>
                  {lockedStatusText}
                </span>
                {isLockedSameSymbol && (
                  <span
                    className={`text-sm font-bold ${
                      lockedRoePct >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {lockedRoePct >= 0 ? '+' : ''}{lockedRoePct.toFixed(2)}% ROE ({lockedSpotPnlPct >= 0 ? '+' : ''}{lockedSpotPnlPct.toFixed(2)}%)
                  </span>
                )}
              </div>

              <button
                onClick={handleUnlockTrade}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Clear Lock</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Primary Stable Trade Setup Card */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 space-y-5 sm:space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
              <span>{signal.horizonLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{signal.timeframe.toUpperCase()} Closed Chart</span>
              <span aria-hidden="true">·</span>
              <span>{signal.detectedPattern}</span>
              <span aria-hidden="true">·</span>
              <span>Recommended {signal.recommendedLeverage}x {signal.marginModeRecommendation}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-bold tracking-tight whitespace-nowrap shrink-0 ${actionSurface}`}
              >
                {isBuy && <TrendingUp className="w-4 h-4" />}
                {isSell && <TrendingDown className="w-4 h-4" />}
                {!isBuy && !isSell && <Minus className="w-4 h-4" />}
                {signal.action}
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {signal.headline}
              </h2>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {signal.summary}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto shrink-0">
            <button
              onClick={handleLockTradeNow}
              className="col-span-2 sm:col-span-1 justify-center px-4 py-2.5 sm:py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock {HORIZON_CONFIG[activeHorizon].shortLabel} Trade ({leverage}x)</span>
            </button>

            <button
              onClick={handleCopyLevels}
              className="justify-center px-4 py-2.5 sm:py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Order'}</span>
            </button>

            <button
              onClick={onSwitchToPro}
              className="justify-center px-4 py-2.5 sm:py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              Full Terminal
            </button>
          </div>
        </div>

        {/* Core 4 Price Columns */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="min-w-0">
            <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Stable Entry ({signal.timeframe} close)
            </span>
            <span className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1 block break-words">
              ${fPrice(signal.entryPrice)}
            </span>
            <span className="text-[11px] sm:text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1 block">
              {liveInZone
                ? `In Entry Zone ($${fCompact(signal.entryZone[0])}–$${fCompact(signal.entryZone[1])})`
                : `Live ${liveDiffFromEntry >= 0 ? '+' : ''}$${fCompact(Math.abs(liveDiffFromEntry))} vs Entry`}
            </span>
          </div>

          <div className="min-w-0">
            <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Take Profit 1 & 2 ({leverage}x ROE)
            </span>
            <span className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1 block break-words">
              ${fPrice(signal.takeProfit1)}
            </span>
            <span className="text-[11px] sm:text-xs font-mono tabular-nums text-emerald-600/85 dark:text-emerald-400/85 mt-1 inline-flex items-center gap-1 flex-wrap">
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              +{roeTp1Pct.toFixed(1)}% ROE · TP2 ${fCompact(signal.takeProfit2)}
            </span>
          </div>

          <div className="min-w-0">
            <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Stop Loss ({leverage}x Risk)
            </span>
            <span className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1 block break-words">
              ${fPrice(signal.stopLoss)}
            </span>
            <span className="text-[11px] sm:text-xs font-mono tabular-nums text-rose-600/85 dark:text-rose-400/85 mt-1 inline-flex items-center gap-1 flex-wrap">
              <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
              {signal.slPct}% spot ({roeSlPct.toFixed(1)}% ROE)
            </span>
          </div>

          <div className="min-w-0">
            <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Risk / Reward & {HORIZON_CONFIG[activeHorizon].shortLabel} Backtest
            </span>
            <span className={`text-lg sm:text-2xl font-bold font-mono tabular-nums mt-1 block ${actionText}`}>
              1 : {signal.riskRewardRatio}
            </span>
            <span className="text-[11px] sm:text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1 block">
              {signal.backtestTrades > 0
                ? `${signal.backtestWinRate}% historical win (${signal.backtestTrades} ${HORIZON_CONFIG[activeHorizon].shortLabel} trades)`
                : `${signal.confidenceScore}% model confidence`}
            </span>
          </div>
        </div>

        {/* Indicator Consensus Bar */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
            <span className="font-semibold text-slate-700 dark:text-slate-200 font-sans">
              All {signal.totalCriteria} Technical & Futures Criteria Consensus
            </span>
            <div className="flex items-center gap-4">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                {signal.bullishCount} Bullish
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {signal.neutralCount} Neutral
              </span>
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                {signal.bearishCount} Bearish
              </span>
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${bullPct}%` }} />
            <div className="h-full bg-slate-300 dark:bg-slate-600 transition-all duration-300" style={{ width: `${neutPct}%` }} />
            <div className="h-full bg-rose-500 transition-all duration-300" style={{ width: `${bearPct}%` }} />
          </div>
        </div>
      </section>

      {/* Leverage & Futures Risk Control Panel */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Futures Leverage & Liquidation Control
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Adjust leverage and margin mode to calibrate liquidation safety, required margin, and leveraged ROE
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Margin Mode Segmented Toggle */}
            <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              {(['Isolated', 'Cross'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setMarginMode(mode)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    marginMode === mode
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Leverage Quick Presets */}
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full sm:w-auto">
              {[3, 5, 10, 15, 20].map((lev) => (
                <button
                  key={lev}
                  onClick={() => setLeverage(lev)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    leverage === lev
                      ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {lev}x
                </button>
              ))}
              <button
                onClick={() => setLeverage(signal.recommendedLeverage)}
                className="px-2.5 py-1 rounded-md text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Safe ({signal.recommendedLeverage}x)
              </button>
            </div>
          </div>
        </div>

        {/* Slider + Core Futures Math */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono tabular-nums">
              <span className="font-sans font-semibold text-slate-700 dark:text-slate-200">
                Selected Leverage
              </span>
              <span className="text-base font-bold text-slate-900 dark:text-white">
                {leverage}x {marginMode}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex items-center gap-1.5 text-xs">
              {!isLiqSafe && !isLiqCaution && <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
              <span
                className={`font-medium ${
                  isLiqSafe
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : isLiqCaution
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {liqSafetyLabel}
              </span>
            </div>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono tabular-nums">
            <div>
              <span className="text-xs font-sans text-slate-500 dark:text-slate-400 block">
                Safe Leverage Range
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1 block">
                {signal.recommendedLeverage}x – {signal.maxSafeLeverage}x
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Calibrated to {Math.abs(signal.slPct)}% SL
              </span>
            </div>

            <div>
              <span className="text-xs font-sans text-slate-500 dark:text-slate-400 block">
                Est. Liquidation Price
              </span>
              <span
                className={`text-lg font-bold mt-1 block ${
                  isLiqSafe || isLiqCaution
                    ? 'text-slate-900 dark:text-slate-100'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {marginMode === 'Isolated' ? `$${fPrice(estLiquidationPrice)}` : 'Cross Wallet'}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                SL ${fPrice(signal.stopLoss)}
              </span>
            </div>

            <div>
              <span className="text-xs font-sans text-slate-500 dark:text-slate-400 block">
                Initial Margin Required
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1 block">
                ${requiredMargin.toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {marginUtilizationPct.toFixed(1)}% of ${accountEquity.toLocaleString()}
              </span>
            </div>

            <div>
              <span className="text-xs font-sans text-slate-500 dark:text-slate-400 block">
                Leveraged Notional
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1 block">
                ${notionalUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {positionQty.toFixed(qtyDecimals)} {baseAsset} contract
              </span>
            </div>
          </div>
        </div>

        {/* Live Binance USD-M Futures Telemetry Strip */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 font-mono tabular-nums text-xs">
          <div>
            <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400 block">
              Futures Mark Price
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
              {fm ? `$${fPrice(fm.markPrice)}` : 'Loading...'}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400 block">
              8h Funding Rate
            </span>
            <span
              className={`font-bold mt-0.5 block ${
                fm && fm.fundingRate > 0.0003
                  ? 'text-amber-600 dark:text-amber-400'
                  : fm && fm.fundingRate < 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {fm ? `${fm.fundingRate >= 0 ? '+' : ''}${(fm.fundingRate * 100).toFixed(4)}%` : '—'}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400 block">
              Open Interest
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
              {fm && fm.openInterestBtc > 0
                ? `${fm.openInterestBtc.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${baseAsset}`
                : '—'}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400 block">
              Long / Short Accounts
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
              {fm ? `${fm.longAccountPct.toFixed(0)}% L / ${fm.shortAccountPct.toFixed(0)}% S` : '—'}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400 block">
              Taker Buy / Sell Ratio
            </span>
            <span
              className={`font-bold mt-0.5 block ${
                fm && fm.takerBuySellRatio >= 1.08
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : fm && fm.takerBuySellRatio <= 0.92
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {fm ? `${fm.takerBuySellRatio.toFixed(2)}x` : '—'}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400 block">
              Next Funding / Impact
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
              {nextFundingStr} ({signal.estimatedFundingImpactPct >= 0 ? '+' : ''}{signal.estimatedFundingImpactPct}%)
            </span>
          </div>
        </div>
      </section>

      {/* All Time Ranges Comparison Matrix (1H, 2H, 5H, 10H, 24H) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              All Time Ranges Analysis (1h · 2h · 5h · 10h · 24h)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Each duration computes stable Entry, Take Profit, Stop Loss, and Safe Leverage from its previous closed chart
            </p>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Click any range to inspect full chart
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {TRADE_HORIZONS.map((h) => {
            const item = allHorizonSignals[h];
            const cfg = HORIZON_CONFIG[h];
            const isSelected = activeHorizon === h;
            const itemBuy = item?.action === 'BUY';
            const itemSell = item?.action === 'SELL';

            return (
              <button
                key={h}
                onClick={() => onSelectHorizon(h)}
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer space-y-2.5 ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/5 dark:bg-amber-500/10'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {cfg.label.replace(' Trade', '')}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {cfg.chartTf} · {item ? `${item.recommendedLeverage}x` : '—'}
                  </span>
                </div>

                {item ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold font-mono ${
                          itemBuy
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : itemSell
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {item.action}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        1:{item.riskRewardRatio} R:R
                      </span>
                    </div>

                    <div className="space-y-1 text-xs font-mono tabular-nums pt-1 border-t border-slate-200/70 dark:border-slate-800">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Entry</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          ${fPrice(item.entryPrice)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">TP1</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          ${fPrice(item.takeProfit1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">SL</span>
                        <span className="font-semibold text-rose-600 dark:text-rose-400">
                          ${fPrice(item.stopLoss)}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 pt-0.5">
                      {item.bullishCount}B / {item.bearishCount}S · {item.backtestWinRate}% win
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-400 py-4">Calculating...</div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Split Workspace: Chart + Complete Technical & Futures Criteria Scorecard */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Left: Interactive Chart with Entry / TP / SL Overlays */}
        <div className="xl:col-span-7 flex flex-col">
          <TradingChart
            candles={candles}
            timeframe={timeframe}
            onTimeframeChange={onTimeframeChange}
            indicators={indicators}
            activePrediction={activePrediction}
            signalSetup={signal}
            isDarkMode={isDarkMode}
            symbol={symbol}
            pricePrecision={decimals}
          />
        </div>

        {/* Right: All Technical & Futures Criteria + Quick Position Calculator */}
        <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  All Trading & Futures Criteria ({signal.totalCriteria})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Evaluated on closed {signal.timeframe} chart & Binance USD-M Futures data
                </p>
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                S ${fCompact(signal.swingSupport)} · R ${fCompact(signal.swingResistance)}
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
              {(['All', 'Trend', 'Momentum', 'Volatility', 'Volume', 'Chart Structure', 'Futures'] as CriteriaFilter[]).map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setCriteriaFilter(cat)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      criteriaFilter === cat
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>

            {/* Criteria Rows */}
            <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[360px] overflow-y-auto pr-1">
              {filteredCriteria.map((item) => {
                const isBull = item.signal === 'BULLISH';
                const isBear = item.signal === 'BEARISH';

                return (
                  <div key={item.id} className="py-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.name}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">·</span>
                        <span className="text-slate-500 dark:text-slate-400">{item.category}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {item.reason}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-bold font-mono ${
                          isBull
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isBear
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {item.signal === 'BULLISH' ? 'Bullish' : item.signal === 'BEARISH' ? 'Bearish' : 'Neutral'}
                      </span>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.value}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Position Size Calculator */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Futures Wallet Risk Calculator ({leverage}x)
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Stop Distance: ${fPrice(slDistance)} / {baseAsset}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                  Balance ($)
                </label>
                <input
                  type="number"
                  min="10"
                  value={accountEquity}
                  onChange={(e) => setAccountEquity(Math.max(10, parseFloat(e.target.value) || 0))}
                  className="w-full px-2.5 py-2 sm:py-1.5 text-base sm:text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                  Risk (%)
                </label>
                <input
                  type="number"
                  min="0.2"
                  max="10"
                  step="0.25"
                  value={riskPct}
                  onChange={(e) => setRiskPct(Math.max(0.1, parseFloat(e.target.value) || 1))}
                  className="w-full px-2.5 py-2 sm:py-1.5 text-base sm:text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                  Margin / Size
                </span>
                <div className="text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 pt-1">
                  ${requiredMargin.toFixed(0)} margin
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {positionQty.toFixed(qtyDecimals)} {baseAsset}
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                  Risk / TP1 Est.
                </span>
                <div className="text-xs font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400 pt-1">
                  -${dollarRisk.toFixed(2)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  +${potentialTp1Profit.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
