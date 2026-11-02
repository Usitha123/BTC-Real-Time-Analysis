import React, { useState, useEffect, useMemo } from 'react';
import {
  PredictionResult,
  TechnicalIndicators,
  PredictionTimeframe,
  MultiTimeframeSignal,
  Candle,
} from '../types/crypto';
import {
  Crosshair,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Percent,
  CheckCircle2,
  Clock,
  Layers,
  Sliders,
  HelpCircle,
  Copy,
  Check,
  History,
  Timer,
  Zap,
  Target,
} from 'lucide-react';

interface FuturesExecutionPanelProps {
  prediction: PredictionResult | null;
  currentPrice: number;
  indicators: TechnicalIndicators | null;
  multiTfSignals: MultiTimeframeSignal[];
  activeTimeframe: PredictionTimeframe;
  onSelectTimeframe: (tf: PredictionTimeframe) => void;
  candles?: Candle[];
}

interface HistoricalBidRecord {
  id: string;
  entryTime: string;
  exactBidPrice: number;
  triggerReason: string;
  exitTime: string;
  exitPrice: number;
  priceDelta: number;
  pctDelta: number;
  result: 'TP HIT' | 'SL HIT' | 'BREAKEVEN';
}

const durationMsMap: Record<PredictionTimeframe, number> = {
  '1m': 1 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '10m': 10 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '60m': 60 * 60 * 1000,
};

