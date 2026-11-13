/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Candle,
  Ticker24h,
  OrderBook,
  Trade,
  TechnicalIndicators,
  PredictionResult,
  PredictionTimeframe,
  ChartTimeframe,
  PerformanceStats,
  MultiTimeframeSignal,
  AIAnalysisData,
  MarketAlert,
  PredictionRecord,
  TradeHorizon,
  FuturesMarketMetrics,
} from './types/crypto';
import { BinanceDataService, ConnectionStatus } from './services/binance';
import { calculateAllIndicators } from './services/indicators';
import { generateAllTimeframePredictions } from './services/predictionEngine';
import { HistoryStorageService } from './services/historyStorage';
import { computeAllMultiTimeframeSignals, evaluateTimeframe } from './services/multiTimeframe';
import { analyzeAllHorizons, getStrictlyClosedCandles, HORIZON_CONFIG } from './services/signalAnalyzer';

import { Header } from './components/Header';
import { SimpleSignalView } from './components/SimpleSignalView';
import { TradingChart } from './components/TradingChart';
import { PredictionDashboard } from './components/PredictionDashboard';
import { AIAnalysisPanel } from './components/AIAnalysisPanel';
import { MultiTimeframeMatrix } from './components/MultiTimeframeMatrix';
import { IndicatorsTable } from './components/IndicatorsTable';
import { PerformanceHistory } from './components/PerformanceHistory';
import { OrderBookAndTrades } from './components/OrderBookAndTrades';
import { AlertsManager } from './components/AlertsManager';
import { FuturesExecutionPanel } from './components/FuturesExecutionPanel';

import { ShieldAlert, LayoutGrid, SlidersHorizontal } from 'lucide-react';

