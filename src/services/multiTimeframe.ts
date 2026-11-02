import { Candle, MultiTimeframeSignal } from '../types/crypto';
import { calculateRSI, calculateEMA } from './indicators';

// Aggregates base 1m candles into higher timeframe bars
export function aggregateCandles(baseCandles: Candle[], multiplier: number): Candle[] {
  if (!baseCandles || baseCandles.length === 0) return [];
  if (multiplier <= 1) return [...baseCandles];

  const aggregated: Candle[] = [];
  const sorted = [...baseCandles].sort((a, b) => a.time - b.time);

  // Group by timeframe bucket
  const bucketSeconds = multiplier * 60;
  let currentBucketTime = Math.floor(sorted[0].time / bucketSeconds) * bucketSeconds;
  let curOpen = sorted[0].open;
  let curHigh = sorted[0].high;
  let curLow = sorted[0].low;
  let curClose = sorted[0].close;
  let curVol = 0;

  for (const c of sorted) {
    const candleBucket = Math.floor(c.time / bucketSeconds) * bucketSeconds;
    if (candleBucket === currentBucketTime) {
      curHigh = Math.max(curHigh, c.high);
      curLow = Math.min(curLow, c.low);
      curClose = c.close;
      curVol += c.volume;
    } else {
      aggregated.push({
        time: currentBucketTime,
        open: curOpen,
        high: curHigh,
        low: curLow,
        close: curClose,
        volume: curVol,
      });

      currentBucketTime = candleBucket;
      curOpen = c.open;
      curHigh = c.high;
      curLow = c.low;
      curClose = c.close;
      curVol = c.volume;
    }
  }

  // Push final bucket
  aggregated.push({
    time: currentBucketTime,
    open: curOpen,
    high: curHigh,
    low: curLow,
    close: curClose,
    volume: curVol,
  });

  return aggregated;
}

// Compute trend, momentum, and composite score for a timeframe
export function evaluateTimeframe(
  tf: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d',
  candles: Candle[]
): MultiTimeframeSignal {
  if (!candles || candles.length < 15) {
    return {
      timeframe: tf,
      trend: 'NEUTRAL',
      momentum: 'NEUTRAL',
      rsi: 50,
      emaAlignment: 'MIXED',
      compositeScore: 0,
    };
  }

  const closes = candles.map((c) => c.close);
  const lastIdx = closes.length - 1;
  const currentPrice = closes[lastIdx];

  const rsiArr = calculateRSI(closes, 14);
  const ema20Arr = calculateEMA(closes, 20);
  const ema50Arr = calculateEMA(closes, Math.min(50, closes.length - 1));

  const rsi = rsiArr[lastIdx] || 50;
  const ema20 = ema20Arr[lastIdx] || currentPrice;
  const ema50 = ema50Arr[lastIdx] || currentPrice;

  // Trend determination
  let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let emaAlignment: 'BULLISH' | 'BEARISH' | 'MIXED' = 'MIXED';

  if (currentPrice > ema20 && ema20 >= ema50) {
    trend = 'BULLISH';
    emaAlignment = 'BULLISH';
  } else if (currentPrice < ema20 && ema20 <= ema50) {
    trend = 'BEARISH';
    emaAlignment = 'BEARISH';
  }

  // Momentum determination
  let momentum: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (rsi > 54) momentum = 'BULLISH';
  else if (rsi < 46) momentum = 'BEARISH';

  // Composite Score (-100 to +100)
  let score = 0;
  if (trend === 'BULLISH') score += 45;
  if (trend === 'BEARISH') score -= 45;
  if (momentum === 'BULLISH') score += 35;
  if (momentum === 'BEARISH') score -= 35;
  if (rsi > 60) score += 20;
  if (rsi < 40) score -= 20;

  return {
    timeframe: tf,
    trend,
    momentum,
    rsi,
    emaAlignment,
    compositeScore: Math.max(-100, Math.min(100, score)),
  };
}

export function computeAllMultiTimeframeSignals(base1mCandles: Candle[]): MultiTimeframeSignal[] {
  const c1m = base1mCandles;
  const c5m = aggregateCandles(base1mCandles, 5);
  const c15m = aggregateCandles(base1mCandles, 15);
  const c30m = aggregateCandles(base1mCandles, 30);
  const c1h = aggregateCandles(base1mCandles, 60);
  const c4h = aggregateCandles(base1mCandles, 240);
  const c1d = aggregateCandles(base1mCandles, 1440);

  return [
    evaluateTimeframe('1m', c1m),
    evaluateTimeframe('5m', c5m),
    evaluateTimeframe('15m', c15m),
    evaluateTimeframe('30m', c30m),
    evaluateTimeframe('1h', c1h),
    evaluateTimeframe('4h', c4h),
    evaluateTimeframe('1d', c1d),
  ];
}
