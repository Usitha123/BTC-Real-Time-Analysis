import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  LineStyle,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
} from 'lightweight-charts';
import { Candle, ChartTimeframe, TechnicalIndicators, PredictionResult } from '../types/crypto';
import { TradeSignalSetup } from '../services/signalAnalyzer';
import {
  Sliders,
  Activity,
  Target,
  Crosshair,
} from 'lucide-react';

interface TradingChartProps {
  candles: Candle[];
  timeframe: ChartTimeframe;
  onTimeframeChange: (tf: ChartTimeframe) => void;
  indicators: TechnicalIndicators | null;
  activePrediction: PredictionResult | null;
  signalSetup?: TradeSignalSetup | null;
  isDarkMode?: boolean;
}

const TIMEFRAMES: ChartTimeframe[] = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];

export const TradingChart: React.FC<TradingChartProps> = ({
  candles,
  timeframe,
  onTimeframeChange,
  indicators,
  activePrediction,
  signalSetup,
  isDarkMode = true,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);

  // Indicator lines
  const ema20SeriesRef = useRef<ISeriesApi<any> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<any> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<any> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<any> | null>(null);

  // Dynamic price lines for Support, Resistance, Target
  const priceLinesRef = useRef<any[]>([]);

  // Legend State for hover
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);

  // Overlay Visibility Toggles
  const [showEMA20, setShowEMA20] = useState(true);
  const [showEMA50, setShowEMA50] = useState(true);
  const [showEMA200, setShowEMA200] = useState(false);
  const [showBB, setShowBB] = useState(true);
  const [showVWAP, setShowVWAP] = useState(true);
  const [showPredictionOverlay, setShowPredictionOverlay] = useState(false);
  const [showSignalLevels, setShowSignalLevels] = useState(true);
  const [showSRLevels, setShowSRLevels] = useState(true);
  const [showControls, setShowControls] = useState(false);

  // 1. Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const bgColor = isDarkMode ? '#0a0d14' : '#ffffff';
    const textColor = isDarkMode ? '#94a3b8' : '#475569';
    const gridColor = isDarkMode ? 'rgba(30, 41, 59, 0.4)' : 'rgba(226, 232, 240, 0.8)';

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 480,
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor: textColor,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: isDarkMode ? '#64748b' : '#94a3b8',
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: isDarkMode ? '#64748b' : '#94a3b8',
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: gridColor,
        scaleMargins: {
          top: 0.1,
          bottom: 0.2, // leave room for volume
        },
      },
      timeScale: {
        borderColor: gridColor,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Add Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = candleSeries;

    // Add Volume Series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#3b82f6',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Overlay on same area
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // Add Technical Indicator Lines
    ema20SeriesRef.current = chart.addSeries(LineSeries, {
      color: '#38bdf8', // cyan
      lineWidth: 2,
      title: 'EMA 20',
    });

    ema50SeriesRef.current = chart.addSeries(LineSeries, {
      color: '#fbbf24', // amber
      lineWidth: 2,
      title: 'EMA 50',
    });

    ema200SeriesRef.current = chart.addSeries(LineSeries, {
      color: '#a855f7', // purple
      lineWidth: 2,
      title: 'EMA 200',
    });

    bbUpperSeriesRef.current = chart.addSeries(LineSeries, {
      color: 'rgba(56, 189, 248, 0.4)',
      lineStyle: LineStyle.Dotted,
      lineWidth: 1,
      title: 'BB Upper',
    });

    bbLowerSeriesRef.current = chart.addSeries(LineSeries, {
      color: 'rgba(56, 189, 248, 0.4)',
      lineStyle: LineStyle.Dotted,
      lineWidth: 1,
      title: 'BB Lower',
    });

    vwapSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#f97316', // orange
      lineStyle: LineStyle.Dashed,
      lineWidth: 2,
      title: 'VWAP',
    });

    // Crosshair move listener for interactive legend
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData || !candleSeriesRef.current) {
        setHoveredCandle(null);
        return;
      }
      const data = param.seriesData.get(candleSeriesRef.current) as any;
      const volData = volumeSeriesRef.current ? (param.seriesData.get(volumeSeriesRef.current) as any) : null;
      if (data && typeof data.close === 'number') {
        setHoveredCandle({
          time: Number(param.time),
          open: data.open ?? data.close,
          high: data.high ?? data.close,
          low: data.low ?? data.close,
          close: data.close,
          volume: typeof volData?.value === 'number' ? volData.value : (data.volume ?? 0),
        });
      } else {
        setHoveredCandle(null);
      }
    });

    // Resize Handler
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [isDarkMode]);

  // 2. Feed Candlestick & Volume Data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return;

    // Filter and sort unique candles by timestamp
    const sorted = [...candles].sort((a, b) => a.time - b.time);
    const uniqueCandles: Candle[] = [];
    const seenTimes = new Set<number>();
    for (const c of sorted) {
      if (!seenTimes.has(c.time)) {
        seenTimes.add(c.time);
        uniqueCandles.push(c);
      }
    }

    candleSeriesRef.current.setData(
      uniqueCandles.map((c) => ({
        time: c.time as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    volumeSeriesRef.current.setData(
      uniqueCandles.map((c) => ({
        time: c.time as any,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
      }))
    );

    // Compute indicator lines across historical candles
    updateIndicatorSeries(uniqueCandles);
  }, [candles]);

  // Calculate indicator paths across candles
  const updateIndicatorSeries = (dataList: Candle[]) => {
    if (dataList.length < 20) return;
    const closes = dataList.map((c) => c.close);

    // Calculate EMA helper
    const calcEMA = (period: number) => {
      const k = 2 / (period + 1);
      const res: { time: any; value: number }[] = [];
      let ema = closes[0];
      for (let i = 0; i < dataList.length; i++) {
        if (i === 0) ema = closes[0];
        else ema = closes[i] * k + ema * (1 - k);
        if (i >= period - 1) {
          res.push({ time: dataList[i].time as any, value: ema });
        }
      }
      return res;
    };

    // Calculate SMA helper
    const calcSMA = (period: number) => {
      const res: { time: any; value: number }[] = [];
      for (let i = period - 1; i < dataList.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += closes[i - j];
        res.push({ time: dataList[i].time as any, value: sum / period });
      }
      return res;
    };

    // EMA 20 & 50 & 200
    if (ema20SeriesRef.current && showEMA20) {
      ema20SeriesRef.current.setData(calcEMA(20));
    } else if (ema20SeriesRef.current) {
      ema20SeriesRef.current.setData([]);
    }

    if (ema50SeriesRef.current && showEMA50) {
      ema50SeriesRef.current.setData(calcEMA(50));
    } else if (ema50SeriesRef.current) {
      ema50SeriesRef.current.setData([]);
    }

    if (ema200SeriesRef.current && showEMA200) {
      ema200SeriesRef.current.setData(calcEMA(Math.min(200, dataList.length)));
    } else if (ema200SeriesRef.current) {
      ema200SeriesRef.current.setData([]);
    }

    // Bollinger Bands (20, 2)
    if (showBB && bbUpperSeriesRef.current && bbLowerSeriesRef.current) {
      const upperData: { time: any; value: number }[] = [];
      const lowerData: { time: any; value: number }[] = [];
      const period = 20;

      for (let i = period - 1; i < dataList.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += closes[i - j];
        const mean = sum / period;

        let sumSq = 0;
        for (let j = 0; j < period; j++) sumSq += Math.pow(closes[i - j] - mean, 2);
        const std = Math.sqrt(sumSq / period);

        upperData.push({ time: dataList[i].time as any, value: mean + 2 * std });
        lowerData.push({ time: dataList[i].time as any, value: mean - 2 * std });
      }
      bbUpperSeriesRef.current.setData(upperData);
      bbLowerSeriesRef.current.setData(lowerData);
    } else {
      bbUpperSeriesRef.current?.setData([]);
      bbLowerSeriesRef.current?.setData([]);
    }

    // VWAP
    if (showVWAP && vwapSeriesRef.current) {
      const vwapData: { time: any; value: number }[] = [];
      let cumVol = 0;
      let cumTypVol = 0;
      for (let i = 0; i < dataList.length; i++) {
        const typ = (dataList[i].high + dataList[i].low + dataList[i].close) / 3;
        cumTypVol += typ * dataList[i].volume;
        cumVol += dataList[i].volume;
        if (cumVol > 0) {
          vwapData.push({ time: dataList[i].time as any, value: cumTypVol / cumVol });
        }
      }
      vwapSeriesRef.current.setData(vwapData);
    } else {
      vwapSeriesRef.current?.setData([]);
    }
  };

  // Re-run indicator data when toggles change
  useEffect(() => {
    if (candles.length > 20) {
      updateIndicatorSeries(candles);
    }
  }, [showEMA20, showEMA50, showEMA200, showBB, showVWAP]);

  // 3. Update Support, Resistance & Prediction Price Lines
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Clear existing price lines
    priceLinesRef.current.forEach((line) => {
      try {
        candleSeriesRef.current?.removePriceLine(line);
      } catch {}
    });
    priceLinesRef.current = [];

    // Support and Resistance lines (from prior chart swings or Bollinger Bands)
    if (showSRLevels && indicators) {
      const rLevel = signalSetup ? signalSetup.swingResistance : indicators.bollinger.upper;
      const sLevel = signalSetup ? signalSetup.swingSupport : indicators.bollinger.lower;

      const rLine = candleSeriesRef.current.createPriceLine({
        price: rLevel,
        color: 'rgba(239, 68, 68, 0.45)',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: `Prev Res $${rLevel.toFixed(0)}`,
      });
      priceLinesRef.current.push(rLine);

      const sLine = candleSeriesRef.current.createPriceLine({
        price: sLevel,
        color: 'rgba(16, 185, 129, 0.45)',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: `Prev Supp $${sLevel.toFixed(0)}`,
      });
      priceLinesRef.current.push(sLine);
    }

    // Trade Signal Overlay (Entry Price, Take Profit 1 & 2, Stop Loss)
    if (showSignalLevels && signalSetup) {
      const entryLine = candleSeriesRef.current.createPriceLine({
        price: signalSetup.entryPrice,
        color: '#f59e0b',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `Entry (${signalSetup.action}): $${signalSetup.entryPrice.toFixed(1)}`,
      });
      priceLinesRef.current.push(entryLine);

      const tp1Line = candleSeriesRef.current.createPriceLine({
        price: signalSetup.takeProfit1,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `TP1: $${signalSetup.takeProfit1.toFixed(1)}`,
      });
      priceLinesRef.current.push(tp1Line);

      const tp2Line = candleSeriesRef.current.createPriceLine({
        price: signalSetup.takeProfit2,
        color: '#14b8a6',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `TP2: $${signalSetup.takeProfit2.toFixed(1)}`,
      });
      priceLinesRef.current.push(tp2Line);

      const slLine = candleSeriesRef.current.createPriceLine({
        price: signalSetup.stopLoss,
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `Stop Loss: $${signalSetup.stopLoss.toFixed(1)}`,
      });
      priceLinesRef.current.push(slLine);
    }

    // Prediction Target Overlay
    if (showPredictionOverlay && activePrediction) {
      const isBull = activePrediction.direction === 'UP';
      const color = isBull ? '#10b981' : activePrediction.direction === 'DOWN' ? '#ef4444' : '#94a3b8';

      const targetLine = candleSeriesRef.current.createPriceLine({
        price: activePrediction.predictedPrice,
        color: color,
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `Forecast ${activePrediction.timeframe}: $${activePrediction.predictedPrice}`,
      });
      priceLinesRef.current.push(targetLine);
    }
  }, [indicators, activePrediction, signalSetup, showSignalLevels, showPredictionOverlay, showSRLevels]);

  const latestCandle = candles[candles.length - 1];
  const activeCandle = hoveredCandle || latestCandle;

  return (
    <div className="relative flex flex-col w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Top Header & Chart Controls */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 gap-2">
        {/* Timeframe Selector Buttons */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-2 flex items-center gap-1 whitespace-nowrap shrink-0">
            <Activity className="w-3.5 h-3.5 text-amber-500" />
            <span>Chart</span>
          </span>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                timeframe === tf
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800'
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Indicator & Signal Toggles */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowControls(!showControls)}
            className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              showControls
                ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
                : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Indicators ({[showEMA20, showEMA50, showEMA200, showBB, showVWAP].filter(Boolean).length})</span>
          </button>

          {signalSetup && (
            <button
              onClick={() => setShowSignalLevels(!showSignalLevels)}
              className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                showSignalLevels
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300'
                  : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Entry / TP / SL</span>
            </button>
          )}

          {activePrediction && (
            <button
              onClick={() => setShowPredictionOverlay(!showPredictionOverlay)}
              className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                showPredictionOverlay
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Forecast</span>
            </button>
          )}
        </div>
      </div>

      {/* Dropdown Indicator Filter Bar */}
      {showControls && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer text-sky-600 dark:text-sky-400">
            <input
              type="checkbox"
              checked={showEMA20}
              onChange={(e) => setShowEMA20(e.target.checked)}
              className="rounded accent-sky-500 cursor-pointer"
            />
            EMA 20
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-amber-600 dark:text-amber-400">
            <input
              type="checkbox"
              checked={showEMA50}
              onChange={(e) => setShowEMA50(e.target.checked)}
              className="rounded accent-amber-500 cursor-pointer"
            />
            EMA 50
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-purple-600 dark:text-purple-400">
            <input
              type="checkbox"
              checked={showEMA200}
              onChange={(e) => setShowEMA200(e.target.checked)}
              className="rounded accent-purple-500 cursor-pointer"
            />
            EMA 200
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-cyan-600 dark:text-cyan-400">
            <input
              type="checkbox"
              checked={showBB}
              onChange={(e) => setShowBB(e.target.checked)}
              className="rounded accent-cyan-500 cursor-pointer"
            />
            Bollinger (20, 2)
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-orange-600 dark:text-orange-400">
            <input
              type="checkbox"
              checked={showVWAP}
              onChange={(e) => setShowVWAP(e.target.checked)}
              className="rounded accent-orange-500 cursor-pointer"
            />
            VWAP
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-rose-600 dark:text-rose-400">
            <input
              type="checkbox"
              checked={showSRLevels}
              onChange={(e) => setShowSRLevels(e.target.checked)}
              className="rounded accent-rose-500 cursor-pointer"
            />
            Support & Resistance
          </label>
        </div>
      )}

      {/* Floating Price & Candle Legend */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950/40 flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
        <span className="text-slate-700 dark:text-slate-300 font-bold">BTC/USDT</span>
        {activeCandle && typeof activeCandle.close === 'number' && (
          <>
            <span className="text-slate-500 dark:text-slate-400">
              O <span className="text-slate-900 dark:text-slate-200">${(activeCandle.open ?? activeCandle.close).toFixed(2)}</span>
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              H <span className="text-slate-900 dark:text-slate-200">${(activeCandle.high ?? activeCandle.close).toFixed(2)}</span>
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              L <span className="text-slate-900 dark:text-slate-200">${(activeCandle.low ?? activeCandle.close).toFixed(2)}</span>
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              C{' '}
              <span
                className={`font-semibold ${
                  activeCandle.close >= (activeCandle.open ?? activeCandle.close)
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                ${activeCandle.close.toFixed(2)}
              </span>
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              Vol <span className="text-slate-900 dark:text-slate-200">{(activeCandle.volume ?? 0).toFixed(2)}</span>
            </span>
          </>
        )}
      </div>

      {/* Chart Canvas Container */}
      <div ref={chartContainerRef} className="w-full h-[480px]" />

      {/* Bottom Chart Footer info */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 gap-2">
        <div className="flex flex-wrap items-center gap-3">
          {showSignalLevels && signalSetup ? (
            <>
              <span className="text-amber-600 dark:text-amber-400">Entry ${signalSetup.entryPrice.toFixed(0)}</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-600 dark:text-emerald-400">TP1 ${signalSetup.takeProfit1.toFixed(0)}</span>
              <span aria-hidden="true">·</span>
              <span className="text-rose-600 dark:text-rose-400">SL ${signalSetup.stopLoss.toFixed(0)}</span>
            </>
          ) : (
            <span>Scroll to zoom · Drag to pan</span>
          )}
        </div>
        <span>Binance OHLCV + Volume</span>
      </div>
    </div>
  );
};
