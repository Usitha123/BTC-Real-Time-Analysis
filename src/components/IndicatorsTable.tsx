import React, { useState } from 'react';
import { TechnicalIndicators, IndicatorInterpretation } from '../types/crypto';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  SlidersHorizontal,
  BarChart2,
  Gauge,
  Flame,
  Search,
} from 'lucide-react';

interface IndicatorsTableProps {
  indicators: TechnicalIndicators | null;
  currentPrice: number;
}

type Category = 'ALL' | 'TREND' | 'MOMENTUM' | 'VOLATILITY' | 'VOLUME';

export const IndicatorsTable: React.FC<IndicatorsTableProps> = ({ indicators, currentPrice }) => {
  const [selectedCategory, setSelectedCategory] = useState<Category>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  if (!indicators) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 text-center text-slate-500 font-mono text-xs">
        Streaming real candlestick data for technical indicator calculations...
      </div>
    );
  }

  // Build row definitions
  const rows = [
    // Trend
    {
      category: 'TREND',
      name: 'EMA 9',
      value: `$${indicators.ema9.toFixed(2)}`,
      signal: currentPrice > indicators.ema9 ? 'BULLISH' : 'BEARISH',
      detail: currentPrice > indicators.ema9 ? 'Price above fast momentum curve' : 'Price trailing fast momentum curve',
    },
    {
      category: 'TREND',
      name: 'EMA 20',
      value: `$${indicators.ema20.toFixed(2)}`,
      signal: currentPrice > indicators.ema20 ? 'BULLISH' : 'BEARISH',
      detail: currentPrice > indicators.ema20 ? 'Short-term trend support maintained' : 'Short-term trend resistance overhead',
    },
    {
      category: 'TREND',
      name: 'EMA 50',
      value: `$${indicators.ema50.toFixed(2)}`,
      signal: currentPrice > indicators.ema50 ? 'BULLISH' : 'BEARISH',
      detail: currentPrice > indicators.ema50 ? 'Intermediate bullish support holding' : 'Intermediate bearish pressure dominant',
    },
    {
      category: 'TREND',
      name: 'EMA 100',
      value: `$${indicators.ema100.toFixed(2)}`,
      signal: currentPrice > indicators.ema100 ? 'BULLISH' : 'BEARISH',
      detail: currentPrice > indicators.ema100 ? 'Institutional cycle bias bullish' : 'Institutional cycle bias bearish',
    },
    {
      category: 'TREND',
      name: 'EMA 200',
      value: `$${indicators.ema200.toFixed(2)}`,
      signal: currentPrice > indicators.ema200 ? 'BULLISH' : 'BEARISH',
      detail: currentPrice > indicators.ema200 ? 'Macro bull market regime baseline' : 'Macro bear market regime baseline',
    },
    {
      category: 'TREND',
      name: 'SMA 20',
      value: `$${indicators.sma20.toFixed(2)}`,
      signal: currentPrice > indicators.sma20 ? 'BULLISH' : 'BEARISH',
      detail: '20-period arithmetic mean trend line',
    },
    {
      category: 'TREND',
      name: 'SMA 50',
      value: `$${indicators.sma50.toFixed(2)}`,
      signal: currentPrice > indicators.sma50 ? 'BULLISH' : 'BEARISH',
      detail: '50-period arithmetic mean trend line',
    },
    {
      category: 'TREND',
      name: 'MACD (12, 26, 9)',
      value: `${indicators.macd.macd.toFixed(2)} / Sig: ${indicators.macd.signal.toFixed(2)} (Hist: ${indicators.macd.hist.toFixed(2)})`,
      signal: indicators.interpretations['MACD']?.signal || 'NEUTRAL',
      detail: indicators.interpretations['MACD']?.reason || 'Convergence/divergence status',
    },
    {
      category: 'TREND',
      name: 'ADX (14)',
      value: `${indicators.adx.adx.toFixed(1)} (+DI ${indicators.adx.pDi.toFixed(0)} | -DI ${indicators.adx.mDi.toFixed(0)})`,
      signal: indicators.interpretations['ADX']?.signal || 'NEUTRAL',
      detail: indicators.interpretations['ADX']?.reason || 'Trend strength reading',
    },

    // Momentum
    {
      category: 'MOMENTUM',
      name: 'RSI (14)',
      value: indicators.rsi.toFixed(2),
      signal: indicators.interpretations['RSI_14']?.signal || 'NEUTRAL',
      detail: indicators.interpretations['RSI_14']?.reason || 'Relative Strength Index',
    },
    {
      category: 'MOMENTUM',
      name: 'Stochastic RSI (14, 3, 3)',
      value: `K: ${indicators.stochRsi.k.toFixed(1)} | D: ${indicators.stochRsi.d.toFixed(1)}`,
      signal: indicators.interpretations['STOCH_RSI']?.signal || 'NEUTRAL',
      detail: indicators.interpretations['STOCH_RSI']?.reason || 'Stochastic RSI cyclical oscillation',
    },
    {
      category: 'MOMENTUM',
      name: 'Stochastic Oscillator (14, 3)',
      value: `%K: ${indicators.stochOsc.k.toFixed(1)} | %D: ${indicators.stochOsc.d.toFixed(1)}`,
      signal: indicators.stochOsc.k > 80 ? 'BEARISH' : indicators.stochOsc.k < 20 ? 'BULLISH' : 'NEUTRAL',
      detail: indicators.stochOsc.k > 80 ? 'Overbought region' : indicators.stochOsc.k < 20 ? 'Oversold region' : 'Mid-band range',
    },
    {
      category: 'MOMENTUM',
      name: 'Rate of Change (ROC 12)',
      value: `${indicators.roc > 0 ? '+' : ''}${indicators.roc.toFixed(2)}%`,
      signal: indicators.roc > 0.1 ? 'BULLISH' : indicators.roc < -0.1 ? 'BEARISH' : 'NEUTRAL',
      detail: indicators.roc > 0 ? 'Positive price acceleration velocity' : 'Negative price deceleration velocity',
    },

    // Volatility
    {
      category: 'VOLATILITY',
      name: 'Bollinger Bands (20, 2)',
      value: `Upper: $${indicators.bollinger.upper.toFixed(0)} | Lower: $${indicators.bollinger.lower.toFixed(0)}`,
      signal: indicators.interpretations['BOLLINGER']?.signal || 'NEUTRAL',
      detail: `BandWidth: ${(indicators.bollinger.bandWidth * 100).toFixed(2)}% | %B: ${(indicators.bollinger.percentB * 100).toFixed(1)}%`,
    },
    {
      category: 'VOLATILITY',
      name: 'Average True Range (ATR 14)',
      value: `$${indicators.atr.toFixed(2)}`,
      signal: 'NEUTRAL',
      detail: `Average candle volatility spread is $${indicators.atr.toFixed(0)} (~${((indicators.atr / currentPrice) * 100).toFixed(2)}% of price)`,
    },
    {
      category: 'VOLATILITY',
      name: 'Historical Volatility (30p Annualized)',
      value: `${indicators.histVol.toFixed(1)}%`,
      signal: indicators.histVol > 50 ? 'BEARISH' : 'NEUTRAL',
      detail: indicators.histVol > 50 ? 'Elevated volatility regime' : 'Normal volatility distribution',
    },

    // Volume
    {
      category: 'VOLUME',
      name: 'Volume SMA (20)',
      value: `${indicators.volumeSma.toFixed(2)} BTC`,
      signal: indicators.volumeRatio > 1.2 ? 'BULLISH' : 'NEUTRAL',
      detail: `Current volume is ${(indicators.volumeRatio * 100).toFixed(0)}% of 20-SMA baseline`,
    },
    {
      category: 'VOLUME',
      name: 'VWAP',
      value: `$${indicators.vwap.toFixed(2)}`,
      signal: indicators.interpretations['VWAP']?.signal || 'NEUTRAL',
      detail: indicators.interpretations['VWAP']?.reason || 'Institutional benchmark price',
    },
    {
      category: 'VOLUME',
      name: 'On-Balance Volume (OBV)',
      value: indicators.interpretations['OBV']?.value || 'N/A',
      signal: indicators.interpretations['OBV']?.signal || 'NEUTRAL',
      detail: indicators.interpretations['OBV']?.reason || 'Volume accumulation vs distribution',
    },
    {
      category: 'VOLUME',
      name: 'Volume Change %',
      value: `${indicators.volumeChangePct > 0 ? '+' : ''}${indicators.volumeChangePct.toFixed(1)}%`,
      signal: indicators.volumeChangePct > 50 ? 'BULLISH' : indicators.volumeChangePct < -50 ? 'BEARISH' : 'NEUTRAL',
      detail: 'Single-candle volume acceleration vs prior candle',
    },
  ];

  // Filtering
  const filteredRows = rows.filter((r) => {
    const matchesCat = selectedCategory === 'ALL' || r.category === selectedCategory;
    const matchesSearch =
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.detail.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md flex flex-col space-y-4">
      {/* Table Header and Category Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide font-mono">
              Quantitative Technical Matrix
            </h2>
            <p className="text-xs text-slate-400">
              Live mathematical indicator suite computed from current market candles
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search indicator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 w-44"
          />
        </div>
      </div>

      {/* Categories Toolbar */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        {(['ALL', 'TREND', 'MOMENTUM', 'VOLATILITY', 'VOLUME'] as Category[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded-lg border transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-amber-500 text-slate-950 font-bold border-amber-500 shadow-md shadow-amber-500/10'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-3">Indicator</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3">Calculated Value</th>
              <th className="py-2.5 px-3">Signal</th>
              <th className="py-2.5 px-3">Quantitative Interpretation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
            {filteredRows.map((r, i) => {
              const isBull = r.signal === 'BULLISH';
              const isBear = r.signal === 'BEARISH';

              return (
                <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-slate-200 whitespace-nowrap">{r.name}</td>
                  <td className="py-2.5 px-3 text-slate-500 text-[10px] uppercase">{r.category}</td>
                  <td className="py-2.5 px-3 text-slate-300 font-bold whitespace-nowrap">{r.value}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                        isBull
                          ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/40'
                          : isBear
                          ? 'bg-rose-950/30 text-rose-400 border-rose-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {isBull && <TrendingUp className="w-3 h-3" />}
                      {isBear && <TrendingDown className="w-3 h-3" />}
                      {!isBull && !isBear && <Minus className="w-3 h-3" />}
                      {r.signal}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 text-[11px] font-sans">{r.detail}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
