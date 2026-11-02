export interface Candle {
  time: number; // Unix timestamp in seconds for lightweight-charts
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime?: number;
}

export interface Ticker24h {
  symbol: string;
  priceChange: number;
  priceChangePercent: number;
  lastPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  openPrice: number;
  weightedAvgPrice?: number;
  bidPrice?: number;
  askPrice?: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  total: number;
  percent: number;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPercent: number;
  bidDepthTotal: number;
  askDepthTotal: number;
}

export interface Trade {
  id: string | number;
  price: number;
  qty: number;
  time: number;
  isBuyerMaker: boolean; // true = sell taker, false = buy taker
}

export type IndicatorSignal = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface IndicatorInterpretation {
  signal: IndicatorSignal;
  value: string;
  reason: string;
}

export interface TechnicalIndicators {
  // Trend
  ema9: number;
  ema20: number;
  ema50: number;
  ema100: number;
  ema200: number;
  sma20: number;
  sma50: number;
  macd: {
    macd: number;
    signal: number;
    hist: number;
  };
  adx: {
    adx: number;
    pDi: number;
    mDi: number;
  };

  // Momentum
  rsi: number;
  stochRsi: {
    k: number;
    d: number;
  };
  stochOsc: {
    k: number;
    d: number;
  };
  roc: number;

  // Volatility
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
    bandWidth: number;
    percentB: number;
  };
  atr: number;
  histVol: number;

  // Volume
  volumeSma: number;
  vwap: number;
  obv: number;
  volumeChangePct: number;
  volumeRatio: number; // Current volume vs 20-period volume SMA

  interpretations: Record<string, IndicatorInterpretation>;
}

export type PredictionTimeframe = '1m' | '5m' | '10m' | '15m' | '30m' | '60m';

export interface PredictionResult {
  timeframe: PredictionTimeframe;
  currentPrice: number;
  predictedPrice: number;
  expectedChangePct: number;
  expectedRange: [number, number]; // [lowerBound, upperBound]
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number; // In percentage (e.g., 68.4)
  calibrationStatus: 'EMPIRICALLY_CALIBRATED' | 'HIGH_VOLATILITY_ADJUSTED' | 'CALIBRATING';
  supportingIndicators: string[];
  mainRisks: string[];
  timestamp: number;
  expiryTimestamp: number;
  statisticalMetrics: {
    drift: number;
    volatilityRange: number;
    momentumScore: number;
    reversionForce: number;
  };
}

export interface PredictionRecord {
  id: string;
  timestamp: number;
  actualPriceAtPrediction: number;
  predictedPrice: number;
  actualPriceAtExpiry?: number;
  timeframe: PredictionTimeframe;
  predictedDirection: 'UP' | 'DOWN' | 'NEUTRAL';
  actualDirection?: 'UP' | 'DOWN' | 'NEUTRAL';
  absoluteError?: number;
  percentageError?: number;
  squaredError?: number;
  isDirectionCorrect?: boolean;
  confidence: number;
  status: 'PENDING' | 'EVALUATED';
}

export interface PerformanceStats {
  totalEvaluated: number;
  directionalAccuracyPct: number;
  mae: number;
  mape: number;
  rmse: number;
  byTimeframe: Record<
    PredictionTimeframe,
    {
      count: number;
      accuracyPct: number;
      mae: number;
      mape: number;
    }
  >;
  recentEvaluations: PredictionRecord[];
}

export type ChartTimeframe =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '4h'
  | '1d'
  | '1w';

export interface MultiTimeframeSignal {
  timeframe: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  momentum: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  rsi: number;
  emaAlignment: 'BULLISH' | 'BEARISH' | 'MIXED';
  compositeScore: number; // -100 to +100
}

export interface AIAnalysisData {
  marketTrend: string;
  shortTermDirection: string;
  bullishFactors: string[];
  bearishFactors: string[];
  momentumAnalysis: string;
  volatilityAnalysis: string;
  keySupportLevels: number[];
  keyResistanceLevels: number[];
  reversalConditions: string;
  marketUncertainty: string;
  executiveSummary: string;
  timestamp: number;
}

export interface MarketAlert {
  id: string;
  title: string;
  message: string;
  type: 'VOLATILITY' | 'PRICE_SPIKE' | 'VOLUME_SPIKE' | 'RSI' | 'EMA_CROSS' | 'BREAKOUT' | 'CUSTOM';
  severity: 'INFO' | 'WARNING' | 'ALERT';
  timestamp: number;
}
