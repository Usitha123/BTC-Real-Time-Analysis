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
  FuturesSymbolInfo,
  ScreenerResponse,
  ScreenerSetupEntry,
} from './types/crypto';
import { BinanceDataService, ConnectionStatus } from './services/binance';
import { calculateAllIndicators } from './services/indicators';
import { generateAllTimeframePredictions } from './services/predictionEngine';
import { HistoryStorageService } from './services/historyStorage';
import { computeAllMultiTimeframeSignals, evaluateTimeframe } from './services/multiTimeframe';
import { analyzeAllHorizons, getStrictlyClosedCandles, HORIZON_CONFIG } from './services/signalAnalyzer';
import { formatCoinPrice, getBaseAssetFromSymbol } from './utils/formatters';

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
import { TopCoinsScreener } from './components/TopCoinsScreener';

import { ShieldAlert, LayoutGrid, SlidersHorizontal, BarChart3 } from 'lucide-react';

export default function App() {
  // Theme, View & Selected Futures Market State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'SIMPLE' | 'SCREENER' | 'PRO'>('SIMPLE');
  const [activeHorizon, setActiveHorizon] = useState<TradeHorizon>('5h');
  const [activeSymbol, setActiveSymbol] = useState<string>('BTCUSDT');
  const [futuresSymbols, setFuturesSymbols] = useState<FuturesSymbolInfo[]>([]);
  const [isSymbolsLoading, setIsSymbolsLoading] = useState<boolean>(true);
  const [symbolsLoadError, setSymbolsLoadError] = useState<string | null>(null);

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

  // Multi-Coin Screener State
  const [screenerData, setScreenerData] = useState<ScreenerResponse | null>(null);
  const [isScreenerLoading, setIsScreenerLoading] = useState<boolean>(false);
  const [screenerError, setScreenerError] = useState<string | null>(null);
  const screenerGenRef = useRef<number>(0);

  // Service & Race-Condition Refs
  const binanceServiceRef = useRef<BinanceDataService | null>(null);
  const activeSymbolRef = useRef<string>('BTCUSDT');
  const marketLoadGenRef = useRef<number>(0);
  const isInitialFetchDone = useRef(false);
  const lastRecordedPredictionRef = useRef<number>(0);

  const activeSymbolInfo = useMemo(
    () => futuresSymbols.find((s) => s.symbol === activeSymbol) || null,
    [futuresSymbols, activeSymbol]
  );
  const pricePrecision = activeSymbolInfo?.pricePrecision;
  const baseAsset = getBaseAssetFromSymbol(activeSymbol);

  // Sync dark mode class on root html element for Tailwind v4 dark: variants
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const loadFuturesTelemetry = useCallback(
    async (service: BinanceDataService, symbol: string, gen: number) => {
      try {
        const fm = await service.fetchFuturesMetrics(symbol);
        if (gen !== marketLoadGenRef.current || activeSymbolRef.current !== symbol) return;
        if (fm) {
          setFuturesMetrics(fm);
        }
      } catch (err) {
        console.warn('Futures telemetry fetch warning:', err);
      }
    },
    []
  );

  const loadFuturesSymbols = useCallback(async (serviceOverride?: BinanceDataService) => {
    const service = serviceOverride || binanceServiceRef.current;
    if (!service) return;
    setIsSymbolsLoading(true);
    setSymbolsLoadError(null);
    try {
      const list = await service.fetchFuturesSymbols();
      if (list.length > 0) {
        setFuturesSymbols(list);
      } else {
        setSymbolsLoadError('No USD-M Futures pairs returned. Tap retry to reload.');
      }
    } catch (err: any) {
      setSymbolsLoadError(err?.message || 'Unable to load Binance USD-M Futures pairs');
    } finally {
      setIsSymbolsLoading(false);
    }
  }, []);

  const loadHorizonChartData = useCallback(
    async (service: BinanceDataService, symbol: string, gen: number) => {
      try {
        const map = await service.fetchHorizonChartData(symbol);
        if (gen !== marketLoadGenRef.current || activeSymbolRef.current !== symbol) return;
        if (Object.keys(map).length > 0) {
          setHorizonCandlesMap(map);
        }
      } catch (err) {
        console.warn('Horizon chart fetch warning:', err);
      }
    },
    []
  );

  const loadScreenerData = useCallback(
    async (horizon: TradeHorizon, forceRefresh: boolean = false) => {
      const reqGen = ++screenerGenRef.current;
      setIsScreenerLoading(true);
      setScreenerError(null);

      try {
        let data: ScreenerResponse;
        if (binanceServiceRef.current) {
          data = await binanceServiceRef.current.fetchTopCoinsScreener(horizon, 16, forceRefresh);
        } else {
          const refreshParam = forceRefresh ? '&refresh=1' : '';
          const res = await fetch(`/api/binance/futures/screener?horizon=${horizon}&limit=16${refreshParam}`);
          if (!res.ok) throw new Error('Failed to scan Binance Futures pairs');
          data = (await res.json()) as ScreenerResponse;
        }
        if (reqGen !== screenerGenRef.current) return;
        setScreenerData(data);
      } catch (err: any) {
        if (reqGen !== screenerGenRef.current) return;
        setScreenerError(err?.message || 'Unable to complete live Futures market scan');
      } finally {
        if (reqGen === screenerGenRef.current) {
          setIsScreenerLoading(false);
        }
      }
    },
    []
  );

  const loadRealMultiTimeframeSignals = useCallback(
    async (service: BinanceDataService, symbol: string, gen: number) => {
      try {
        const mtfCandles = await service.fetchMultiTimeframeCandles(symbol);
        if (gen !== marketLoadGenRef.current || activeSymbolRef.current !== symbol) return;

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
    },
    []
  );

  const loadHistoricalData = useCallback(
    async (tf: ChartTimeframe, symbol: string = activeSymbolRef.current, gen: number = marketLoadGenRef.current) => {
      try {
        const service = binanceServiceRef.current;
        if (!service) return;
        const initialCandles = await service.fetchHistoricalKlines(tf, 250, symbol);
        if (gen !== marketLoadGenRef.current || activeSymbolRef.current !== symbol) return;

        if (initialCandles.length > 0) {
          setCandles(initialCandles);
          setClosedChartSnapshot(initialCandles);
          const lastC = initialCandles[initialCandles.length - 1];
          setCurrentPrice(lastC.close);
          setPrevPrice(lastC.close);

          service.fetch24hTicker(symbol).then((t) => {
            if (t && gen === marketLoadGenRef.current && activeSymbolRef.current === symbol) {
              setTicker(t);
            }
          });
          service.fetchOrderBook(15, symbol).then((b) => {
            if (b && gen === marketLoadGenRef.current && activeSymbolRef.current === symbol) {
              setOrderBook(b);
            }
          });
          service.fetchRecentTrades(20, symbol).then((tr) => {
            if (tr && gen === marketLoadGenRef.current && activeSymbolRef.current === symbol) {
              setTrades(tr);
            }
          });
        }
      } catch (err) {
        console.error('Failed to load historical candles:', err);
      }
    },
    []
  );

  // 1. Initialize & Connect to Binance Futures
  useEffect(() => {
    HistoryStorageService.ensureInitialized(68000);
    setHistoryRecords(HistoryStorageService.getAllRecords());
    setPerfStats(HistoryStorageService.calculatePerformanceStats(historyFilter));

    const service = new BinanceDataService(
      {
        onCandle: (candle, isClosed) => {
          setCandles((prev) => {
            if (prev.length === 0) return [candle];
            const last = prev[prev.length - 1];

            if (candle.time === last.time) {
              const updated = [...prev];
              updated[updated.length - 1] = candle;
              if (isClosed) {
                setClosedChartSnapshot(updated);
              }
              return updated;
            } else if (candle.time > last.time) {
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
      },
      activeSymbolRef.current
    );

    binanceServiceRef.current = service;

    // Fetch all active USD-M Futures symbols for searchable header selector
    loadFuturesSymbols(service);

    const initialGen = ++marketLoadGenRef.current;
    const initialSym = activeSymbolRef.current;

    // Initial historical backfill (defaults to 1h chart for 5h trade horizon)
    loadHistoricalData('1h', initialSym, initialGen);
    loadRealMultiTimeframeSignals(service, initialSym, initialGen);
    loadHorizonChartData(service, initialSym, initialGen);
    loadFuturesTelemetry(service, initialSym, initialGen);

    // Refresh MTF, Futures telemetry & closed horizon candles every 3 minutes for the currently selected symbol
    const mtfInterval = setInterval(() => {
      const currentSym = activeSymbolRef.current;
      const currentGen = marketLoadGenRef.current;
      loadRealMultiTimeframeSignals(service, currentSym, currentGen);
      loadHorizonChartData(service, currentSym, currentGen);
      loadFuturesTelemetry(service, currentSym, currentGen);
    }, 180000);

    service.connect('1h', initialSym);
    loadScreenerData('5h', false);

    return () => {
      clearInterval(mtfInterval);
      service.destroy();
      binanceServiceRef.current = null;
    };
  }, [loadFuturesSymbols, loadFuturesTelemetry, loadHorizonChartData, loadRealMultiTimeframeSignals, loadHistoricalData, loadScreenerData]);

  // Switch active Futures symbol
  const handleSelectSymbol = useCallback(
    (newSymbol: string) => {
      const sym = newSymbol.toUpperCase();
      if (sym === activeSymbolRef.current) return;

      const gen = ++marketLoadGenRef.current;
      activeSymbolRef.current = sym;
      setActiveSymbol(sym);

      // Clear previous coin state so indicators/signals never mix prices across coins
      setCandles([]);
      setClosedChartSnapshot([]);
      setHorizonCandlesMap({});
      setTicker(null);
      setCurrentPrice(0);
      setPrevPrice(0);
      setOrderBook(null);
      setTrades([]);
      setIndicators(null);
      setMultiTfSignals([]);
      setFuturesMetrics(null);
      setPredictions({
        '1m': null,
        '5m': null,
        '10m': null,
        '15m': null,
        '30m': null,
        '60m': null,
      });
      setAiAnalysis(null);
      isInitialFetchDone.current = false;

      const service = binanceServiceRef.current;
      if (service) {
        service.switchMarket(sym, activeTimeframe);
        loadHistoricalData(activeTimeframe, sym, gen);
        loadRealMultiTimeframeSignals(service, sym, gen);
        loadHorizonChartData(service, sym, gen);
        loadFuturesTelemetry(service, sym, gen);
      }
    },
    [activeTimeframe, loadHistoricalData, loadRealMultiTimeframeSignals, loadHorizonChartData, loadFuturesTelemetry]
  );

  const handleTimeframeChange = (newTf: ChartTimeframe) => {
    setActiveTimeframe(newTf);
    loadHistoricalData(newTf, activeSymbolRef.current, marketLoadGenRef.current);
    binanceServiceRef.current?.switchTimeframe(newTf);
  };

  const handleSelectHorizon = (horizon: TradeHorizon) => {
    setActiveHorizon(horizon);
    const targetTf = HORIZON_CONFIG[horizon].chartTf;
    if (activeTimeframe !== targetTf) {
      handleTimeframeChange(targetTf);
    }
    loadScreenerData(horizon, false);
  };

  const handleSelectScreenerCoin = (entry: ScreenerSetupEntry) => {
    if (entry.horizon !== activeHorizon) {
      setActiveHorizon(entry.horizon);
      const targetTf = HORIZON_CONFIG[entry.horizon].chartTf;
      if (activeTimeframe !== targetTf) {
        setActiveTimeframe(targetTf);
      }
    }
    handleSelectSymbol(entry.symbol);
    setViewMode('SIMPLE');
  };

  // 4. Sentinel Alerts Evaluator
  const evaluateMarketAlerts = useCallback(
    (ind: TechnicalIndicators, price: number) => {
      const newAlerts: MarketAlert[] = [];

      if (ind.bollinger.bandWidth > 0.04) {
        newAlerts.push({
          id: `vol-${Date.now()}`,
          title: 'High Volatility Regime Warning',
          message: `${baseAsset} Bollinger BandWidth expanded to ${(ind.bollinger.bandWidth * 100).toFixed(2)}%. ATR is $${formatCoinPrice(ind.atr, price, pricePrecision)}.`,
          type: 'VOLATILITY',
          severity: 'WARNING',
          timestamp: Date.now(),
        });
      }

      if (ind.rsi > 75) {
        newAlerts.push({
          id: `rsi-ob-${Date.now()}`,
          title: 'RSI Extreme Overbought (Exhaustion Risk)',
          message: `${baseAsset} RSI-14 reached ${ind.rsi.toFixed(1)}. Bearish mean-reversion probability elevated.`,
          type: 'RSI',
          severity: 'ALERT',
          timestamp: Date.now(),
        });
      } else if (ind.rsi < 25) {
        newAlerts.push({
          id: `rsi-os-${Date.now()}`,
          title: 'RSI Extreme Oversold (Bounce Setup)',
          message: `${baseAsset} RSI-14 depressed at ${ind.rsi.toFixed(1)}. Bullish relief bounce setup forming.`,
          type: 'RSI',
          severity: 'ALERT',
          timestamp: Date.now(),
        });
      }

      if (ind.volumeRatio > 2.2) {
        newAlerts.push({
          id: `vol-surge-${Date.now()}`,
          title: 'Institutional Volume Surge',
          message: `${baseAsset} volume is ${(ind.volumeRatio * 100).toFixed(0)}% of 20-period baseline.`,
          type: 'VOLUME_SPIKE',
          severity: 'INFO',
          timestamp: Date.now(),
        });
      }

      customAlerts.forEach((ca) => {
        if (ca.condition === 'ABOVE' && price >= ca.targetPrice) {
          newAlerts.push({
            id: `cust-${ca.id}`,
            title: 'Custom Price Alert Triggered',
            message: `${baseAsset} reached above watched target: $${formatCoinPrice(ca.targetPrice, price, pricePrecision)} (Now $${formatCoinPrice(price, price, pricePrecision)})`,
            type: 'CUSTOM',
            severity: 'ALERT',
            timestamp: Date.now(),
          });
        } else if (ca.condition === 'BELOW' && price <= ca.targetPrice) {
          newAlerts.push({
            id: `cust-${ca.id}`,
            title: 'Custom Price Alert Triggered',
            message: `${baseAsset} dropped below watched target: $${formatCoinPrice(ca.targetPrice, price, pricePrecision)} (Now $${formatCoinPrice(price, price, pricePrecision)})`,
            type: 'CUSTOM',
            severity: 'ALERT',
            timestamp: Date.now(),
          });
        }
      });

      if (newAlerts.length > 0) {
        setAlerts((prev) => {
          const existingTitles = new Set(prev.map((a) => a.title));
          const filteredNew = newAlerts.filter((a) => !existingTitles.has(a.title));
          return [...filteredNew, ...prev.slice(0, 10)];
        });
      }
    },
    [baseAsset, pricePrecision, customAlerts]
  );

  // 3. Indicator & Prediction Calculations on Candle Updates
  useEffect(() => {
    if (candles.length < 20 || currentPrice === 0) return;

    const calculated = calculateAllIndicators(candles);
    if (calculated) {
      setIndicators(calculated);

      setMultiTfSignals((prev) => (prev.length >= 4 ? prev : computeAllMultiTimeframeSignals(candles)));

      const newPredictions = generateAllTimeframePredictions(candles, calculated, currentPrice, pricePrecision);
      setPredictions(newPredictions);

      evaluateMarketAlerts(calculated, currentPrice);

      const now = Date.now();
      if (now - lastRecordedPredictionRef.current > 30000 && newPredictions['15m']) {
        lastRecordedPredictionRef.current = now;
        (['1m', '5m', '10m', '15m', '30m', '60m'] as PredictionTimeframe[]).forEach((tf) => {
          const p = newPredictions[tf];
          if (p) {
            HistoryStorageService.addPrediction({
              id: `pred-${activeSymbol}-${tf}-${now}`,
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

      HistoryStorageService.evaluatePending(currentPrice);
      setHistoryRecords(HistoryStorageService.getAllRecords());
      setPerfStats(HistoryStorageService.calculatePerformanceStats(historyFilter));
    }
  }, [candles, currentPrice, activeSymbol, pricePrecision, evaluateMarketAlerts, historyFilter]);

  // 5. Fetch Gemini AI Synthesis
  const fetchGeminiAnalysis = useCallback(async () => {
    if (currentPrice === 0) return;
    setIsAiLoading(true);
    setAiError(null);

    try {
      const payload = {
        symbol: activeSymbol,
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
  }, [activeSymbol, currentPrice, ticker, indicators, multiTfSignals, predictions, activeTimeframe]);

  // Initial AI call once market data stabilizes for a symbol
  useEffect(() => {
    if (currentPrice > 0 && indicators && !isInitialFetchDone.current) {
      isInitialFetchDone.current = true;
      fetchGeminiAnalysis();
    }
  }, [currentPrice, indicators, fetchGeminiAnalysis]);

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
  const allHorizonSignals = useMemo(
    () =>
      analyzeAllHorizons(
        horizonCandlesMap,
        multiTfSignals,
        closedChartSnapshot,
        futuresMetrics,
        activeSymbol,
        pricePrecision
      ),
    [horizonCandlesMap, multiTfSignals, closedChartSnapshot, futuresMetrics, activeSymbol, pricePrecision]
  );

  const signalSetup = allHorizonSignals[activeHorizon];

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 dark:bg-[#06090e] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Top Header with Searchable USD-M Futures Coin Dropdown */}
      <Header
        activeSymbol={activeSymbol}
        futuresSymbols={futuresSymbols}
        onSelectSymbol={handleSelectSymbol}
        isSymbolsLoading={isSymbolsLoading}
        symbolsLoadError={symbolsLoadError}
        onRetryLoadSymbols={() => loadFuturesSymbols()}
        pricePrecision={pricePrecision}
        ticker={ticker}
        currentPrice={currentPrice}
        prevPrice={prevPrice}
        connectionStatus={connectionStatus}
        latencyMs={latencyMs}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        onManualRefresh={() => {
          const gen = marketLoadGenRef.current;
          if (futuresSymbols.length === 0) {
            loadFuturesSymbols();
          }
          loadHistoricalData(activeTimeframe, activeSymbol, gen);
          if (binanceServiceRef.current) {
            loadRealMultiTimeframeSignals(binanceServiceRef.current, activeSymbol, gen);
            loadHorizonChartData(binanceServiceRef.current, activeSymbol, gen);
            loadFuturesTelemetry(binanceServiceRef.current, activeSymbol, gen);
          }
          fetchGeminiAnalysis();
        }}
        isRefreshing={isAiLoading}
      />

      {/* Workspace Mode Toolbar */}
      <div className="border-b border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-950/60">
        <div className="max-w-[1720px] mx-auto px-3 sm:px-5 py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="grid grid-cols-3 sm:inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full sm:w-auto">
            <button
              onClick={() => setViewMode('SIMPLE')}
              className={`inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'SIMPLE'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Simple Signal</span>
            </button>
            <button
              onClick={() => setViewMode('SCREENER')}
              className={`inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'SCREENER'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Top Coins</span>
            </button>
            <button
              onClick={() => setViewMode('PRO')}
              className={`inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'PRO'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Pro Terminal</span>
            </button>
          </div>

          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums leading-snug">
            {viewMode === 'SIMPLE'
              ? `${activeSymbol} · Stable ${HORIZON_CONFIG[activeHorizon].label} setup locked on closed ${HORIZON_CONFIG[activeHorizon].chartTf} chart (${signalSetup?.totalCriteria ?? 20} criteria)`
              : viewMode === 'SCREENER'
              ? `Scanning Top ${screenerData?.scannedCount ?? 16} Liquid USD-M Futures Pairs · ${HORIZON_CONFIG[activeHorizon].label} · 20 Indicators + 7 Timeframes`
              : `${activeSymbol} · Full Quantitative Futures Terminal · Order Book & AI Synthesis`}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-[1720px] mx-auto p-3 sm:p-4 md:p-5 space-y-5">
        {viewMode === 'SIMPLE' ? (
          <SimpleSignalView
            symbol={activeSymbol}
            baseAsset={baseAsset}
            pricePrecision={pricePrecision}
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
            topCoins={screenerData?.setups}
            isTopCoinsLoading={isScreenerLoading}
            onOpenScreener={() => setViewMode('SCREENER')}
            onSelectScreenerCoin={handleSelectScreenerCoin}
          />
        ) : viewMode === 'SCREENER' ? (
          <TopCoinsScreener
            screenerData={screenerData}
            isLoading={isScreenerLoading}
            error={screenerError}
            activeHorizon={activeHorizon}
            activeSymbol={activeSymbol}
            onChangeHorizon={(h) => handleSelectHorizon(h)}
            onRefresh={() => loadScreenerData(activeHorizon, true)}
            onSelectCoin={handleSelectScreenerCoin}
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
                pricePrecision={pricePrecision}
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
                  symbol={activeSymbol}
                  pricePrecision={pricePrecision}
                />

                {/* Multi-Timeframe Matrix (1m to 1d) */}
                <MultiTimeframeMatrix signals={multiTfSignals} />
              </div>

              {/* Right Panel: Order Book, Live Trades & Sentinel Alerts */}
              <div className="lg:col-span-1 space-y-4">
                <div className="h-[400px] sm:h-[480px]">
                  <OrderBookAndTrades
                    orderBook={orderBook}
                    trades={trades}
                    currentPrice={currentPrice}
                    symbol={activeSymbol}
                    pricePrecision={pricePrecision}
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
                symbol={activeSymbol}
                pricePrecision={pricePrecision}
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
              <IndicatorsTable
                indicators={indicators}
                currentPrice={currentPrice}
                symbol={activeSymbol}
                pricePrecision={pricePrecision}
              />
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
            Binance USD-M Futures WebSocket &amp; REST API • TradingView Lightweight Charts • Real-Time Engine
          </div>
        </footer>
      </main>
    </div>
  );
}