export default function App() {
  // Theme & View state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'SIMPLE' | 'PRO'>('SIMPLE');
  const [activeHorizon, setActiveHorizon] = useState<TradeHorizon>('5h');

  // Market Data States
  const [candles, setCandles] = useState<Candle[]>([]);
  const [closedChartSnapshot, setClosedChartSnapshot] = useState<Candle[]>([]);
  const [horizonCandlesMap, setHorizonCandlesMap] = useState<
    Partial<Record<'15m' | '30m' | '1h' | '4h', Candle[]>>
  >({});
  const [activeTimeframe, setActiveTimeframe] = useState<ChartTimeframe>('1h');
  const [ticker, setTicker] = useState<Ticker24h | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [prevPrice, setPrevPrice] = useState<number>(0);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('RECONNECTING');
  const [latencyMs, setLatencyMs] = useState<number | undefined>(undefined);

  // Calculated Indicators & Multi-Timeframe & Futures Telemetry
  const [indicators, setIndicators] = useState<TechnicalIndicators | null>(null);
  const [multiTfSignals, setMultiTfSignals] = useState<MultiTimeframeSignal[]>([]);
  const [futuresMetrics, setFuturesMetrics] = useState<FuturesMarketMetrics | null>(null);

  // Predictions
  const [predictions, setPredictions] = useState<Record<PredictionTimeframe, PredictionResult | null>>({
    '1m': null,
    '5m': null,
    '10m': null,
    '15m': null,
    '30m': null,
    '60m': null,
  });
  const [activePredictionTf, setActivePredictionTf] = useState<PredictionTimeframe>('15m');

  // Historical Performance
  const [perfStats, setPerfStats] = useState<PerformanceStats>({
    totalEvaluated: 0,
    directionalAccuracyPct: 0,
    mae: 0,
    mape: 0,
    rmse: 0,
    byTimeframe: {
      '1m': { count: 0, accuracyPct: 0, mae: 0, mape: 0 },
      '5m': { count: 0, accuracyPct: 0, mae: 0, mape: 0 },
      '10m': { count: 0, accuracyPct: 0, mae: 0, mape: 0 },
      '15m': { count: 0, accuracyPct: 0, mae: 0, mape: 0 },
      '30m': { count: 0, accuracyPct: 0, mae: 0, mape: 0 },
      '60m': { count: 0, accuracyPct: 0, mae: 0, mape: 0 },
    },
    recentEvaluations: [],
  });
  const [historyFilter, setHistoryFilter] = useState<'24h' | '7d' | '30d' | 'all'>('24h');
  const [historyRecords, setHistoryRecords] = useState<PredictionRecord[]>([]);

  // Gemini AI Analysis
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisData | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [lastAiUpdated, setLastAiUpdated] = useState<number>(0);

  // Alerts & Sentinel
  const [alerts, setAlerts] = useState<MarketAlert[]>([]);
  const [customAlerts, setCustomAlerts] = useState<{ id: string; targetPrice: number; condition: 'ABOVE' | 'BELOW' }[]>([]);

  // Service Reference
  const binanceServiceRef = useRef<BinanceDataService | null>(null);
  const isInitialFetchDone = useRef(false);
  const lastRecordedPredictionRef = useRef<number>(0);

  // Sync dark mode class on root html element for Tailwind v4 dark: variants
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // 1. Initialize & Connect to Binance
  useEffect(() => {
    // Initialize or seed historical prediction records
    HistoryStorageService.ensureInitialized(68000);
    setHistoryRecords(HistoryStorageService.getAllRecords());
    setPerfStats(HistoryStorageService.calculatePerformanceStats(historyFilter));

    const service = new BinanceDataService({
      onCandle: (candle, isClosed) => {
        setCandles((prev) => {
          if (prev.length === 0) return [candle];
          const last = prev[prev.length - 1];

          if (candle.time === last.time) {
            // Update current active candle
            const updated = [...prev];
            updated[updated.length - 1] = candle;
            if (isClosed) {
              setClosedChartSnapshot(updated);
            }
            return updated;
          } else if (candle.time > last.time) {
            // Previous candle finished; snapshot closed bars stably
            setClosedChartSnapshot(prev);
            return [...prev.slice(-299), candle];
          }
          return prev;
        });

        setCurrentPrice((prevP) => {
          setPrevPrice(prevP);
          return candle.close;
        });
      },
      onTicker: (partialTicker) => {
        setTicker((prev) => (prev ? { ...prev, ...partialTicker } : (partialTicker as Ticker24h)));
        if (partialTicker.lastPrice) {
          setCurrentPrice((prevP) => {
            setPrevPrice(prevP);
            return partialTicker.lastPrice!;
          });
        }
      },
      onTrade: (trade) => {
        setTrades((prev) => [trade, ...prev.slice(0, 24)]);
      },
      onDepth: (book) => {
        setOrderBook(book);
      },
      onStatusChange: (status, latency) => {
        setConnectionStatus(status);
        if (latency !== undefined) setLatencyMs(latency);
      },
    });

    binanceServiceRef.current = service;

    // Initial historical backfill (defaults to 1h chart for 5h trade horizon)
    loadHistoricalData('1h');
    loadRealMultiTimeframeSignals(service);
    loadHorizonChartData(service);
    loadFuturesTelemetry(service);

    // Refresh MTF, Futures telemetry & closed horizon candles periodically (every 3 minutes)
    const mtfInterval = setInterval(() => {
      loadRealMultiTimeframeSignals(service);
      loadHorizonChartData(service);
      loadFuturesTelemetry(service);
    }, 180000);

    // Connect WebSocket
    service.connect('1h');

    return () => {
      clearInterval(mtfInterval);
      service.destroy();
      binanceServiceRef.current = null;
    };
  }, []);

  const loadFuturesTelemetry = async (service: BinanceDataService) => {
    try {
      const fm = await service.fetchFuturesMetrics();
      if (fm) {
        setFuturesMetrics(fm);
      }
    } catch (err) {
      console.warn('Futures telemetry fetch warning:', err);
    }
  };

  const loadHorizonChartData = async (service: BinanceDataService) => {
    try {
      const map = await service.fetchHorizonChartData();
      if (Object.keys(map).length > 0) {
        setHorizonCandlesMap(map);
      }
    } catch (err) {
      console.warn('Horizon chart fetch warning:', err);
    }
  };

  const loadRealMultiTimeframeSignals = async (service: BinanceDataService) => {
    try {
      const mtfCandles = await service.fetchMultiTimeframeCandles();
      const tfs: ('1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d')[] = [
        '1m',
        '5m',
        '15m',
        '30m',
        '1h',
        '4h',
        '1d',
      ];
      const realSignals: MultiTimeframeSignal[] = tfs
        .map((tf) => {
          const list = mtfCandles[tf];
          const closedList = list ? getStrictlyClosedCandles(list) : [];
          return closedList.length >= 15 ? evaluateTimeframe(tf, closedList) : null;
        })
        .filter((s): s is MultiTimeframeSignal => s !== null);

      if (realSignals.length >= 4) {
        setMultiTfSignals(realSignals);
      }
    } catch (err) {
      console.warn('MTF refresh warning:', err);
    }
  };

  // 2. Load Historical Candles when Timeframe Changes
  const loadHistoricalData = async (tf: ChartTimeframe) => {
    try {
      if (!binanceServiceRef.current) return;
      const initialCandles = await binanceServiceRef.current.fetchHistoricalKlines(tf, 250);
      if (initialCandles.length > 0) {
        setCandles(initialCandles);
        setClosedChartSnapshot(initialCandles);
        const lastC = initialCandles[initialCandles.length - 1];
        setCurrentPrice(lastC.close);
        setPrevPrice(lastC.close);

        // Fetch initial ticker, depth, trades
        binanceServiceRef.current.fetch24hTicker().then((t) => t && setTicker(t));
        binanceServiceRef.current.fetchOrderBook(15).then((b) => b && setOrderBook(b));
        binanceServiceRef.current.fetchRecentTrades(20).then((tr) => tr && setTrades(tr));
      }
    } catch (err) {
      console.error('Failed to load historical candles:', err);
    }
  };

  const handleTimeframeChange = (newTf: ChartTimeframe) => {
    setActiveTimeframe(newTf);
    loadHistoricalData(newTf);
    binanceServiceRef.current?.switchTimeframe(newTf);
  };

  const handleSelectHorizon = (horizon: TradeHorizon) => {
    setActiveHorizon(horizon);
    const targetTf = HORIZON_CONFIG[horizon].chartTf;
    if (activeTimeframe !== targetTf) {
      handleTimeframeChange(targetTf);
    }
  };

  // 3. Indicator & Prediction Calculations on Candle Updates
  useEffect(() => {
    if (candles.length < 20 || currentPrice === 0) return;

    // Calculate all indicators
    const calculated = calculateAllIndicators(candles);
    if (calculated) {
      setIndicators(calculated);

      // Only fallback to local resampling if real multi-timeframe fetch hasn't populated yet
      setMultiTfSignals((prev) => (prev.length >= 4 ? prev : computeAllMultiTimeframeSignals(candles)));

      // Generate 6 predictions
      const newPredictions = generateAllTimeframePredictions(candles, calculated, currentPrice);
      setPredictions(newPredictions);

      // Sentinel Alert Engine Checks
      evaluateMarketAlerts(calculated, currentPrice);

      // Periodically commit newly generated predictions to tracking storage (every 30 seconds)
      const now = Date.now();
      if (now - lastRecordedPredictionRef.current > 30000 && newPredictions['15m']) {
        lastRecordedPredictionRef.current = now;
        (['1m', '5m', '10m', '15m', '30m', '60m'] as PredictionTimeframe[]).forEach((tf) => {
          const p = newPredictions[tf];
          if (p) {
            HistoryStorageService.addPrediction({
              id: `pred-${tf}-${now}`,
              timestamp: now,
              actualPriceAtPrediction: p.currentPrice,
              predictedPrice: p.predictedPrice,
              timeframe: tf,
              predictedDirection: p.direction,
              confidence: p.confidence,
              status: 'PENDING',
            });
          }
        });
      }

      // Automatically evaluate any expired pending predictions
      HistoryStorageService.evaluatePending(currentPrice);
      setHistoryRecords(HistoryStorageService.getAllRecords());
      setPerfStats(HistoryStorageService.calculatePerformanceStats(historyFilter));
    }
  }, [candles, currentPrice]);

  // 4. Sentinel Alerts Evaluator
  const evaluateMarketAlerts = (ind: TechnicalIndicators, price: number) => {
    const newAlerts: MarketAlert[] = [];

    // Volatility Warning
    if (ind.bollinger.bandWidth > 0.04) {
      newAlerts.push({
        id: `vol-${Date.now()}`,
        title: 'High Volatility Regime Warning',
        message: `Bollinger BandWidth expanded to ${(ind.bollinger.bandWidth * 100).toFixed(2)}%. ATR is $${ind.atr.toFixed(0)}.`,
        type: 'VOLATILITY',
        severity: 'WARNING',
        timestamp: Date.now(),
      });
    }

    // RSI Overbought / Oversold
    if (ind.rsi > 75) {
      newAlerts.push({
        id: `rsi-ob-${Date.now()}`,
        title: 'RSI Extreme Overbought (Exhaustion Risk)',
        message: `RSI-14 reached ${ind.rsi.toFixed(1)}. Bearish mean-reversion probability elevated.`,
        type: 'RSI',
        severity: 'ALERT',
        timestamp: Date.now(),
      });
    } else if (ind.rsi < 25) {
      newAlerts.push({
        id: `rsi-os-${Date.now()}`,
        title: 'RSI Extreme Oversold (Bounce Setup)',
        message: `RSI-14 depressed at ${ind.rsi.toFixed(1)}. Bullish relief bounce setup forming.`,
        type: 'RSI',
        severity: 'ALERT',
        timestamp: Date.now(),
      });
    }

    // Volume Surge
    if (ind.volumeRatio > 2.2) {
      newAlerts.push({
        id: `vol-surge-${Date.now()}`,
        title: 'Institutional Volume Surge',
        message: `Current volume is ${(ind.volumeRatio * 100).toFixed(0)}% of 20-period baseline.`,
        type: 'VOLUME_SPIKE',
        severity: 'INFO',
        timestamp: Date.now(),
      });
    }

    // Check custom price alerts
    customAlerts.forEach((ca) => {
      if (ca.condition === 'ABOVE' && price >= ca.targetPrice) {
        newAlerts.push({
          id: `cust-${ca.id}`,
          title: 'Custom Price Alert Triggered',
          message: `BTC reached above watched target: $${ca.targetPrice.toLocaleString()} (Now $${price.toFixed(2)})`,
          type: 'CUSTOM',
          severity: 'ALERT',
          timestamp: Date.now(),
        });
      } else if (ca.condition === 'BELOW' && price <= ca.targetPrice) {
        newAlerts.push({
          id: `cust-${ca.id}`,
          title: 'Custom Price Alert Triggered',
          message: `BTC dropped below watched target: $${ca.targetPrice.toLocaleString()} (Now $${price.toFixed(2)})`,
          type: 'CUSTOM',
          severity: 'ALERT',
          timestamp: Date.now(),
        });
      }
    });

    if (newAlerts.length > 0) {
      setAlerts((prev) => {
        // Prevent duplicate alerts within 60s
        const existingTitles = new Set(prev.map((a) => a.title));
        const filteredNew = newAlerts.filter((a) => !existingTitles.has(a.title));
        return [...filteredNew, ...prev.slice(0, 10)];
      });
    }
  };

  // 5. Fetch Gemini AI Synthesis
  const fetchGeminiAnalysis = useCallback(async () => {
    if (currentPrice === 0) return;
    setIsAiLoading(true);
    setAiError(null);

    try {
      const payload = {
        currentPrice,
        priceChangePercent: ticker?.priceChangePercent || 0,
        high24h: ticker?.highPrice || currentPrice,
        low24h: ticker?.lowPrice || currentPrice,
        volume24h: ticker?.volume || 0,
        timeframe: activeTimeframe,
        indicators,
        multiTimeframe: multiTfSignals.reduce((acc, sig) => {
          acc[sig.timeframe] = sig.trend;
          return acc;
        }, {} as Record<string, string>),
        predictions: {
          '15m': predictions['15m'],
          '60m': predictions['60m'],
        },
      };

      const res = await fetch('/api/ai/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to retrieve AI analysis');
      }

      setAiAnalysis(data.analysis);
      setLastAiUpdated(data.timestamp || Date.now());
    } catch (err: any) {
      console.warn('Gemini analysis fetch error:', err);
      setAiError(err.message || 'AI analysis unavailable');
    } finally {
      setIsAiLoading(false);
    }
  }, [currentPrice, ticker, indicators, multiTfSignals, predictions, activeTimeframe]);

  // Initial AI call once market data stabilizes
  useEffect(() => {
    if (currentPrice > 0 && indicators && !isInitialFetchDone.current) {
      isInitialFetchDone.current = true;
      fetchGeminiAnalysis();
    }
  }, [currentPrice, indicators, fetchGeminiAnalysis]);

  // Handlers for Custom Alerts
  const handleAddCustomAlert = (targetPrice: number, condition: 'ABOVE' | 'BELOW') => {
    setCustomAlerts((prev) => [...prev, { id: `custom-${Date.now()}`, targetPrice, condition }]);
  };

  const handleRemoveCustomAlert = (id: string) => {
    setCustomAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleFilterChange = (filter: '24h' | '7d' | '30d' | 'all') => {
    setHistoryFilter(filter);
    setPerfStats(HistoryStorageService.calculatePerformanceStats(filter));
  };

  const handleClearHistory = () => {
    HistoryStorageService.clearHistory();
    setHistoryRecords([]);
    setPerfStats(HistoryStorageService.calculatePerformanceStats(historyFilter));
  };

  const activePrediction = predictions[activePredictionTf];

  // Unconditional Rules-of-Hooks stable signal evaluation across ALL horizons (1h, 2h, 5h, 10h, 24h)
  // Uses strictly closed historical chart candles + periodic futures snapshot so Entry / TP / SL stay stable
  const allHorizonSignals = useMemo(
    () => analyzeAllHorizons(horizonCandlesMap, multiTfSignals, closedChartSnapshot, futuresMetrics),
    [horizonCandlesMap, multiTfSignals, closedChartSnapshot, futuresMetrics]
  );

  const signalSetup = allHorizonSignals[activeHorizon];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#06090e] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Top Header */}
      <Header
        ticker={ticker}
        currentPrice={currentPrice}
        prevPrice={prevPrice}
        connectionStatus={connectionStatus}
        latencyMs={latencyMs}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        onManualRefresh={() => {
          loadHistoricalData(activeTimeframe);
          if (binanceServiceRef.current) {
            loadRealMultiTimeframeSignals(binanceServiceRef.current);
            loadHorizonChartData(binanceServiceRef.current);
            loadFuturesTelemetry(binanceServiceRef.current);
          }
          fetchGeminiAnalysis();
        }}
        isRefreshing={isAiLoading}
      />

      {/* Workspace Mode Toolbar */}
      <div className="border-b border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-950/60">
        <div className="max-w-[1720px] mx-auto px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewMode('SIMPLE')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'SIMPLE'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Simple Signal</span>
            </button>
            <button
              onClick={() => setViewMode('PRO')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'PRO'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Full Terminal</span>
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {viewMode === 'SIMPLE'
              ? `Stable ${HORIZON_CONFIG[activeHorizon].label} setup locked on closed ${HORIZON_CONFIG[activeHorizon].chartTf} chart (${signalSetup?.totalCriteria ?? 16} indicators)`
              : 'Full Quantitative Terminal · Multi-Horizon Forecast, Order Book & AI Synthesis'}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-[1720px] mx-auto p-3 sm:p-4 md:p-5 space-y-5">
        {viewMode === 'SIMPLE' ? (
          <SimpleSignalView
            activeHorizon={activeHorizon}
            onSelectHorizon={handleSelectHorizon}
            allHorizonSignals={allHorizonSignals}
            signal={signalSetup}
            currentPrice={currentPrice}
            candles={candles}
            timeframe={activeTimeframe}
            onTimeframeChange={handleTimeframeChange}
            indicators={indicators}
            activePrediction={activePrediction}
            isDarkMode={isDarkMode}
            onSwitchToPro={() => setViewMode('PRO')}
          />
        ) : (
          <>
            {/* Section 1: 6 Horizon Prediction Dashboard */}
            <section>
              <PredictionDashboard
                predictions={predictions}
                activeTimeframe={activePredictionTf}
                onSelectTimeframe={(tf) => setActivePredictionTf(tf)}
                currentPrice={currentPrice}
              />
            </section>

            {/* Section 2: Main Candlestick Chart & Side Panels */}
            <section className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
              {/* Main Chart Column (3 cols on large) */}
              <div className="lg:col-span-3 space-y-4">
                <TradingChart
                  candles={candles}
                  timeframe={activeTimeframe}
                  onTimeframeChange={handleTimeframeChange}
                  indicators={indicators}
                  activePrediction={activePrediction}
                  signalSetup={signalSetup}
                  isDarkMode={isDarkMode}
                />

                {/* Multi-Timeframe Matrix (1m to 1d) */}
                <MultiTimeframeMatrix signals={multiTfSignals} />
              </div>

              {/* Right Panel: Order Book, Live Trades & Sentinel Alerts */}
              <div className="lg:col-span-1 space-y-4">
                <div className="h-[480px]">
                  <OrderBookAndTrades
                    orderBook={orderBook}
                    trades={trades}
                    currentPrice={currentPrice}
                  />
                </div>

                <AlertsManager
                  alerts={alerts}
                  onDismissAlert={handleDismissAlert}
                  onAddCustomAlert={handleAddCustomAlert}
                  customAlerts={customAlerts}
                  onRemoveCustomAlert={handleRemoveCustomAlert}
                  currentPrice={currentPrice}
                />
              </div>
            </section>

            {/* Section 3: Futures Trading Execution & Risk Setup */}
            <section>
              <FuturesExecutionPanel
                prediction={activePrediction}
                currentPrice={currentPrice}
                indicators={indicators}
                multiTfSignals={multiTfSignals}
                activeTimeframe={activePredictionTf}
                onSelectTimeframe={(tf) => setActivePredictionTf(tf)}
                candles={candles}
              />
            </section>

            {/* Section 4: Gemini AI Market Synthesis */}
            <section>
              <AIAnalysisPanel
                analysis={aiAnalysis}
                isLoading={isAiLoading}
                onRefresh={fetchGeminiAnalysis}
                error={aiError}
                lastUpdated={lastAiUpdated}
              />
            </section>

            {/* Section 5: Quantitative Technical Indicator Table */}
            <section>
              <IndicatorsTable indicators={indicators} currentPrice={currentPrice} />
            </section>

            {/* Section 6: Historical Prediction Performance & Out-of-Sample Evaluation */}
            <section>
              <PerformanceHistory
                stats={perfStats}
                onFilterChange={handleFilterChange}
                activeFilter={historyFilter}
                records={historyRecords}
                onClearHistory={handleClearHistory}
              />
            </section>
          </>
        )}

        {/* Bottom Analytical Disclaimer */}
        <footer className="border-t border-slate-200 dark:border-slate-800/80 pt-6 pb-8 text-center text-xs font-mono text-slate-500 space-y-2">
          <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-500/90 font-semibold">
            <ShieldAlert className="w-4 h-4" />
            <span>ANALYTICAL PREDICTION SYSTEM DISCLAIMER</span>
          </div>
          <p className="max-w-4xl mx-auto leading-relaxed text-[11px] text-slate-600 dark:text-slate-400">
            This platform is an automated quantitative analytics and statistical forecasting tool designed for
            market research, momentum visualization, and price pattern analysis. Signals, entry prices, take profit,
            and stop loss levels are computed from historical candlestick structures and mathematical technical indicators.
            It is NOT financial advice or a guaranteed trading signal generator. Never trade with capital you cannot afford to lose.
          </p>
          <div className="text-[10px] text-slate-500 dark:text-slate-600">
            Binance Public WebSocket & REST API • TradingView Lightweight Charts • Real-Time Engine
          </div>
        </footer>
      </main>
    </div>
  );
}
