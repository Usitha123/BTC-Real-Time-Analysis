import React, { useState } from 'react';
import { MarketAlert } from '../types/crypto';
import {
  Bell,
  AlertTriangle,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  Zap,
  Activity,
  CheckCircle,
} from 'lucide-react';

interface AlertsManagerProps {
  alerts: MarketAlert[];
  onDismissAlert: (id: string) => void;
  onAddCustomAlert: (targetPrice: number, condition: 'ABOVE' | 'BELOW') => void;
  customAlerts: { id: string; targetPrice: number; condition: 'ABOVE' | 'BELOW' }[];
  onRemoveCustomAlert: (id: string) => void;
  currentPrice: number;
}

export const AlertsManager: React.FC<AlertsManagerProps> = ({
  alerts,
  onDismissAlert,
  onAddCustomAlert,
  customAlerts,
  onRemoveCustomAlert,
  currentPrice,
}) => {
  const [targetInput, setTargetInput] = useState<string>('');
  const [condition, setCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(targetInput);
    if (!isNaN(price) && price > 0) {
      onAddCustomAlert(price, condition);
      setTargetInput('');
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-2xl backdrop-blur-md flex flex-col space-y-4 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
              Market Sentinel & Alerts
            </h3>
            <span className="text-[10px] text-slate-400">
              Volatility, Breakout & Indicator Triggers
            </span>
          </div>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`p-1.5 rounded border transition-colors cursor-pointer ${
            soundEnabled
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              : 'border-slate-800 text-slate-500'
          }`}
          title={soundEnabled ? 'Alert chimes active' : 'Alert chimes muted'}
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Triggered Live Alerts Feed */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="text-center py-4 text-slate-500 text-[11px]">
            No active volatility or breakout anomalies detected. Sentinel nominal.
          </div>
        ) : (
          alerts.slice(0, 6).map((alt) => {
            const isAlert = alt.severity === 'ALERT';
            const isWarning = alt.severity === 'WARNING';

            return (
              <div
                key={alt.id}
                className={`p-2.5 rounded-lg border flex items-start justify-between gap-2 transition-all ${
                  isAlert
                    ? 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                    : isWarning
                    ? 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                      isAlert ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-blue-400'
                    }`}
                  />
                  <div>
                    <div className="font-bold text-[11px] text-slate-200">{alt.title}</div>
                    <div className="text-[10px] text-slate-400 leading-snug">{alt.message}</div>
                    <span className="text-[9px] text-slate-500 mt-1 block">
                      {new Date(alt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onDismissAlert(alt.id)}
                  className="text-slate-500 hover:text-slate-300 text-[10px] cursor-pointer"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Add Custom Price Alert Form */}
      <div className="border-t border-slate-800 pt-3">
        <span className="text-[10px] text-slate-400 font-bold block mb-2 uppercase">
          Create Custom Price Alert
        </span>
        <form onSubmit={handleAdd} className="flex items-center gap-1.5">
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-300 text-xs focus:outline-none"
          >
            <option value="ABOVE">Price ≥</option>
            <option value="BELOW">Price ≤</option>
          </select>

          <input
            type="number"
            step="any"
            placeholder={`e.g. ${Math.round(currentPrice * 1.01)}`}
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs flex-1 focus:outline-none focus:border-amber-500/60"
          />

          <button
            type="submit"
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Set</span>
          </button>
        </form>

        {/* Active Custom Alerts List */}
        {customAlerts.length > 0 && (
          <div className="mt-2.5 space-y-1">
            <span className="text-[9px] text-slate-500 uppercase">Watched Price Thresholds:</span>
            {customAlerts.map((ca) => (
              <div
                key={ca.id}
                className="flex items-center justify-between bg-slate-950 px-2 py-1 rounded border border-slate-800 text-[11px]"
              >
                <span>
                  Alert if price {ca.condition === 'ABOVE' ? '≥' : '≤'}{' '}
                  <span className="font-bold text-amber-400">${ca.targetPrice.toLocaleString()}</span>
                </span>
                <button
                  onClick={() => onRemoveCustomAlert(ca.id)}
                  className="text-slate-500 hover:text-rose-400 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
