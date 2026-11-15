import {
  Candle,
  TechnicalIndicators,
  MultiTimeframeSignal,
  ChartTimeframe,
  TradeHorizon,
  FuturesMarketMetrics,
  CriterionSignal,
  TechnicalCriterion,
} from '../types/crypto';
import {
  calculateAllIndicators,
  calculateATR,
  calculateEMA,
  calculateRSI,
} from './indicators';
import {
  getPriceDecimals,
  roundToPricePrecision,
  formatCoinPrice,
  formatCompactCoinPrice,
} from '../utils/formatters';

export type { CriterionSignal, TechnicalCriterion };

export type EntryStatus = 'ENTER_NOW' | 'WAIT_PULLBACK' | 'WAIT_BREAKOUT';

export interface HorizonMeta {
  horizon: TradeHorizon;
  label: string;
  shortLabel: string;
  chartTf: '15m' | '30m' | '1h' | '4h';
  horizonBars: number;
  durationMs: number;
  atrScale: number;
  swingLookback: number;
}

export const HORIZON_CONFIG: Record<TradeHorizon, HorizonMeta> = {
  '1h': {
    horizon: '1h',
    label: '1 Hour Trade',
    shortLabel: '1H',
    chartTf: '15m',
    horizonBars: 4,
    durationMs: 60 * 60 * 1000,
    atrScale: 1.0,
    swingLookback: 60,
  },
  '2h': {
    horizon: '2h',
    label: '2 Hours Trade',
    shortLabel: '2H',
    chartTf: '30m',
    horizonBars: 4,
    durationMs: 2 * 60 * 60 * 1000,
    atrScale: 1.15,
    swingLookback: 72,
  },
  '5h': {
    horizon: '5h',
    label: '5 Hours Trade',
    shortLabel: '5H',
    chartTf: '1h',
    horizonBars: 5,
    durationMs: 5 * 60 * 60 * 1000,
    atrScale: 1.4,
    swingLookback: 96,
  },
  '10h': {
    horizon: '10h',
    label: '10 Hours Trade',
    shortLabel: '10H',
    chartTf: '1h',
    horizonBars: 10,
    durationMs: 10 * 60 * 60 * 1000,
    atrScale: 1.9,
    swingLookback: 140,
  },
  '24h': {
    horizon: '24h',
    label: '24 Hours Trade',
    shortLabel: '24H',
    chartTf: '4h',
    horizonBars: 6,
    durationMs: 24 * 60 * 60 * 1000,
    atrScale: 1.7,
    swingLookback: 120,
  },
};

export const TRADE_HORIZONS: TradeHorizon[] = ['1h', '2h', '5h', '10h', '24h'];

export interface TradeSignalSetup {
  symbol: string;
  pricePrecision: number;
  horizon: TradeHorizon;
  horizonLabel: string;
  durationMs: number;
  action: 'BUY' | 'SELL' | 'WAIT';
  headline: string;
  timeframe: ChartTimeframe;
  referenceClosePrice: number;
  closedCandleTime: number;
  entryPrice: number;
  entryZone: [number, number];
  takeProfit1: number;
  takeProfit2: number;
  stopLoss: number;
  tp1Pct: number;
  tp2Pct: number;
  slPct: number;
  riskRewardRatio: number;
  swingSupport: number;
  swingResistance: number;
  pivotPoint: number;
  pivotR1: number;
  pivotS1: number;
  supertrendLevel: number;
  detectedPattern: string;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  totalCriteria: number;
  agreementPct: number;
  confidenceScore: number;
  backtestWinRate: number;
  backtestTrades: number;
  backtestAvgRR: number;
  recommendedLeverage: number;
  maxSafeLeverage: number;
  marginModeRecommendation: 'Isolated' | 'Cross';
  estimatedFundingImpactPct: number;
  futuresMetrics: FuturesMarketMetrics | null;
  summary: string;
  criteria: TechnicalCriterion[];
  generatedAt: number;
}

export function getStrictlyClosedCandles(candles: Candle[]): Candle[] {
  if (!candles || candles.length === 0) return [];
  const nowMs = Date.now();
  const hasCloseTime = candles.some((c) => typeof c.closeTime === 'number' && c.closeTime > 0);
  if (hasCloseTime) {
    const filtered = candles.filter((c) => !c.closeTime || c.closeTime <= nowMs);
    if (filtered.length >= 50) return filtered;
  }
  return candles.length > 50 ? candles.slice(0, -1) : candles;
}

function calculateSupertrend(
  closedCandles: Candle[],
  period: number = 10,
  multiplier: number = 3
): { direction: 'BULLISH' | 'BEARISH'; level: number } {
  if (closedCandles.length < period + 5) {
    const last = closedCandles[closedCandles.length - 1]?.close ?? 0;
    return { direction: 'BULLISH', level: last };
  }

  const atr = calculateATR(closedCandles, period);
  let upperBand = 0;
  let lowerBand = 0;
  let inUptrend = true;
  let supertrend = closedCandles[0].close;

  for (let i = period; i < closedCandles.length; i++) {
    const currAtr = isNaN(atr[i]) ? closedCandles[i].high - closedCandles[i].low : atr[i];
    const hl2 = (closedCandles[i].high + closedCandles[i].low) / 2;
    const basicUpper = hl2 + multiplier * currAtr;
    const basicLower = hl2 - multiplier * currAtr;

    if (i === period) {
      upperBand = basicUpper;
      lowerBand = basicLower;
      inUptrend = closedCandles[i].close >= hl2;
      supertrend = inUptrend ? lowerBand : upperBand;
      continue;
    }

    const prevClose = closedCandles[i - 1].close;
    upperBand = basicUpper < upperBand || prevClose > upperBand ? basicUpper : upperBand;
    lowerBand = basicLower > lowerBand || prevClose < lowerBand ? basicLower : lowerBand;

    if (inUptrend && closedCandles[i].close < lowerBand) {
      inUptrend = false;
      supertrend = upperBand;
    } else if (!inUptrend && closedCandles[i].close > upperBand) {
      inUptrend = true;
      supertrend = lowerBand;
    } else {
      supertrend = inUptrend ? lowerBand : upperBand;
    }
  }

  return {
    direction: inUptrend ? 'BULLISH' : 'BEARISH',
    level: supertrend,
  };
}

