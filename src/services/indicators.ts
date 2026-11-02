import { Candle, TechnicalIndicators, IndicatorInterpretation } from '../types/crypto';

// Helper: Simple Moving Average
export function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j];
      }
      result.push(sum / period);
    }
  }
  return result;
}

// Helper: Exponential Moving Average
export function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  let ema = 0;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else if (i === period - 1) {
      // First EMA is SMA
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j];
      }
      ema = sum / period;
      result.push(ema);
    } else {
      ema = data[i] * k + ema * (1 - k);
      result.push(ema);
    }
  }
  return result;
}

// Helper: Relative Strength Index (RSI) with Wilder's Smoothing
export function calculateRSI(closes: number[], period: number = 14): number[] {
  const result: number[] = [];
  if (closes.length <= period) return result;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = 0; i < period; i++) {
    result.push(NaN);
  }

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - 100 / (1 + rs);
  result.push(rsi);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);
    result.push(rsi);
  }

  return result;
}

// Helper: Moving Average Convergence Divergence (MACD)
export function calculateMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(fastEMA[i]) || isNaN(slowEMA[i])) {
      macdLine.push(NaN);
    } else {
      macdLine.push(fastEMA[i] - slowEMA[i]);
    }
  }

  // Filter out NaNs for signal calculation
  const validMacdStartIndex = macdLine.findIndex((v) => !isNaN(v));
  if (validMacdStartIndex === -1) {
    return { macdLine, signalLine: new Array(closes.length).fill(NaN), histogram: new Array(closes.length).fill(NaN) };
  }

  const validMacd = macdLine.slice(validMacdStartIndex);
  const validSignal = calculateEMA(validMacd, signalPeriod);

  const signalLine: number[] = new Array(validMacdStartIndex).fill(NaN);
  signalLine.push(...validSignal);

  const histogram: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(macdLine[i]) || isNaN(signalLine[i])) {
      histogram.push(NaN);
    } else {
      histogram.push(macdLine[i] - signalLine[i]);
    }
  }

  return { macdLine, signalLine, histogram };
}

// Helper: Bollinger Bands (20, 2)
export function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  multiplier: number = 2
): { upper: number[]; middle: number[]; lower: number[]; bandWidth: number[]; percentB: number[] } {
  const middle = calculateSMA(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];
  const bandWidth: number[] = [];
  const percentB: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (isNaN(middle[i])) {
      upper.push(NaN);
      lower.push(NaN);
      bandWidth.push(NaN);
      percentB.push(NaN);
    } else {
      let sumSq = 0;
      for (let j = 0; j < period; j++) {
        sumSq += Math.pow(closes[i - j] - middle[i], 2);
      }
      const stdDev = Math.sqrt(sumSq / period);
      const up = middle[i] + multiplier * stdDev;
      const low = middle[i] - multiplier * stdDev;
      upper.push(up);
      lower.push(low);
      bandWidth.push(middle[i] === 0 ? 0 : (up - low) / middle[i]);
      percentB.push(up === low ? 0.5 : (closes[i] - low) / (up - low));
    }
  }

  return { upper, middle, lower, bandWidth, percentB };
}

// Helper: Average True Range (ATR)
export function calculateATR(candles: Candle[], period: number = 14): number[] {
  const result: number[] = [];
  if (candles.length < 2) return result;

  const trueRanges: number[] = [candles[0].high - candles[0].low];

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  // Smooth ATR with Wilder's method
  let atr = 0;
  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += trueRanges[j];
      atr = sum / period;
      result.push(atr);
    } else {
      atr = (atr * (period - 1) + trueRanges[i]) / period;
      result.push(atr);
    }
  }

  return result;
}

// Helper: Average Directional Index (ADX)
export function calculateADX(candles: Candle[], period: number = 14): { adx: number[]; pDi: number[]; mDi: number[] } {
  const len = candles.length;
  const pDm: number[] = [0];
  const mDm: number[] = [0];
  const tr: number[] = [candles[0].high - candles[0].low];

  for (let i = 1; i < len; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;

    if (upMove > downMove && upMove > 0) {
      pDm.push(upMove);
    } else {
      pDm.push(0);
    }

    if (downMove > upMove && downMove > 0) {
      mDm.push(downMove);
    } else {
      mDm.push(0);
    }

    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }

  // Wilder smooth TR, +DM, -DM
  const smoothTR = calculateEMA(tr, period);
  const smoothPDM = calculateEMA(pDm, period);
  const smoothMDM = calculateEMA(mDm, period);

  const pDi: number[] = [];
  const mDi: number[] = [];
  const dx: number[] = [];

  for (let i = 0; i < len; i++) {
    if (isNaN(smoothTR[i]) || smoothTR[i] === 0) {
      pDi.push(NaN);
      mDi.push(NaN);
      dx.push(NaN);
    } else {
      const pos = (smoothPDM[i] / smoothTR[i]) * 100;
      const neg = (smoothMDM[i] / smoothTR[i]) * 100;
      pDi.push(pos);
      mDi.push(neg);

      const diff = Math.abs(pos - neg);
      const sum = pos + neg;
      dx.push(sum === 0 ? 0 : (diff / sum) * 100);
    }
  }

  const validDxStart = dx.findIndex((v) => !isNaN(v));
  if (validDxStart === -1) {
    return { adx: new Array(len).fill(NaN), pDi, mDi };
  }

  const validDx = dx.slice(validDxStart);
  const validAdx = calculateEMA(validDx, period);

  const adx: number[] = new Array(validDxStart).fill(NaN);
  adx.push(...validAdx);

  return { adx, pDi, mDi };
}

