import React, { useState } from 'react';
import { PerformanceStats, PredictionRecord, PredictionTimeframe } from '../types/crypto';
import { HistoryStorageService } from '../services/historyStorage';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  BarChart,
  Percent,
  Calculator,
  RefreshCw,
  Trash2,
} from 'lucide-react';

interface PerformanceHistoryProps {
  stats: PerformanceStats;
  onFilterChange: (period: '24h' | '7d' | '30d' | 'all') => void;
  activeFilter: '24h' | '7d' | '30d' | 'all';
  records: PredictionRecord[];
  onClearHistory: () => void;
}

export const PerformanceHistory: React.FC<PerformanceHistoryProps> = ({
  stats,
  onFilterChange,
  activeFilter,
  records,
  onClearHistory,
}) => {
  const [selectedTfFilter, setSelectedTfFilter] = useState<string>('ALL');

  const filteredRecords = records.filter((r) => {
    if (selectedTfFilter === 'ALL') return true;
    return r.timeframe === selectedTfFilter;
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md flex flex-col space-y-5">
      {/* Header and Filter Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide font-mono">
              Historical Prediction Evaluation & Accuracy
            </h2>
            <p className="text-xs text-slate-400">
              Rigorous out-of-sample backtesting & live forward performance metrics (Zero look-ahead bias)
            </p>
          </div>
        </div>

        {/* Time Filters */}
        <div className="flex items-center gap-1.5 font-mono text-xs">
          {(['24h', '7d', '30d', 'all'] as const).map((period) => (
            <button
              key={period}
              onClick={() => onFilterChange(period)}
              className={`px-2.5 py-1 rounded border transition-all cursor-pointer ${
                activeFilter === period
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-500 shadow-md shadow-amber-500/10'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {period === '24h'
                ? 'Last 24H'
                : period === '7d'
                ? 'Last 7D'
                : period === '30d'
                ? 'Last 30D'
                : 'All-Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Top Quantitative Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 font-mono">
        {/* Directional Accuracy */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Directional Accuracy</span>
            <Award className="w-3.5 h-3.5 text-emerald-400" />
          </span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-emerald-400">
              {stats.directionalAccuracyPct.toFixed(1)}%
            </span>
          </div>
          <span className="text-[10px] text-slate-500">
            {stats.totalEvaluated} completed evaluations
          </span>
        </div>

        {/* Mean Absolute Error (MAE) */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>MAE (Abs Error)</span>
            <Calculator className="w-3.5 h-3.5 text-sky-400" />
          </span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-slate-100">
              ${stats.mae.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
          </div>
          <span className="text-[10px] text-slate-500">Average dollar forecast error</span>
        </div>

        {/* MAPE */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>MAPE (%)</span>
            <Percent className="w-3.5 h-3.5 text-amber-400" />
          </span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-amber-300">
              {stats.mape.toFixed(2)}%
            </span>
          </div>
          <span className="text-[10px] text-slate-500">Mean absolute percentage error</span>
        </div>

        {/* RMSE */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>RMSE (Root MSE)</span>
            <BarChart className="w-3.5 h-3.5 text-purple-400" />
          </span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-purple-300">
              ${stats.rmse.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
          </div>
          <span className="text-[10px] text-slate-500">Penalizes large outliers</span>
        </div>

        {/* Total Sample Size */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Sample Verified</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
          </span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-slate-100">{stats.totalEvaluated}</span>
          </div>
          <span className="text-[10px] text-slate-500">Unseen out-of-sample events</span>
        </div>
      </div>

      {/* Accuracy By Timeframe Breakdown Bars */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 font-mono text-xs">
        <div className="text-xs font-semibold text-slate-300 mb-3 flex items-center justify-between">
          <span>Directional Accuracy By Horizon ({activeFilter.toUpperCase()} Window)</span>
          <span className="text-[10px] text-slate-500">Target Benchmark: &gt;60% statistical edge</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(['1m', '5m', '10m', '15m', '30m', '60m'] as PredictionTimeframe[]).map((tf) => {
            const data = stats.byTimeframe[tf];
            const acc = data?.count > 0 ? data.accuracyPct : 0;
            const count = data?.count || 0;

            return (
              <div key={tf} className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">{tf.toUpperCase()}</span>
                  <span
                    className={`font-bold ${
                      acc >= 65 ? 'text-emerald-400' : acc >= 50 ? 'text-amber-400' : 'text-slate-400'
                    }`}
                  >
                    {acc > 0 ? `${acc}%` : 'N/A'}
                  </span>
                </div>

                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full ${
                      acc >= 65 ? 'bg-emerald-500' : acc >= 50 ? 'bg-amber-500' : 'bg-slate-600'
                    }`}
                    style={{ width: `${acc}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>n={count}</span>
                  <span>MAE: ${data?.mae || 0}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historical Evaluation Log Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-300">Historical Evaluation Log</span>
            <span className="text-[11px] font-mono text-slate-500">
              ({filteredRecords.length} records in view)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter by timeframe pill */}
            <select
              value={selectedTfFilter}
              onChange={(e) => setSelectedTfFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Horizons</option>
              <option value="1m">1m</option>
              <option value="5m">5m</option>
              <option value="10m">10m</option>
              <option value="15m">15m</option>
              <option value="30m">30m</option>
              <option value="60m">60m</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-72 overflow-y-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-950 sticky top-0 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
              <tr>
                <th className="py-2 px-3">Time</th>
                <th className="py-2 px-3">Horizon</th>
                <th className="py-2 px-3">Pred Price</th>
                <th className="py-2 px-3">Predicted</th>
                <th className="py-2 px-3">Actual Expiry Price</th>
                <th className="py-2 px-3">Actual Dir</th>
                <th className="py-2 px-3">Result</th>
                <th className="py-2 px-3">Error ($ / %)</th>
                <th className="py-2 px-3">Conf</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-slate-500 text-xs">
                    No evaluated predictions in this time window yet. Active forward predictions are tracking.
                  </td>
                </tr>
              ) : (
                filteredRecords.slice(0, 30).map((r) => {
                  const isPending = r.status === 'PENDING';
                  const isCorrect = r.isDirectionCorrect;

                  return (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3 text-slate-400 whitespace-nowrap text-[11px]">
                        {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-200">{r.timeframe}</td>
                      <td className="py-2 px-3 text-slate-300 font-bold">${r.predictedPrice.toFixed(1)}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            r.predictedDirection === 'UP'
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                              : r.predictedDirection === 'DOWN'
                              ? 'bg-rose-950/40 text-rose-400 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {r.predictedDirection === 'UP' && <TrendingUp className="w-2.5 h-2.5" />}
                          {r.predictedDirection === 'DOWN' && <TrendingDown className="w-2.5 h-2.5" />}
                          {r.predictedDirection}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-300">
                        {isPending ? (
                          <span className="text-amber-400/90 flex items-center gap-1 text-[11px]">
                            <Clock className="w-3 h-3 animate-pulse" /> Pending
                          </span>
                        ) : (
                          `$${r.actualPriceAtExpiry?.toFixed(1) || 'N/A'}`
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-[10px]">
                        {isPending ? '-' : r.actualDirection}
                      </td>
                      <td className="py-2 px-3">
                        {isPending ? (
                          <span className="text-slate-500 text-[10px]">In progress</span>
                        ) : isCorrect ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Hit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-bold text-[11px]">
                            <XCircle className="w-3.5 h-3.5" /> Miss
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-300 text-[11px] whitespace-nowrap">
                        {isPending ? '-' : `$${r.absoluteError?.toFixed(1)} (${r.percentageError?.toFixed(2)}%)`}
                      </td>
                      <td className="py-2 px-3 text-slate-400">{r.confidence}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