function calculateCCI(closedCandles: Candle[], period: number = 20): number {
  if (closedCandles.length < period) return 0;
  const slice = closedCandles.slice(-period);
  const tps = slice.map((c) => (c.high + c.low + c.close) / 3);
  const smaTp = tps.reduce((a, b) => a + b, 0) / period;
  const meanDev = tps.reduce((sum, tp) => sum + Math.abs(tp - smaTp), 0) / period;
  if (meanDev === 0) return 0;
  return (tps[tps.length - 1] - smaTp) / (0.015 * meanDev);
}

function detectCandlestickPattern(closedCandles: Candle[]): {
  name: string;
  signal: CriterionSignal;
  reason: string;
} {
  if (closedCandles.length < 5) {
    return { name: 'Consolidation', signal: 'NEUTRAL', reason: 'Insufficient closed bars for pattern scan' };
  }

  const curr = closedCandles[closedCandles.length - 1];
  const prev = closedCandles[closedCandles.length - 2];
  const prev2 = closedCandles[closedCandles.length - 3];

  const currBody = Math.abs(curr.close - curr.open);
  const currRange = Math.max(curr.close * 1e-6, curr.high - curr.low, 1e-10);
  const prevBody = Math.abs(prev.close - prev.open);
  const currIsBull = curr.close >= curr.open;
  const prevIsBull = prev.close >= prev.open;

  const upperWick = curr.high - Math.max(curr.open, curr.close);
  const lowerWick = Math.min(curr.open, curr.close) - curr.low;

  if (currIsBull && !prevIsBull && curr.close > prev.open && curr.open <= prev.close && currBody > prevBody * 1.05) {
    return {
      name: 'Bullish Engulfing',
      signal: 'BULLISH',
      reason: 'Last closed candle engulfed prior bearish body',
    };
  }

  if (!currIsBull && prevIsBull && curr.close < prev.open && curr.open >= prev.close && currBody > prevBody * 1.05) {
    return {
      name: 'Bearish Engulfing',
      signal: 'BEARISH',
      reason: 'Last closed candle engulfed prior bullish body',
    };
  }

  if (lowerWick > currBody * 2 && upperWick < currRange * 0.28) {
    return {
      name: 'Bullish Hammer / Pinbar',
      signal: 'BULLISH',
      reason: 'Long lower rejection wick absorbing sell pressure at support',
    };
  }

  if (upperWick > currBody * 2 && lowerWick < currRange * 0.28) {
    return {
      name: 'Bearish Shooting Star',
      signal: 'BEARISH',
      reason: 'Long upper rejection wick rejecting higher prices at resistance',
    };
  }

  if (curr.high > prev.high && prev.high > prev2.high && curr.low >= prev.low) {
    return {
      name: 'Higher-High Sequence',
      signal: 'BULLISH',
      reason: 'Consecutive higher highs with defended swing lows',
    };
  }

  if (curr.low < prev.low && prev.low < prev2.low && curr.high <= prev.high) {
    return {
      name: 'Lower-Low Sequence',
      signal: 'BEARISH',
      reason: 'Consecutive lower lows with sustained seller control',
    };
  }

  if (currBody / currRange > 0.68) {
    return {
      name: currIsBull ? 'Bullish Expansion Bar' : 'Bearish Expansion Bar',
      signal: currIsBull ? 'BULLISH' : 'BEARISH',
      reason: `Strong closed candle body closing near ${currIsBull ? 'high' : 'low'}`,
    };
  }

  return {
    name: 'Inside Range Compression',
    signal: 'NEUTRAL',
    reason: 'Last closed candle compressed within prior bar range',
  };
}

function findPreviousChartSwingsAndPivots(
  closedCandles: Candle[],
  referencePrice: number,
  lookbackCount: number,
  decimals: number
): {
  swingSupport: number;
  swingResistance: number;
  pivotPoint: number;
  pivotR1: number;
  pivotR2: number;
  pivotS1: number;
  pivotS2: number;
  nearestStructureSignal: CriterionSignal;
  reason: string;
} {
  const lookback = closedCandles.slice(-lookbackCount);
  if (lookback.length < 15) {
    return {
      swingSupport: referencePrice * 0.99,
      swingResistance: referencePrice * 1.01,
      pivotPoint: referencePrice,
      pivotR1: referencePrice * 1.008,
      pivotR2: referencePrice * 1.016,
      pivotS1: referencePrice * 0.992,
      pivotS2: referencePrice * 0.984,
      nearestStructureSignal: 'NEUTRAL',
      reason: 'Waiting for wider closed-candle swing history',
    };
  }

  const pivotWindow = lookback.slice(-Math.min(24, lookback.length));
  const pHigh = Math.max(...pivotWindow.map((c) => c.high));
  const pLow = Math.min(...pivotWindow.map((c) => c.low));
  const pClose = pivotWindow[pivotWindow.length - 1].close;
  const pivotPoint = (pHigh + pLow + pClose) / 3;
  const pivotR1 = 2 * pivotPoint - pLow;
  const pivotS1 = 2 * pivotPoint - pHigh;
  const pivotR2 = pivotPoint + (pHigh - pLow);
  const pivotS2 = pivotPoint - (pHigh - pLow);

  const swingHighs: number[] = [];
  const swingLows: number[] = [];

  for (let i = 2; i < lookback.length - 2; i++) {
    const h = lookback[i].high;
    const l = lookback[i].low;
    if (
      h >= lookback[i - 1].high &&
      h >= lookback[i - 2].high &&
      h >= lookback[i + 1].high &&
      h >= lookback[i + 2].high
    ) {
      swingHighs.push(h);
    }
    if (
      l <= lookback[i - 1].low &&
      l <= lookback[i - 2].low &&
      l <= lookback[i + 1].low &&
      l <= lookback[i + 2].low
    ) {
      swingLows.push(l);
    }
  }

  const resistancesAbove = swingHighs.filter((h) => h > referencePrice * 1.0005).sort((a, b) => a - b);
  const supportsBelow = swingLows.filter((l) => l < referencePrice * 0.9995).sort((a, b) => b - a);

  const highestRecent = Math.max(...lookback.map((c) => c.high));
  const lowestRecent = Math.min(...lookback.map((c) => c.low));

  const swingResistance =
    resistancesAbove[0] ?? (highestRecent > referencePrice ? highestRecent : Math.max(pivotR1, referencePrice * 1.01));
  const swingSupport =
    supportsBelow[0] ?? (lowestRecent < referencePrice ? lowestRecent : Math.min(pivotS1, referencePrice * 0.99));

  const distToSupport = (referencePrice - swingSupport) / referencePrice;
  const distToResistance = (swingResistance - referencePrice) / referencePrice;

  const fp = (v: number) => formatCompactCoinPrice(v, referencePrice, decimals);

  let nearestStructureSignal: CriterionSignal = 'NEUTRAL';
  let reason = `Pivot $${fp(pivotPoint)} · Support $${fp(swingSupport)} / Resistance $${fp(swingResistance)}`;

  if (referencePrice > pivotPoint && distToSupport < distToResistance * 0.9) {
    nearestStructureSignal = 'BULLISH';
    reason = `Above Pivot $${fp(pivotPoint)} with support floor $${fp(swingSupport)}`;
  } else if (referencePrice < pivotPoint && distToResistance < distToSupport * 0.9) {
    nearestStructureSignal = 'BEARISH';
    reason = `Below Pivot $${fp(pivotPoint)} with resistance ceiling $${fp(swingResistance)}`;
  }

  return {
    swingSupport,
    swingResistance,
    pivotPoint,
    pivotR1,
    pivotR2,
    pivotS1,
    pivotS2,
    nearestStructureSignal,
    reason,
  };
}

