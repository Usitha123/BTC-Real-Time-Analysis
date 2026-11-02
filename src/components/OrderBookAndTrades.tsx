import React, { useState } from 'react';
import { OrderBook, Trade } from '../types/crypto';
import { BookOpen, Zap, ArrowDownUp, Shield } from 'lucide-react';

interface OrderBookAndTradesProps {
  orderBook: OrderBook | null;
  trades: Trade[];
  currentPrice: number;
}

export const OrderBookAndTrades: React.FC<OrderBookAndTradesProps> = ({
  orderBook,
  trades,
  currentPrice,
}) => {
  const [tab, setTab] = useState<'BOOK' | 'TRADES'>('BOOK');

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-2xl backdrop-blur-md flex flex-col h-full space-y-3 font-mono text-xs">
      {/* Tab Switcher Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-1.5 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setTab('BOOK')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              tab === 'BOOK'
                ? 'bg-slate-800 text-slate-100 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>Order Book</span>
          </button>
          <button
            onClick={() => setTab('TRADES')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              tab === 'TRADES'
                ? 'bg-slate-800 text-slate-100 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Live Trades</span>
          </button>
        </div>

        {tab === 'BOOK' && orderBook && (
          <span className="text-[10px] text-slate-400">
            Spread: <span className="text-slate-200 font-bold">${orderBook.spread.toFixed(2)}</span> ({orderBook.spreadPercent.toFixed(3)}%)
          </span>
        )}
      </div>

      {/* Tab: Order Book */}
      {tab === 'BOOK' && (
        <div className="flex flex-col flex-1 justify-between space-y-1">
          {/* Table headers */}
          <div className="grid grid-cols-3 text-[10px] text-slate-500 uppercase pb-1 border-b border-slate-800/60 font-semibold">
            <span>Price (USDT)</span>
            <span className="text-right">Size (BTC)</span>
            <span className="text-right">Total (BTC)</span>
          </div>

          {!orderBook ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              Streaming Binance live depth...
            </div>
          ) : (
            <>
              {/* Asks (Sell orders - Red) in reverse so lowest ask is closest to spread */}
              <div className="space-y-0.5 overflow-hidden">
                {orderBook.asks.slice(0, 6).reverse().map((ask, i) => (
                  <div key={i} className="relative grid grid-cols-3 py-0.5 text-[11px] items-center">
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-rose-500/10 pointer-events-none rounded-sm transition-all"
                      style={{ width: `${Math.min(100, ask.percent * 1.5)}%` }}
                    />
                    <span className="text-rose-400 font-bold z-10">${ask.price.toFixed(2)}</span>
                    <span className="text-right text-slate-300 z-10">{ask.quantity.toFixed(3)}</span>
                    <span className="text-right text-slate-400 z-10">{ask.total.toFixed(3)}</span>
                  </div>
                ))}
              </div>

              {/* Mid Price & Spread Bar */}
              <div className="my-1.5 py-1.5 px-2 bg-slate-950/80 rounded border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold text-slate-100 font-mono">
                    ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-500">Market</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  B/A Skew: {orderBook.bidDepthTotal > orderBook.askDepthTotal ? 'Buyers +' : 'Sellers +'}
                </div>
              </div>

              {/* Bids (Buy orders - Green) */}
              <div className="space-y-0.5 overflow-hidden">
                {orderBook.bids.slice(0, 6).map((bid, i) => (
                  <div key={i} className="relative grid grid-cols-3 py-0.5 text-[11px] items-center">
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 pointer-events-none rounded-sm transition-all"
                      style={{ width: `${Math.min(100, bid.percent * 1.5)}%` }}
                    />
                    <span className="text-emerald-400 font-bold z-10">${bid.price.toFixed(2)}</span>
                    <span className="text-right text-slate-300 z-10">{bid.quantity.toFixed(3)}</span>
                    <span className="text-right text-slate-400 z-10">{bid.total.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: Recent Trades */}
      {tab === 'TRADES' && (
        <div className="flex flex-col flex-1 space-y-1 overflow-hidden">
          <div className="grid grid-cols-4 text-[10px] text-slate-500 uppercase pb-1 border-b border-slate-800/60 font-semibold">
            <span>Price (USDT)</span>
            <span className="text-right">Qty (BTC)</span>
            <span className="text-right">Total ($)</span>
            <span className="text-right">Time</span>
          </div>

          <div className="space-y-1 overflow-y-auto max-h-[300px]">
            {trades.slice(0, 15).map((t) => {
              const isBuyerMaker = t.isBuyerMaker; // true = seller market sell, false = buyer market buy
              const isBuy = !isBuyerMaker;

              return (
                <div
                  key={t.id}
                  className="grid grid-cols-4 py-0.5 text-[11px] hover:bg-slate-800/30 rounded px-1 transition-colors"
                >
                  <span className={`font-bold ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${t.price.toFixed(2)}
                  </span>
                  <span className="text-right text-slate-200">{t.qty.toFixed(4)}</span>
                  <span className="text-right text-slate-400">${(t.price * t.qty).toFixed(0)}</span>
                  <span className="text-right text-slate-500 text-[10px]">
                    {new Date(t.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