// Helper: Stochastic Oscillator
export function calculateStochastic(candles: Candle[], period: number = 14, smoothK: number = 3, smoothD: number = 3): { k: number[]; d: number[] } {
  const rawK: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      rawK.push(NaN);
    } else {
      let highestHigh = -Infinity;
      let lowestLow = Infinity;
      for (let j = 0; j < period; j++) {
        highestHigh = Math.max(highestHigh, candles[i - j].high);
        lowestLow = Math.min(lowestLow, candles[i - j].low);
      }
      const range = highestHigh - lowestLow;
      if (range === 0) {
        rawK.push(50);
      } else {
        rawK.push(((candles[i].close - lowestLow) / range) * 100);
      }
    }
  }

  const k = calculateSMA(rawK.map((v) => (isNaN(v) ? 0 : v)), smoothK);
  const d = calculateSMA(k.map((v) => (isNaN(v) ? 0 : v)), smoothD);
  return { k, d };
}

// Helper: Stochastic RSI
export function calculateStochRSI(rsiValues: number[], period: number = 14, smoothK: number = 3, smoothD: number = 3): { k: number[]; d: number[] } {
  const rawStoch: number[] = [];
  for (let i = 0; i < rsiValues.length; i++) {
    if (i < period - 1 || isNaN(rsiValues[i])) {
      rawStoch.push(NaN);
    } else {
      let minRsi = Infinity;
      let maxRsi = -Infinity;
      for (let j = 0; j < period; j++) {
        const val = rsiValues[i - j];
        if (!isNaN(val)) {
          minRsi = Math.min(minRsi, val);
          maxRsi = Math.max(maxRsi, val);
        }
      }
      const diff = maxRsi - minRsi;
      if (diff === 0) {
        rawStoch.push(50);
      } else {
        rawStoch.push(((rsiValues[i] - minRsi) / diff) * 100);
      }
    }
  }

  const k = calculateSMA(rawStoch.map((v) => (isNaN(v) ? 0 : v)), smoothK);
  const d = calculateSMA(k.map((v) => (isNaN(v) ? 0 : v)), smoothD);
  return { k, d };
}

// Helper: Volume Weighted Average Price (VWAP)
export function calculateVWAP(candles: Candle[]): number[] {
  const result: number[] = [];
  let cumTypicalVolume = 0;
  let cumVolume = 0;

  for (let i = 0; i < candles.length; i++) {
    const typicalPrice = (candles[i].high + candles[i].low + candles[i].close) / 3;
    cumTypicalVolume += typicalPrice * candles[i].volume;
    cumVolume += candles[i].volume;

    result.push(cumVolume === 0 ? typicalPrice : cumTypicalVolume / cumVolume);
  }

  return result;
}

// Helper: On-Balance Volume (OBV)
export function calculateOBV(candles: Candle[]): number[] {
  const result: number[] = [];
  let obv = 0;

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      obv = candles[i].volume;
    } else {
      if (candles[i].close > candles[i - 1].close) {
        obv += candles[i].volume;
      } else if (candles[i].close < candles[i - 1].close) {
        obv -= candles[i].volume;
      }
    }
    result.push(obv);
  }

  return result;
}

// Helper: Rate of Change (ROC)
export function calculateROC(closes: number[], period: number = 12): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(NaN);
    } else {
      const prev = closes[i - period];
      result.push(prev === 0 ? 0 : ((closes[i] - prev) / prev) * 100);
    }
  }
  return result;
}

// Helper: Historical Volatility (30 period, annualized)
export function calculateHistoricalVolatility(closes: number[], period: number = 30): number {
  if (closes.length < period + 1) return 0;
  const logReturns: number[] = [];
  for (let i = closes.length - period; i < closes.length; i++) {
    const ret = Math.log(closes[i] / closes[i - 1]);
    logReturns.push(ret);
  }
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance =
    logReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (logReturns.length - 1);
  const stdDev = Math.sqrt(variance);
  // Annualized using sqrt(365 * 24 * 60) for 1m or standard sqrt(365)
  return stdDev * Math.sqrt(365) * 100;
}