// Empirical historical backtest tailored to the exact holding horizon (e.g. 5 bars on 1h for 5H trade)
function runHorizonSetupBacktest(
  closedCandles: Candle[],
  horizonBars: number,
  atrScale: number
): {
  winRate: number;
  trades: number;
  avgRR: number;
} {
  if (closedCandles.length < 70) {
    return { winRate: 0, trades: 0, avgRR: 1.6 };
  }

  const closes = closedCandles.map((c) => c.close);
  const ema9 = calculateEMA(closes, 9);
  const ema20 = calculateEMA(closes, 20);
  const rsi = calculateRSI(closes, 14);
  const atr = calculateATR(closedCandles, 14);

  let wins = 0;
  let losses = 0;
  let totalRR = 0;

  let i = 30;
  while (i < closedCandles.length - horizonBars) {
    const c = closes[i];
    const e9 = ema9[i];
    const e20 = ema20[i];
    const r = rsi[i];
    const a = atr[i];

    if (isNaN(e9) || isNaN(e20) || isNaN(r) || isNaN(a) || a <= 0) {
      i++;
      continue;
    }

    const bullTrigger = c > e20 && e9 > e20 && r > 52 && r < 72;
    const bearTrigger = c < e20 && e9 < e20 && r < 48 && r > 28;

    if (!bullTrigger && !bearTrigger) {
      i++;
      continue;
    }

    const slDist = a * 1.15 * atrScale;
    const tpDist = a * 1.85 * atrScale;

    let resolved = false;
    for (let j = i + 1; j <= Math.min(i + horizonBars, closedCandles.length - 1); j++) {
      if (bullTrigger) {
        if (closedCandles[j].low <= c - slDist) {
          losses++;
          resolved = true;
          i = j + 1;
          break;
        }
        if (closedCandles[j].high >= c + tpDist) {
          wins++;
          totalRR += tpDist / slDist;
          resolved = true;
          i = j + 1;
          break;
        }
      } else {
        if (closedCandles[j].high >= c + slDist) {
          losses++;
          resolved = true;
          i = j + 1;
          break;
        }
        if (closedCandles[j].low <= c - tpDist) {
          wins++;
          totalRR += tpDist / slDist;
          resolved = true;
          i = j + 1;
          break;
        }
      }
    }

    if (!resolved) {
      // Closed at exact end of holding horizon (e.g. after 5 hours)
      const finalClose = closedCandles[Math.min(i + horizonBars, closedCandles.length - 1)].close;
      const pnl = bullTrigger ? finalClose - c : c - finalClose;
      if (pnl > 0) {
        wins++;
        totalRR += pnl / slDist;
      } else {
        losses++;
      }
      i += horizonBars;
    }
  }

  const trades = wins + losses;
  return {
    winRate: trades > 0 ? Math.round((wins / trades) * 100) : 0,
    trades,
    avgRR: wins > 0 ? parseFloat((totalRR / wins).toFixed(2)) : 1.6,
  };
}

/**
 * Computes a rock-solid, zero-flicker trade plan exclusively from CLOSED historical chart candles
 * for a chosen TradeHorizon ('1h', '2h', '5h', '10h', '24h').
 */