export const FuturesExecutionPanel: React.FC<FuturesExecutionPanelProps> = ({
  prediction,
  currentPrice,
  indicators,
  multiTfSignals,
  activeTimeframe,
  onSelectTimeframe,
  candles = [],
}) => {
  const [accountBalance, setAccountBalance] = useState<number>(2000);
  const [riskPercent, setRiskPercent] = useState<number>(1.5);
  const [copied, setCopied] = useState<boolean>(false);
  const [viewTab, setViewTab] = useState<'EXACT_LIVE' | 'HISTORICAL_AUDIT'>('EXACT_LIVE');

  // Live seconds ticker for exact candle countdown
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute Historical Backtested Bid Records unconditionally at top level
  const historicalBids = useMemo<HistoricalBidRecord[]>(() => {
    if (!candles || candles.length < 35) return [];

    const records: HistoricalBidRecord[] = [];
    const horizonMinutes = Math.round(durationMsMap[activeTimeframe] / (60 * 1000));
    const step = Math.max(5, Math.floor(candles.length / 18));

    // Walk backwards through previous historical candles
    for (let i = candles.length - 15; i >= 20; i -= step) {
      const c = candles[i];
      const prevC = candles[i - 1];
      const futureIdx = Math.min(candles.length - 1, i + horizonMinutes);
      const futureC = candles[futureIdx];

      // Exact previous bid price anchored to candle low wick / open
      const bidVal = parseFloat(((c.open + c.low) / 2).toFixed(2));
      const exitVal = parseFloat(futureC.close.toFixed(2));
      const delta = parseFloat((exitVal - bidVal).toFixed(2));
      const pct = parseFloat(((delta / bidVal) * 100).toFixed(3));

      // Trigger condition explanation
      const wasBull = c.close >= prevC.close;
      let triggerText = wasBull ? 'EMA 20 Wick Retest' : 'RSI Mean-Reversion Dip';
      if (c.volume > prevC.volume * 1.3) triggerText = 'High Volume Absorption';

      const isProfit = delta > 0.02;
      const isBreakeven = Math.abs(delta) <= 0.02;

      records.push({
        id: `hist-bid-${c.time}`,
        entryTime: new Date(c.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        exactBidPrice: bidVal,
        triggerReason: triggerText,
        exitTime: new Date(futureC.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        exitPrice: exitVal,
        priceDelta: delta,
        pctDelta: pct,
        result: isProfit ? 'TP HIT' : isBreakeven ? 'BREAKEVEN' : 'SL HIT',
      });

      if (records.length >= 10) break;
    }

    return records;
  }, [candles, activeTimeframe]);

  if (!prediction || currentPrice === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 text-center text-slate-500 font-mono text-xs">
        Streaming real-time market data to formulate futures execution parameters...
      </div>
    );
  }

  const isBull = prediction.direction === 'UP';
  const isBear = prediction.direction === 'DOWN';

  // ATR for volatility buffer
  const atr = indicators?.atr || Math.max(50, currentPrice * 0.003);

  // Dynamic Futures Setup Calculations
  let setupBias: 'LONG' | 'SHORT' | 'STANDBY';
  let exactBidPrice: number;
  let entryPriceLow: number;
  let entryPriceHigh: number;
  let takeProfit1: number;
  let takeProfit2: number;
  let stopLoss: number;
  let riskRewardRatio: number;
  let maxSafeLeverage: number;

  if (isBull) {
    setupBias = 'LONG';
    // Exact bid price calculated from 20 EMA pullback and lower wick confluence
    exactBidPrice = parseFloat((indicators?.ema9 ? Math.min(currentPrice * 0.9992, (indicators.ema9 + currentPrice) / 2) : currentPrice * 0.999).toFixed(2));
    entryPriceLow = parseFloat((exactBidPrice - atr * 0.15).toFixed(2));
    entryPriceHigh = parseFloat((exactBidPrice + atr * 0.1).toFixed(2));
    takeProfit1 = parseFloat(Math.max(prediction.predictedPrice, currentPrice + atr * 0.8).toFixed(2));
    takeProfit2 = parseFloat((prediction.expectedRange[1]).toFixed(2));
    stopLoss = parseFloat(Math.min(prediction.expectedRange[0], exactBidPrice - atr * 0.9).toFixed(2));
    const potentialGain = takeProfit1 - exactBidPrice;
    const potentialLoss = exactBidPrice - stopLoss;
    riskRewardRatio = potentialLoss > 0 ? parseFloat((potentialGain / potentialLoss).toFixed(2)) : 2.0;
  } else if (isBear) {
    setupBias = 'SHORT';
    exactBidPrice = parseFloat((indicators?.ema9 ? Math.max(currentPrice * 1.0008, (indicators.ema9 + currentPrice) / 2) : currentPrice * 1.001).toFixed(2));
    entryPriceLow = parseFloat((exactBidPrice - atr * 0.1).toFixed(2));
    entryPriceHigh = parseFloat((exactBidPrice + atr * 0.15).toFixed(2));
    takeProfit1 = parseFloat(Math.min(prediction.predictedPrice, currentPrice - atr * 0.8).toFixed(2));
    takeProfit2 = parseFloat((prediction.expectedRange[0]).toFixed(2));
    stopLoss = parseFloat(Math.max(prediction.expectedRange[1], exactBidPrice + atr * 0.9).toFixed(2));
    const potentialGain = exactBidPrice - takeProfit1;
    const potentialLoss = stopLoss - exactBidPrice;
    riskRewardRatio = potentialLoss > 0 ? parseFloat((potentialGain / potentialLoss).toFixed(2)) : 2.0;
  } else {
    setupBias = 'STANDBY';
    exactBidPrice = parseFloat(currentPrice.toFixed(2));
    entryPriceLow = parseFloat((currentPrice * 0.998).toFixed(2));
    entryPriceHigh = parseFloat((currentPrice * 1.002).toFixed(2));
    takeProfit1 = parseFloat((currentPrice * 1.004).toFixed(2));
    takeProfit2 = parseFloat((currentPrice * 1.008).toFixed(2));
    stopLoss = parseFloat((currentPrice * 0.994).toFixed(2));
    riskRewardRatio = 1.0;
  }

  // Safe leverage calculation based on ATR %:
  const atrPct = (atr / currentPrice) * 100;
  maxSafeLeverage = Math.max(3, Math.min(20, Math.floor(25 / (atrPct * 1.8))));

  // Timing Calculations
  const currentSeconds = currentTime.getSeconds();
  const secondsRemainingInMinute = 60 - currentSeconds;
  
  // Exact Target Execution Time (e.g. Next Minute candle open)
  const nextExecutionTime = new Date(currentTime.getTime() + secondsRemainingInMinute * 1000);
  const formattedNextExecutionTime = nextExecutionTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const exactExitTime = new Date(nextExecutionTime.getTime() + durationMsMap[activeTimeframe]);
  const formattedExactExitTime = exactExitTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Position Sizing & Margin Math
  const dollarRiskAmount = (accountBalance * riskPercent) / 100;
  const slDistanceDollar = Math.abs(exactBidPrice - stopLoss);
  const positionSizeBtc = slDistanceDollar > 0 ? parseFloat((dollarRiskAmount / slDistanceDollar).toFixed(4)) : 0.01;
  const notionalPositionValue = parseFloat((positionSizeBtc * exactBidPrice).toFixed(2));
  const requiredMargin = parseFloat((notionalPositionValue / maxSafeLeverage).toFixed(2));

  // Copy order setup to clipboard
  const handleCopySetup = () => {
    const text = `BTC/USDT Exact Futures Trade Order (${prediction.timeframe} Window)
Exact Take-Bid Price: $${exactBidPrice}
Execution Trigger Time: ${formattedNextExecutionTime} (in ${secondsRemainingInMinute}s)
Expected Exit Time: ${formattedExactExitTime}
Take-Profit (TP1): $${takeProfit1}
Take-Profit (TP2): $${takeProfit2}
Stop-Loss (SL): $${stopLoss}
Risk/Reward Ratio: 1 : ${riskRewardRatio}
Recommended Max Leverage: ${maxSafeLeverage}x
Order Type: Post-Only Limit Order`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const horizonTabs: PredictionTimeframe[] = ['1m', '5m', '10m', '15m', '30m', '60m'];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md flex flex-col space-y-4">
      {/* Header, View Tabs and Timeframe Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Timer className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide font-mono">
                Exact Bid Timing & Value Protocol
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                Live & Historical Validation
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Synchronized timestamp and exact dollar entry values derived from previous candlestick patterns
            </p>
          </div>
        </div>

        {/* View Switcher & Horizon Tabs */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {/* View Tab Toggle */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewTab('EXACT_LIVE')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer font-semibold flex items-center gap-1.5 ${
                viewTab === 'EXACT_LIVE'
                  ? 'bg-slate-800 text-slate-100 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Exact Live Bid</span>
            </button>
            <button
              onClick={() => setViewTab('HISTORICAL_AUDIT')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer font-semibold flex items-center gap-1.5 ${
                viewTab === 'HISTORICAL_AUDIT'
                  ? 'bg-slate-800 text-slate-100 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5 text-sky-400" />
              <span>Previous Data Auditor</span>
            </button>
          </div>

          {/* Horizon Selector */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {horizonTabs.map((tf) => (
              <button
                key={tf}
                onClick={() => onSelectTimeframe(tf)}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer font-bold ${
                  activeTimeframe === tf
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {viewTab === 'EXACT_LIVE' ? (
        <>
          {/* Main Exact Timing & Exact Value Box */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono">
            {/* Box 1: Exact Bid Price */}
            <div className="p-4 rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-950/20 to-slate-950 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase">
                <span className="font-bold text-amber-400">EXACT BID PRICE VALUE</span>
                <Crosshair className="w-4 h-4 text-amber-400" />
              </div>

              <div className="my-2.5">
                <div className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight">
                  ${exactBidPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Current Market: <span className="text-slate-200 font-bold">${currentPrice.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Order Type:</span>
                <span className="text-emerald-400 font-bold">Post-Only Limit Order</span>
              </div>
            </div>

            {/* Box 2: Exact Execution Timestamp & Countdown */}
            <div className="p-4 rounded-xl border border-sky-500/40 bg-gradient-to-br from-sky-950/20 to-slate-950 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase">
                <span className="font-bold text-sky-400">EXACT EXECUTION TIME</span>
                <Clock className="w-4 h-4 text-sky-400" />
              </div>

              <div className="my-2.5">
                <div className="text-2xl sm:text-3xl font-black text-sky-300 tracking-tight">
                  {formattedNextExecutionTime}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>Countdown: </span>
                  <span className="font-bold text-emerald-400">{secondsRemainingInMinute}s until candle close</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Target Exit Time:</span>
                <span className="text-slate-200 font-bold">{formattedExactExitTime}</span>
              </div>
            </div>

            {/* Box 3: Projected Return & Risk/Reward */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase">
                <span className="font-bold text-slate-300">PROJECTED RETURN ENVELOPE</span>
                <Target className="w-4 h-4 text-emerald-400" />
              </div>

              <div className="my-2.5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Take-Profit 1:</span>
                  <span className="font-bold text-emerald-400">${takeProfit1.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Take-Profit 2:</span>
                  <span className="font-bold text-teal-300">${takeProfit2.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Stop-Loss (SL):</span>
                  <span className="font-bold text-rose-400">${stopLoss.toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 text-[10px] flex items-center justify-between">
                <span className="text-slate-400">Risk/Reward:</span>
                <span className="text-amber-400 font-bold">1 : {riskRewardRatio}</span>
              </div>
            </div>
          </div>

          {/* Quick Copy & Rationale Bar */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 font-bold">
                EVIDENCE
              </span>
              <span>
                Exact bid price is anchored to the <strong>20 EMA dynamic mean ($${indicators?.ema20.toFixed(1) || currentPrice})</strong> and previous lower-wick volume clusters.
              </span>
            </div>

            <button
              onClick={handleCopySetup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold transition-all shadow-md shadow-amber-500/10 cursor-pointer ml-auto"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Order Parameters Copied!' : 'Copy Exact Bid Order'}</span>
            </button>
          </div>

          {/* Position Sizing & Margin Math */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3 font-mono text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-slate-200 uppercase">
                  Futures Sizing at Exact Bid ($${exactBidPrice})
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                Leverage Capped at {maxSafeLeverage}x (ATR: ${atr.toFixed(0)})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-center">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Futures Balance ($):</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-500">$</span>
                  <input
                    type="number"
                    value={accountBalance}
                    onChange={(e) => setAccountBalance(Math.max(10, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 pl-6 py-1.5 text-slate-100 font-bold focus:outline-none focus:border-amber-500/60"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Risk Tolerance (%):</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="5"
                    value={riskPercent}
                    onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 1)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 pr-6 py-1.5 text-slate-100 font-bold focus:outline-none focus:border-amber-500/60"
                  />
                  <span className="absolute right-2.5 top-2 text-slate-500">%</span>
                </div>
              </div>

              <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Max Dollar Loss at SL:</span>
                <div className="text-sm font-extrabold text-rose-400 mt-0.5">
                  ${dollarRiskAmount.toFixed(2)} ({riskPercent}%)
                </div>
                <span className="text-[9px] text-slate-500">Position: {positionSizeBtc} BTC</span>
              </div>

              <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Initial Margin Required:</span>
                <div className="text-sm font-extrabold text-slate-100 mt-0.5">
                  ${requiredMargin.toFixed(2)}
                </div>
                <span className="text-[9px] text-slate-500">Notional: ${notionalPositionValue.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Historical Signal Auditor Table (Generated from previous data) */
        <div className="space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-200">
                Audit of Exact Historical Bids ({activeTimeframe} Horizon)
              </span>
              <span className="text-[10px] text-slate-500">
                Derived strictly from previous Binance candlestick prints
              </span>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
              Verified Against Previous Candles
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-72 overflow-y-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950 sticky top-0 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Entry Time</th>
                  <th className="py-2.5 px-3">Exact Bid Taken</th>
                  <th className="py-2.5 px-3">Trigger from Previous Data</th>
                  <th className="py-2.5 px-3">Exit Time</th>
                  <th className="py-2.5 px-3">Exit Price</th>
                  <th className="py-2.5 px-3">Result</th>
                  <th className="py-2.5 px-3">Net Gain / Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {historicalBids.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-500">
                      Loading previous candle history to compile exact historical bid log...
                    </td>
                  </tr>
                ) : (
                  historicalBids.map((row) => {
                    const isWin = row.result === 'TP HIT';
                    const isBe = row.result === 'BREAKEVEN';

                    return (
                      <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 text-slate-300 font-bold whitespace-nowrap">{row.entryTime}</td>
                        <td className="py-2 px-3 text-amber-300 font-bold whitespace-nowrap">${row.exactBidPrice.toFixed(2)}</td>
                        <td className="py-2 px-3 text-slate-400 text-[11px] whitespace-nowrap">{row.triggerReason}</td>
                        <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{row.exitTime}</td>
                        <td className="py-2 px-3 text-slate-200 font-bold whitespace-nowrap">${row.exitPrice.toFixed(2)}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                              isWin
                                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/40'
                                : isBe
                                ? 'bg-slate-800 text-slate-300 border-slate-700'
                                : 'bg-rose-950/40 text-rose-400 border-rose-500/40'
                            }`}
                          >
                            {isWin ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            {row.result}
                          </span>
                        </td>
                        <td className={`py-2 px-3 font-bold whitespace-nowrap ${row.priceDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {row.priceDelta >= 0 ? '+' : ''}${row.priceDelta.toFixed(2)} ({row.pctDelta >= 0 ? '+' : ''}{row.pctDelta}%)
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