// Main comprehensive calculation function
export function calculateAllIndicators(candles: Candle[]): TechnicalIndicators | null {
  if (!candles || candles.length < 50) {
    return null;
  }

  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const lastIdx = candles.length - 1;
  const currentPrice = closes[lastIdx];

  // Moving averages
  const ema9Arr = calculateEMA(closes, 9);
  const ema20Arr = calculateEMA(closes, 20);
  const ema50Arr = calculateEMA(closes, 50);
  const ema100Arr = calculateEMA(closes, 100);
  const ema200Arr = calculateEMA(closes, Math.min(200, closes.length - 1));
  const sma20Arr = calculateSMA(closes, 20);
  const sma50Arr = calculateSMA(closes, 50);

  // Momentum
  const rsiArr = calculateRSI(closes, 14);
  const macdObj = calculateMACD(closes, 12, 26, 9);
  const stochRsiObj = calculateStochRSI(rsiArr, 14, 3, 3);
  const stochOscObj = calculateStochastic(candles, 14, 3, 3);
  const rocArr = calculateROC(closes, 12);

  // Volatility
  const bbObj = calculateBollingerBands(closes, 20, 2);
  const atrArr = calculateATR(candles, 14);
  const adxObj = calculateADX(candles, 14);
  const histVol = calculateHistoricalVolatility(closes, 30);

  // Volume
  const volSmaArr = calculateSMA(volumes, 20);
  const vwapArr = calculateVWAP(candles);
  const obvArr = calculateOBV(candles);

  const ema9 = ema9Arr[lastIdx] || currentPrice;
  const ema20 = ema20Arr[lastIdx] || currentPrice;
  const ema50 = ema50Arr[lastIdx] || currentPrice;
  const ema100 = ema100Arr[lastIdx] || currentPrice;
  const ema200 = ema200Arr[lastIdx] || currentPrice;
  const sma20 = sma20Arr[lastIdx] || currentPrice;
  const sma50 = sma50Arr[lastIdx] || currentPrice;

  const rsi = rsiArr[lastIdx] || 50;
  const macdVal = macdObj.macdLine[lastIdx] || 0;
  const macdSig = macdObj.signalLine[lastIdx] || 0;
  const macdHist = macdObj.histogram[lastIdx] || 0;

  const adxVal = adxObj.adx[lastIdx] || 25;
  const pDiVal = adxObj.pDi[lastIdx] || 20;
  const mDiVal = adxObj.mDi[lastIdx] || 20;

  const stochRsiK = stochRsiObj.k[lastIdx] || 50;
  const stochRsiD = stochRsiObj.d[lastIdx] || 50;
  const stochOscK = stochOscObj.k[lastIdx] || 50;
  const stochOscD = stochOscObj.d[lastIdx] || 50;
  const roc = rocArr[lastIdx] || 0;

  const bbUpper = bbObj.upper[lastIdx] || currentPrice * 1.01;
  const bbMiddle = bbObj.middle[lastIdx] || currentPrice;
  const bbLower = bbObj.lower[lastIdx] || currentPrice * 0.99;
  const bbBandWidth = bbObj.bandWidth[lastIdx] || 0.02;
  const bbPercentB = bbObj.percentB[lastIdx] || 0.5;

  const atr = atrArr[lastIdx] || currentPrice * 0.005;
  const volumeSma = volSmaArr[lastIdx] || volumes[lastIdx];
  const vwap = vwapArr[lastIdx] || currentPrice;
  const obv = obvArr[lastIdx] || 0;

  const prevVolume = volumes[lastIdx - 1] || 1;
  const volumeChangePct = ((volumes[lastIdx] - prevVolume) / prevVolume) * 100;
  const volumeRatio = volumeSma > 0 ? volumes[lastIdx] / volumeSma : 1;

  // Build Interpretations
  const interpretations: Record<string, IndicatorInterpretation> = {};

  // EMA Structure
  const isEmaBullish = currentPrice > ema20 && ema9 > ema20 && ema20 > ema50;
  const isEmaBearish = currentPrice < ema20 && ema9 < ema20 && ema20 < ema50;
  interpretations['EMA_ALIGNMENT'] = {
    signal: isEmaBullish ? 'BULLISH' : isEmaBearish ? 'BEARISH' : 'NEUTRAL',
    value: `EMA9: $${ema9.toFixed(1)} | EMA20: $${ema20.toFixed(1)}`,
    reason: isEmaBullish
      ? 'Golden stack: Price > EMA9 > EMA20 > EMA50'
      : isEmaBearish
      ? 'Death stack: Price < EMA9 < EMA20 < EMA50'
      : 'Mixed moving average compression',
  };

  // RSI 14
  interpretations['RSI_14'] = {
    signal: rsi > 70 ? 'BEARISH' : rsi < 30 ? 'BULLISH' : rsi > 55 ? 'BULLISH' : rsi < 45 ? 'BEARISH' : 'NEUTRAL',
    value: rsi.toFixed(1),
    reason:
      rsi > 70
        ? 'Overbought zone (reversal/exhaustion risk)'
        : rsi < 30
        ? 'Oversold zone (potential bounce setup)'
        : rsi > 55
        ? 'Bullish momentum control (>50)'
        : rsi < 45
        ? 'Bearish momentum dominance (<50)'
        : 'Neutral equilibrium range',
  };

  // MACD
  interpretations['MACD'] = {
    signal: macdHist > 0 && macdVal > macdSig ? 'BULLISH' : macdHist < 0 && macdVal < macdSig ? 'BEARISH' : 'NEUTRAL',
    value: `Hist: ${macdHist.toFixed(2)}`,
    reason:
      macdHist > 0
        ? 'Positive momentum divergence; buyer velocity expanding'
        : 'Negative momentum divergence; seller pressure active',
  };

  // ADX
  interpretations['ADX'] = {
    signal: adxVal > 25 ? (pDiVal > mDiVal ? 'BULLISH' : 'BEARISH') : 'NEUTRAL',
    value: `${adxVal.toFixed(1)} (+DI ${pDiVal.toFixed(0)} | -DI ${mDiVal.toFixed(0)})`,
    reason:
      adxVal > 25
        ? pDiVal > mDiVal
          ? 'Strong bullish trend underway (ADX > 25)'
          : 'Strong bearish trend underway (ADX > 25)'
        : 'Weak / ranging market without dominant trend',
  };

  // Bollinger Bands
  interpretations['BOLLINGER'] = {
    signal: currentPrice > bbUpper ? 'BEARISH' : currentPrice < bbLower ? 'BULLISH' : currentPrice > bbMiddle ? 'BULLISH' : 'BEARISH',
    value: `%B: ${(bbPercentB * 100).toFixed(1)}%`,
    reason:
      currentPrice > bbUpper
        ? 'Trading above Upper 2σ band (mean reversion resistance)'
        : currentPrice < bbLower
        ? 'Trading below Lower 2σ band (mean reversion support)'
        : bbBandWidth < 0.015
        ? 'Volatility squeeze detected; explosive breakout imminent'
        : 'Trading inside normal statistical envelope',
  };

  // Stochastic RSI
  interpretations['STOCH_RSI'] = {
    signal: stochRsiK > 80 ? 'BEARISH' : stochRsiK < 20 ? 'BULLISH' : stochRsiK > stochRsiD ? 'BULLISH' : 'BEARISH',
    value: `K: ${stochRsiK.toFixed(1)} | D: ${stochRsiD.toFixed(1)}`,
    reason:
      stochRsiK > 80
        ? 'Overbought cyclical extreme'
        : stochRsiK < 20
        ? 'Oversold cyclical bottom zone'
        : stochRsiK > stochRsiD
        ? 'Bullish cyclical cross'
        : 'Bearish cyclical cross',
  };

  // VWAP
  interpretations['VWAP'] = {
    signal: currentPrice > vwap ? 'BULLISH' : 'BEARISH',
    value: `$${vwap.toFixed(1)}`,
    reason:
      currentPrice > vwap
        ? 'Institutions buying above benchmark VWAP'
        : 'Institutions selling below benchmark VWAP',
  };

  // OBV
  const prevObv = obvArr[lastIdx - 5] || obv;
  const isObvRising = obv > prevObv;
  interpretations['OBV'] = {
    signal: isObvRising ? 'BULLISH' : 'BEARISH',
    value: `${(obv / 1000).toFixed(1)}k`,
    reason: isObvRising
      ? 'Cumulative volume accumulation confirming price action'
      : 'Cumulative volume distribution indicating outflow',
  };

  return {
    ema9,
    ema20,
    ema50,
    ema100,
    ema200,
    sma20,
    sma50,
    macd: {
      macd: macdVal,
      signal: macdSig,
      hist: macdHist,
    },
    adx: {
      adx: adxVal,
      pDi: pDiVal,
      mDi: mDiVal,
    },
    rsi,
    stochRsi: {
      k: stochRsiK,
      d: stochRsiD,
    },
    stochOsc: {
      k: stochOscK,
      d: stochOscD,
    },
    roc,
    bollinger: {
      upper: bbUpper,
      middle: bbMiddle,
      lower: bbLower,
      bandWidth: bbBandWidth,
      percentB: bbPercentB,
    },
    atr,
    histVol,
    volumeSma,
    vwap,
    obv,
    volumeChangePct,
    volumeRatio,
    interpretations,
  };
}