export function analyzeHorizonTradeSetup(
  rawCandles: Candle[],
  horizon: TradeHorizon,
  multiTfSignals: MultiTimeframeSignal[],
  futuresMetrics: FuturesMarketMetrics | null = null,
  symbol: string = 'BTCUSDT',
  pricePrecision?: number
): TradeSignalSetup | null {
  const meta = HORIZON_CONFIG[horizon];
  const closedCandles = getStrictlyClosedCandles(rawCandles);
  if (closedCandles.length < 50) return null;

  const indicators: TechnicalIndicators | null = calculateAllIndicators(closedCandles);
  if (!indicators) return null;

  const lastClosed = closedCandles[closedCandles.length - 1];
  const referencePrice = lastClosed.close;
  if (referencePrice <= 0) return null;

  const decimals = getPriceDecimals(referencePrice, pricePrecision);
  const rp = (v: number) => roundToPricePrecision(v, referencePrice, decimals);
  const fp = (v: number) => formatCompactCoinPrice(v, referencePrice, decimals);
  const fFull = (v: number) => formatCoinPrice(v, referencePrice, decimals);
  const histDecimals = Math.max(2, decimals);

  const criteria: TechnicalCriterion[] = [];

  // 1. Short/Mid EMA Stack (EMA 9, 20, 50)
  const bullEmaStack =
    referencePrice > indicators.ema20 && indicators.ema9 > indicators.ema20 && indicators.ema20 > indicators.ema50;
  const bearEmaStack =
    referencePrice < indicators.ema20 && indicators.ema9 < indicators.ema20 && indicators.ema20 < indicators.ema50;
  const emaSignal: CriterionSignal = bullEmaStack
    ? 'BULLISH'
    : bearEmaStack
    ? 'BEARISH'
    : referencePrice > indicators.ema20
    ? 'BULLISH'
    : referencePrice < indicators.ema20
    ? 'BEARISH'
    : 'NEUTRAL';

  criteria.push({
    id: 'ema_stack',
    name: 'EMA Stack (9 / 20 / 50)',
    category: 'Trend',
    value: `EMA9 $${fp(indicators.ema9)} · EMA20 $${fp(indicators.ema20)}`,
    signal: emaSignal,
    weight: 1.5,
    reason: bullEmaStack
      ? 'Full bullish cascade: Close > EMA9 > EMA20 > EMA50'
      : bearEmaStack
      ? 'Full bearish cascade: Close < EMA9 < EMA20 < EMA50'
      : referencePrice > indicators.ema20
      ? 'Closed above EMA 20 dynamic support'
      : 'Closed below EMA 20 dynamic resistance',
  });

  // 2. Macro Moving Averages (EMA 100, EMA 200, SMA 20/50)
  const aboveMacro = referencePrice > indicators.ema100 && referencePrice > indicators.ema200;
  const belowMacro = referencePrice < indicators.ema100 && referencePrice < indicators.ema200;
  const smaCrossBull = indicators.sma20 > indicators.sma50;
  const macroSignal: CriterionSignal =
    aboveMacro && smaCrossBull ? 'BULLISH' : belowMacro && !smaCrossBull ? 'BEARISH' : 'NEUTRAL';

  criteria.push({
    id: 'macro_ma',
    name: 'Macro MAs (EMA 100/200 & SMA 20/50)',
    category: 'Trend',
    value: `EMA200 $${fp(indicators.ema200)}`,
    signal: macroSignal,
    weight: 1.2,
    reason:
      macroSignal === 'BULLISH'
        ? 'Above EMA 100/200 with SMA 20 > SMA 50'
        : macroSignal === 'BEARISH'
        ? 'Below EMA 100/200 with SMA 20 < SMA 50'
        : 'Mixed macro moving average alignment',
  });

  // 3. Supertrend (10, 3)
  const supertrend = calculateSupertrend(closedCandles, 10, 3);
  criteria.push({
    id: 'supertrend',
    name: 'Supertrend (10, 3)',
    category: 'Trend',
    value: `Stop $${fp(supertrend.level)}`,
    signal: supertrend.direction,
    weight: 1.4,
    reason:
      supertrend.direction === 'BULLISH'
        ? `Uptrend confirmed with trailing Supertrend floor at $${fp(supertrend.level)}`
        : `Downtrend confirmed with trailing Supertrend ceiling at $${fp(supertrend.level)}`,
  });

  // 4. MACD (12, 26, 9)
  const macdBull = indicators.macd.macd > indicators.macd.signal && indicators.macd.hist > 0;
  const macdBear = indicators.macd.macd < indicators.macd.signal && indicators.macd.hist < 0;
  criteria.push({
    id: 'macd',
    name: 'MACD (12, 26, 9)',
    category: 'Trend',
    value: `Hist ${indicators.macd.hist >= 0 ? '+' : ''}${indicators.macd.hist.toFixed(histDecimals)}`,
    signal: macdBull ? 'BULLISH' : macdBear ? 'BEARISH' : 'NEUTRAL',
    weight: 1.3,
    reason: macdBull
      ? 'MACD above signal line with positive momentum histogram'
      : macdBear
      ? 'MACD below signal line with negative momentum histogram'
      : 'MACD converging near trigger line',
  });

  // 5. Wilder ADX (14)
  const adxStrong = indicators.adx.adx >= 20;
  const adxSignal: CriterionSignal = adxStrong
    ? indicators.adx.pDi > indicators.adx.mDi
      ? 'BULLISH'
      : 'BEARISH'
    : 'NEUTRAL';
  criteria.push({
    id: 'adx',
    name: 'ADX Directional Strength (14)',
    category: 'Trend',
    value: `ADX ${indicators.adx.adx.toFixed(1)} (+${indicators.adx.pDi.toFixed(0)}/-${indicators.adx.mDi.toFixed(0)})`,
    signal: adxSignal,
    weight: 1.1,
    reason: adxStrong
      ? `Active directional trend (+DI ${indicators.adx.pDi.toFixed(1)} vs -DI ${indicators.adx.mDi.toFixed(1)})`
      : 'ADX < 20 signals weak trend / ranging consolidation',
  });

  // 6. RSI (14)
  let rsiSignal: CriterionSignal = 'NEUTRAL';
  let rsiReason = 'RSI in neutral 46–54 equilibrium zone';
  if (indicators.rsi <= 32) {
    rsiSignal = 'BULLISH';
    rsiReason = 'Oversold extreme (<32) favoring bullish rebound';
  } else if (indicators.rsi >= 72) {
    rsiSignal = 'BEARISH';
    rsiReason = 'Overbought stretch (>72) raising pullback risk';
  } else if (indicators.rsi > 54) {
    rsiSignal = 'BULLISH';
    rsiReason = 'Sustained buyer momentum (>54)';
  } else if (indicators.rsi < 46) {
    rsiSignal = 'BEARISH';
    rsiReason = 'Sustained seller momentum (<46)';
  }
  criteria.push({
    id: 'rsi',
    name: 'RSI Momentum (14)',
    category: 'Momentum',
    value: `${indicators.rsi.toFixed(1)}`,
    signal: rsiSignal,
    weight: 1.3,
    reason: rsiReason,
  });

  // 7. Stochastic RSI (14, 3, 3)
  const sRsiBull =
    indicators.stochRsi.k < 25 ||
    (indicators.stochRsi.k > indicators.stochRsi.d && indicators.stochRsi.k < 80);
  const sRsiBear =
    indicators.stochRsi.k > 80 ||
    (indicators.stochRsi.k < indicators.stochRsi.d && indicators.stochRsi.k > 20);
  const stochRsiSig: CriterionSignal = sRsiBull && !sRsiBear ? 'BULLISH' : sRsiBear && !sRsiBull ? 'BEARISH' : 'NEUTRAL';

  criteria.push({
    id: 'stoch_rsi',
    name: 'Stochastic RSI (14, 3, 3)',
    category: 'Momentum',
    value: `K ${indicators.stochRsi.k.toFixed(0)} · D ${indicators.stochRsi.d.toFixed(0)}`,
    signal: stochRsiSig,
    weight: 1.0,
    reason:
      stochRsiSig === 'BULLISH'
        ? 'Fast %K crossed above %D or rebounding from oversold'
        : stochRsiSig === 'BEARISH'
        ? 'Fast %K crossed below %D or turning down from overbought'
        : 'Stoch RSI mid-range neutral cross',
  });

  // 8. Classic Stochastic Oscillator (14, 3, 3)
  const stochOscBull =
    indicators.stochOsc.k < 25 || (indicators.stochOsc.k > indicators.stochOsc.d && indicators.stochOsc.k < 78);
  const stochOscBear =
    indicators.stochOsc.k > 80 || (indicators.stochOsc.k < indicators.stochOsc.d && indicators.stochOsc.k > 22);
  const stochOscSig: CriterionSignal =
    stochOscBull && !stochOscBear ? 'BULLISH' : stochOscBear && !stochOscBull ? 'BEARISH' : 'NEUTRAL';

  criteria.push({
    id: 'stoch_osc',
    name: 'Stochastic Oscillator (14, 3, 3)',
    category: 'Momentum',
    value: `%K ${indicators.stochOsc.k.toFixed(0)} · %D ${indicators.stochOsc.d.toFixed(0)}`,
    signal: stochOscSig,
    weight: 0.9,
    reason:
      stochOscSig === 'BULLISH'
        ? 'Price closing near upper range (%K > %D)'
        : stochOscSig === 'BEARISH'
        ? 'Price closing near lower range (%K < %D)'
        : 'Balanced stochastic oscillator position',
  });

  // 9. CCI (20) & Rate of Change (ROC 12)
  const cci = calculateCCI(closedCandles, 20);
  const cciRocBull = (cci > 50 || cci < -120) && indicators.roc > 0;
  const cciRocBear = (cci < -50 || cci > 120) && indicators.roc < 0;
  const cciRocSig: CriterionSignal = cciRocBull ? 'BULLISH' : cciRocBear ? 'BEARISH' : cci > 100 ? 'BULLISH' : cci < -100 ? 'BEARISH' : 'NEUTRAL';

  criteria.push({
    id: 'cci_roc',
    name: 'CCI (20) & Rate of Change (12)',
    category: 'Momentum',
    value: `CCI ${cci.toFixed(0)} · ROC ${indicators.roc >= 0 ? '+' : ''}${indicators.roc.toFixed(2)}%`,
    signal: cciRocSig,
    weight: 1.0,
    reason:
      cciRocSig === 'BULLISH'
        ? 'Positive price impulse velocity above statistical mean'
        : cciRocSig === 'BEARISH'
        ? 'Negative price impulse velocity below statistical mean'
        : 'CCI and ROC inside neutral band',
  });

  // 10. Bollinger Bands (20, 2)
  let bbSignal: CriterionSignal = 'NEUTRAL';
  let bbReason = `Trading cleanly inside Bollinger envelope (%B ${(indicators.bollinger.percentB * 100).toFixed(0)}%)`;
  if (indicators.bollinger.percentB < 0.18) {
    bbSignal = 'BULLISH';
    bbReason = `Testing lower 2σ statistical band ($${fp(indicators.bollinger.lower)})`;
  } else if (indicators.bollinger.percentB > 0.88) {
    bbSignal = 'BEARISH';
    bbReason = `Extended against upper 2σ band ($${fp(indicators.bollinger.upper)})`;
  } else if (indicators.bollinger.percentB > 0.56) {
    bbSignal = 'BULLISH';
    bbReason = `Sustaining above Bollinger midline ($${fp(indicators.bollinger.middle)})`;
  } else if (indicators.bollinger.percentB < 0.44) {
    bbSignal = 'BEARISH';
    bbReason = `Pressured below Bollinger midline ($${fp(indicators.bollinger.middle)})`;
  }
  criteria.push({
    id: 'bollinger',
    name: 'Bollinger Bands (20, 2σ)',
    category: 'Volatility',
    value: `%B ${(indicators.bollinger.percentB * 100).toFixed(0)}% · Width ${(indicators.bollinger.bandWidth * 100).toFixed(2)}%`,
    signal: bbSignal,
    weight: 1.0,
    reason: bbReason,
  });

  // 11. ATR (14) & Historical Volatility Regime
  const atrPct = (indicators.atr / referencePrice) * 100;
  const volRegimeHealthy = atrPct >= 0.08 && atrPct <= 2.2;
  criteria.push({
    id: 'atr_hv',
    name: 'ATR (14) & Historical Volatility',
    category: 'Volatility',
    value: `ATR $${fFull(indicators.atr)} (${atrPct.toFixed(2)}%)`,
    signal: volRegimeHealthy ? (emaSignal !== 'NEUTRAL' ? emaSignal : 'NEUTRAL') : 'NEUTRAL',
    weight: 0.7,
    reason: volRegimeHealthy
      ? `Stable volatility window (${indicators.histVol.toFixed(1)}% annualized HV)`
      : `Elevated volatility (${indicators.histVol.toFixed(1)}% HV) — wider stops applied`,
  });

  // 12. Session VWAP Benchmark
  const aboveVwap = referencePrice > indicators.vwap;
  const vwapDeltaPct = ((referencePrice - indicators.vwap) / indicators.vwap) * 100;
  criteria.push({
    id: 'vwap',
    name: 'VWAP Fair Value Benchmark',
    category: 'Volume',
    value: `$${fp(indicators.vwap)} (${vwapDeltaPct >= 0 ? '+' : ''}${vwapDeltaPct.toFixed(2)}%)`,
    signal: Math.abs(vwapDeltaPct) < 0.03 ? 'NEUTRAL' : aboveVwap ? 'BULLISH' : 'BEARISH',
    weight: 1.3,
    reason: aboveVwap
      ? 'Closed above volume-weighted fair value'
      : 'Closed below volume-weighted fair value',
  });

  // 13. OBV & Volume SMA Ratio
  const obvBull = indicators.interpretations['OBV']?.signal === 'BULLISH';
  const highVolumeConfirm = indicators.volumeRatio >= 1.05;
  const obvSig: CriterionSignal =
    obvBull && highVolumeConfirm ? 'BULLISH' : !obvBull && highVolumeConfirm ? 'BEARISH' : obvBull ? 'BULLISH' : 'BEARISH';

  criteria.push({
    id: 'obv_volume',
    name: 'OBV & Volume Ratio (20-SMA)',
    category: 'Volume',
    value: `${(indicators.volumeRatio * 100).toFixed(0)}% Vol · OBV ${obvBull ? 'Up' : 'Down'}`,
    signal: obvSig,
    weight: 1.1,
    reason: obvBull
      ? `On-Balance Volume accumulating (${(indicators.volumeRatio * 100).toFixed(0)}% of 20-bar avg)`
      : `On-Balance Volume distributing (${(indicators.volumeRatio * 100).toFixed(0)}% of 20-bar avg)`,
  });

  // 14. Previous Chart Swings & Floor Pivots
  const swings = findPreviousChartSwingsAndPivots(closedCandles, referencePrice, meta.swingLookback, decimals);
  criteria.push({
    id: 'chart_swings',
    name: 'Previous Swings & Floor Pivots',
    category: 'Chart Structure',
    value: `S $${fp(swings.swingSupport)} · R $${fp(swings.swingResistance)}`,
    signal: swings.nearestStructureSignal,
    weight: 1.4,
    reason: swings.reason,
  });

  // 15. Closed Candlestick Structure
  const pattern = detectCandlestickPattern(closedCandles);
  criteria.push({
    id: 'candle_pattern',
    name: 'Closed Candlestick Action',
    category: 'Chart Structure',
    value: pattern.name,
    signal: pattern.signal,
    weight: 1.1,
    reason: pattern.reason,
  });

  // 16. Multi-Timeframe Confluence (1m–1d)
  const mtfBull = multiTfSignals.filter((s) => s.trend === 'BULLISH').length;
  const mtfBear = multiTfSignals.filter((s) => s.trend === 'BEARISH').length;
  const mtfSignal: CriterionSignal = mtfBull >= 4 ? 'BULLISH' : mtfBear >= 4 ? 'BEARISH' : 'NEUTRAL';
  criteria.push({
    id: 'multi_tf',
    name: 'Multi-Timeframe Confluence (1m–1d)',
    category: 'Chart Structure',
    value: `${mtfBull} Bull · ${mtfBear} Bear`,
    signal: mtfSignal,
    weight: 1.5,
    reason:
      mtfSignal === 'BULLISH'
        ? `${mtfBull} of ${multiTfSignals.length || 7} horizons aligned bullish`
        : mtfSignal === 'BEARISH'
        ? `${mtfBear} of ${multiTfSignals.length || 7} horizons aligned bearish`
        : 'Higher and lower horizons showing mixed alignment',
  });

  // 17–20. Perpetual Futures Trading Criteria (Binance USD-M Live Telemetry)
  if (futuresMetrics) {
    const fundingPct = futuresMetrics.fundingRate * 100;
    let fundingSig: CriterionSignal = 'NEUTRAL';
    let fundingReason = `Neutral 8h perpetual funding (${fundingPct >= 0 ? '+' : ''}${fundingPct.toFixed(4)}%)`;
    if (fundingPct > 0.035) {
      fundingSig = 'BEARISH';
      fundingReason = `Elevated positive funding (+${fundingPct.toFixed(4)}%) warns of crowded long squeeze`;
    } else if (fundingPct < -0.01) {
      fundingSig = 'BULLISH';
      fundingReason = `Negative funding (${fundingPct.toFixed(4)}%) indicates short crowding & rebound fuel`;
    }
    criteria.push({
      id: 'futures_funding',
      name: 'Perpetual Funding Rate (8h)',
      category: 'Futures',
      value: `${fundingPct >= 0 ? '+' : ''}${fundingPct.toFixed(4)}%`,
      signal: fundingSig,
      weight: 1.0,
      reason: fundingReason,
    });

    const basisPct = futuresMetrics.basisPct;
    const basisSig: CriterionSignal = basisPct > 0.03 ? 'BULLISH' : basisPct < -0.03 ? 'BEARISH' : 'NEUTRAL';
    criteria.push({
      id: 'futures_basis',
      name: 'Mark-to-Index Futures Basis',
      category: 'Futures',
      value: `${basisPct >= 0 ? '+' : ''}${basisPct.toFixed(3)}%`,
      signal: basisSig,
      weight: 0.9,
      reason:
        basisSig === 'BULLISH'
          ? 'Futures trading at contango premium over spot index'
          : basisSig === 'BEARISH'
          ? 'Futures trading at backwardation discount vs spot index'
          : 'Mark and index prices tightly aligned near parity',
    });

    const lsRatio = futuresMetrics.longShortRatio;
    const lsSig: CriterionSignal = lsRatio > 2.2 ? 'BEARISH' : lsRatio < 0.85 ? 'BULLISH' : 'NEUTRAL';
    criteria.push({
      id: 'futures_ls_ratio',
      name: 'Global Long/Short Account Ratio',
      category: 'Futures',
      value: `${lsRatio.toFixed(2)} (${futuresMetrics.longAccountPct.toFixed(0)}%L / ${futuresMetrics.shortAccountPct.toFixed(0)}%S)`,
      signal: lsSig,
      weight: 0.9,
      reason:
        lsSig === 'BEARISH'
          ? `Retail accounts heavily skewed Long (${futuresMetrics.longAccountPct.toFixed(0)}%) — long-flush risk`
          : lsSig === 'BULLISH'
          ? `Retail accounts skewed Short (${futuresMetrics.shortAccountPct.toFixed(0)}%) — short-squeeze potential`
          : 'Balanced global futures account positioning',
    });

    const takerRatio = futuresMetrics.takerBuySellRatio;
    const takerSig: CriterionSignal = takerRatio >= 1.1 ? 'BULLISH' : takerRatio <= 0.9 ? 'BEARISH' : 'NEUTRAL';
    criteria.push({
      id: 'futures_taker',
      name: 'Futures Taker Buy/Sell Volume',
      category: 'Futures',
      value: `${takerRatio.toFixed(2)}x Buy/Sell`,
      signal: takerSig,
      weight: 1.2,
      reason:
        takerSig === 'BULLISH'
          ? `Aggressive futures market buyers leading (${takerRatio.toFixed(2)}x taker ratio)`
          : takerSig === 'BEARISH'
          ? `Aggressive futures market sellers leading (${takerRatio.toFixed(2)}x taker ratio)`
          : 'Balanced futures taker market order flow',
    });
  }

  // Weighted Score Aggregation
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;
  let weightedScore = 0;
  let maxPossibleWeight = 0;

  for (const c of criteria) {
    maxPossibleWeight += c.weight;
    if (c.signal === 'BULLISH') {
      bullishCount++;
      weightedScore += c.weight;
    } else if (c.signal === 'BEARISH') {
      bearishCount++;
      weightedScore -= c.weight;
    } else {
      neutralCount++;
    }
  }

  const normalizedScore = maxPossibleWeight > 0 ? weightedScore / maxPossibleWeight : 0;

  let action: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
  if (normalizedScore >= 0.14 && bullishCount >= bearishCount + 2) {
    action = 'BUY';
  } else if (normalizedScore <= -0.14 && bearishCount >= bullishCount + 2) {
    action = 'SELL';
  }

  // Horizon-scaled ATR for realistic 1H / 2H / 5H / 10H / 24H Stop Loss and Take Profit distances
  const baseAtr = Math.max(indicators.atr, referencePrice * 0.0015);
  const horizonAtr = baseAtr * meta.atrScale;

  let entryPrice = referencePrice;
  let entryZone: [number, number] = [referencePrice * 0.999, referencePrice * 1.001];
  let takeProfit1 = referencePrice;
  let takeProfit2 = referencePrice;
  let stopLoss = referencePrice;

  if (action === 'BUY') {
    const pullbackRef = Math.max(
      swings.swingSupport + horizonAtr * 0.25,
      Math.min(referencePrice, referencePrice * 0.55 + indicators.ema9 * 0.25 + indicators.vwap * 0.2)
    );
    entryPrice = rp(pullbackRef);
    entryZone = [rp(entryPrice - baseAtr * 0.25), rp(entryPrice + baseAtr * 0.25)];

    const structuralFloor = Math.min(swings.swingSupport, swings.pivotS1);
    const rawStop = Math.min(structuralFloor - baseAtr * 0.3, entryPrice - horizonAtr * 1.15);
    const maxStopCap = entryPrice - horizonAtr * 2.3;
    stopLoss = rp(Math.max(maxStopCap, rawStop));
    const riskDist = Math.max(horizonAtr * 0.85, entryPrice - stopLoss);

    const candidateTp1 = Math.max(swings.swingResistance, swings.pivotR1, indicators.bollinger.upper);
    const boundedTp1 =
      candidateTp1 >= entryPrice + riskDist * 1.45
        ? Math.min(candidateTp1, entryPrice + riskDist * 2.2)
        : entryPrice + riskDist * 1.7;
    takeProfit1 = rp(boundedTp1);
    takeProfit2 = rp(Math.max(takeProfit1 + riskDist * 0.85, swings.pivotR2, entryPrice + riskDist * 2.75));
  } else if (action === 'SELL') {
    const bounceRef = Math.min(
      swings.swingResistance - horizonAtr * 0.25,
      Math.max(referencePrice, referencePrice * 0.55 + indicators.ema9 * 0.25 + indicators.vwap * 0.2)
    );
    entryPrice = rp(bounceRef);
    entryZone = [rp(entryPrice - baseAtr * 0.25), rp(entryPrice + baseAtr * 0.25)];

    const structuralCeiling = Math.max(swings.swingResistance, swings.pivotR1);
    const rawStop = Math.max(structuralCeiling + baseAtr * 0.3, entryPrice + horizonAtr * 1.15);
    const maxStopCap = entryPrice + horizonAtr * 2.3;
    stopLoss = rp(Math.min(maxStopCap, rawStop));
    const riskDist = Math.max(horizonAtr * 0.85, stopLoss - entryPrice);

    const candidateTp1 = Math.min(swings.swingSupport, swings.pivotS1, indicators.bollinger.lower);
    const boundedTp1 =
      candidateTp1 <= entryPrice - riskDist * 1.45
        ? Math.max(candidateTp1, entryPrice - riskDist * 2.2)
        : entryPrice - riskDist * 1.7;
    takeProfit1 = rp(boundedTp1);
    takeProfit2 = rp(Math.min(takeProfit1 - riskDist * 0.85, swings.pivotS2, entryPrice - riskDist * 2.75));
  } else {
    entryPrice = rp(referencePrice);
    entryZone = [rp(swings.swingSupport + baseAtr * 0.2), rp(swings.swingResistance - baseAtr * 0.2)];
    takeProfit1 = rp(Math.max(swings.swingResistance, referencePrice + horizonAtr * 1.3));
    takeProfit2 = rp(Math.max(swings.pivotR1, takeProfit1 + horizonAtr * 0.9));
    stopLoss = rp(Math.min(swings.swingSupport, referencePrice - horizonAtr * 1.0));
  }

  const tp1Pct = parseFloat((((takeProfit1 - entryPrice) / entryPrice) * 100).toFixed(2));
  const tp2Pct = parseFloat((((takeProfit2 - entryPrice) / entryPrice) * 100).toFixed(2));
  const slPct = parseFloat((((stopLoss - entryPrice) / entryPrice) * 100).toFixed(2));

  const riskAbs = Math.abs(entryPrice - stopLoss);
  const rewardAbs = Math.abs(takeProfit1 - entryPrice);
  const riskRewardRatio = riskAbs > 0 ? parseFloat((rewardAbs / riskAbs).toFixed(2)) : 1.0;

  const dominantCount = action === 'BUY' ? bullishCount : action === 'SELL' ? bearishCount : neutralCount;
  const totalCriteria = criteria.length;
  const agreementPct = Math.round((dominantCount / totalCriteria) * 100);
  const confidenceScore = Math.min(95, Math.max(35, Math.round(Math.abs(normalizedScore) * 100 * 0.85 + 25)));

  const backtest = runHorizonSetupBacktest(closedCandles, meta.horizonBars, meta.atrScale);

  const headline =
    action === 'BUY'
      ? `Buy (Long) · ${meta.label}`
      : action === 'SELL'
      ? `Sell (Short) · ${meta.label}`
      : `Wait · ${meta.label} Range`;

  const summary =
    action === 'BUY'
      ? `${symbol} locked on ${meta.chartTf} closed candle ($${fFull(referencePrice)}). ${bullishCount} of ${totalCriteria} indicators align bullish (${pattern.name}, Supertrend $${fp(supertrend.level)}). Hold target window: ${meta.label.toLowerCase()}.`
      : action === 'SELL'
      ? `${symbol} locked on ${meta.chartTf} closed candle ($${fFull(referencePrice)}). ${bearishCount} of ${totalCriteria} indicators align bearish (${pattern.name}, Supertrend $${fp(supertrend.level)}). Hold target window: ${meta.label.toLowerCase()}.`
      : `${symbol} locked on ${meta.chartTf} closed candle ($${fFull(referencePrice)}). Indicators are split (${bullishCount} bullish vs ${bearishCount} bearish) between $${fp(swings.swingSupport)} and $${fp(swings.swingResistance)}. Wait for breakout confirmation.`;

  // Mathematical Leverage Sizing: keep Liquidation safely outside Stop Loss!
  const stopDistPct = Math.max(0.35, Math.abs(slPct));
  const maxSafeLeverage = Math.max(2, Math.min(35, Math.floor(100 / (stopDistPct * 1.45 + 0.5))));
  const recommendedLeverage = Math.max(2, Math.min(20, Math.floor(100 / (stopDistPct * 2.2 + 0.5))));
  const marginModeRecommendation: 'Isolated' | 'Cross' = 'Isolated';

  const fundingSettlements = Math.max(1, Math.ceil(meta.durationMs / (8 * 60 * 60 * 1000)));
  const rawFundingRatePct = futuresMetrics ? futuresMetrics.fundingRate * 100 : 0.01;
  const estimatedFundingImpactPct =
    action === 'SELL'
      ? parseFloat((rawFundingRatePct * fundingSettlements).toFixed(4))
      : parseFloat((-rawFundingRatePct * fundingSettlements).toFixed(4));

  return {
    symbol: symbol.toUpperCase(),
    pricePrecision: decimals,
    horizon,
    horizonLabel: meta.label,
    durationMs: meta.durationMs,
    action,
    headline,
    timeframe: meta.chartTf,
    referenceClosePrice: rp(referencePrice),
    closedCandleTime: lastClosed.time,
    entryPrice,
    entryZone,
    takeProfit1,
    takeProfit2,
    stopLoss,
    tp1Pct,
    tp2Pct,
    slPct,
    riskRewardRatio,
    swingSupport: rp(swings.swingSupport),
    swingResistance: rp(swings.swingResistance),
    pivotPoint: rp(swings.pivotPoint),
    pivotR1: rp(swings.pivotR1),
    pivotS1: rp(swings.pivotS1),
    supertrendLevel: rp(supertrend.level),
    detectedPattern: pattern.name,
    bullishCount,
    bearishCount,
    neutralCount,
    totalCriteria,
    agreementPct,
    confidenceScore,
    backtestWinRate: backtest.winRate,
    backtestTrades: backtest.trades,
    backtestAvgRR: backtest.avgRR,
    recommendedLeverage,
    maxSafeLeverage,
    marginModeRecommendation,
    estimatedFundingImpactPct,
    futuresMetrics,
    summary,
    criteria,
    generatedAt: lastClosed.closeTime ?? lastClosed.time * 1000,
  };
}

export function analyzeAllHorizons(
  horizonCandlesMap: Partial<Record<'15m' | '30m' | '1h' | '4h', Candle[]>>,
  multiTfSignals: MultiTimeframeSignal[],
  fallbackCandles: Candle[],
  futuresMetrics: FuturesMarketMetrics | null = null,
  symbol: string = 'BTCUSDT',
  pricePrecision?: number
): Record<TradeHorizon, TradeSignalSetup | null> {
  const result: Record<TradeHorizon, TradeSignalSetup | null> = {
    '1h': null,
    '2h': null,
    '5h': null,
    '10h': null,
    '24h': null,
  };

  for (const h of TRADE_HORIZONS) {
    const meta = HORIZON_CONFIG[h];
    const source = horizonCandlesMap[meta.chartTf];
    const candlesToUse = source && source.length >= 50 ? source : fallbackCandles;
    result[h] = analyzeHorizonTradeSetup(
      candlesToUse,
      h,
      multiTfSignals,
      futuresMetrics,
      symbol,
      pricePrecision
    );
  }

  return result;
}
