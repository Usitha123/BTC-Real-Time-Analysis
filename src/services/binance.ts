import { Candle, Ticker24h, OrderBook, Trade, ChartTimeframe } from '../types/crypto';

export type ConnectionStatus = 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED' | 'ERROR';

export interface BinanceStreamHandlers {
  onCandle?: (candle: Candle, isClosed: boolean) => void;
  onTicker?: (ticker: Partial<Ticker24h>) => void;
  onTrade?: (trade: Trade) => void;
  onDepth?: (book: OrderBook) => void;
  onStatusChange?: (status: ConnectionStatus, latencyMs?: number) => void;
}

export class BinanceDataService {
  private ws: WebSocket | null = null;
  private currentInterval: ChartTimeframe = '1m';
  private handlers: BinanceStreamHandlers = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 15;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private lastPingTime = 0;
  private isDestroyed = false;

  constructor(handlers: BinanceStreamHandlers) {
    this.handlers = handlers;
  }

  // Map application timeframe string to Binance API interval string
  public static mapTimeframeToBinance(tf: ChartTimeframe): string {
    switch (tf) {
      case '1m': return '1m';
      case '3m': return '3m';
      case '5m': return '5m';
      case '15m': return '15m';
      case '30m': return '30m';
      case '1h': return '1h';
      case '4h': return '4h';
      case '1d': return '1d';
      case '1w': return '1w';
      default: return '1m';
    }
  }

  // Fetch historical klines with automatic proxy fallback
  public async fetchHistoricalKlines(interval: ChartTimeframe, limit: number = 300): Promise<Candle[]> {
    const binanceInterval = BinanceDataService.mapTimeframeToBinance(interval);
    const directUrl = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${binanceInterval}&limit=${limit}`;
    const proxyUrl = `/api/binance/klines?symbol=BTCUSDT&interval=${binanceInterval}&limit=${limit}`;

    let rawData: any[] | null = null;

    try {
      // Try direct Binance first
      const res = await fetch(directUrl);
      if (res.ok) {
        rawData = await res.json();
      }
    } catch (e) {
      // Ignore direct fetch failure (CORS/geo-block) and fallback to proxy
    }

    if (!rawData) {
      try {
        const res = await fetch(proxyUrl);
        if (res.ok) {
          rawData = await res.json();
        }
      } catch (err) {
        console.error('Failed to fetch historical klines via proxy:', err);
      }
    }

    if (!rawData || !Array.isArray(rawData)) {
      throw new Error(`Failed to load historical candles for ${interval}`);
    }

    // Binance format: [openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, numberOfTrades, takerBuyBaseAssetVolume, takerBuyQuoteAssetVolume, ignore]
    return rawData.map((item) => ({
      time: Math.floor(Number(item[0]) / 1000), // Seconds for TradingView Lightweight Charts
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
      closeTime: Number(item[6]),
    }));
  }

  // Fetch 24-hr ticker stats
  public async fetch24hTicker(): Promise<Ticker24h | null> {
    const directUrl = 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT';
    const proxyUrl = '/api/binance/ticker?symbol=BTCUSDT';

    let data: any = null;
    try {
      const res = await fetch(directUrl);
      if (res.ok) data = await res.json();
    } catch {}

    if (!data) {
      try {
        const res = await fetch(proxyUrl);
        if (res.ok) data = await res.json();
      } catch (e) {
        console.error('Failed to fetch 24h ticker:', e);
      }
    }

    if (!data) return null;

    return {
      symbol: data.symbol,
      priceChange: parseFloat(data.priceChange),
      priceChangePercent: parseFloat(data.priceChangePercent),
      lastPrice: parseFloat(data.lastPrice),
      highPrice: parseFloat(data.highPrice),
      lowPrice: parseFloat(data.lowPrice),
      volume: parseFloat(data.volume),
      quoteVolume: parseFloat(data.quoteVolume),
      openPrice: parseFloat(data.openPrice),
      weightedAvgPrice: parseFloat(data.weightedAvgPrice || data.lastPrice),
      bidPrice: parseFloat(data.bidPrice || data.lastPrice),
      askPrice: parseFloat(data.askPrice || data.lastPrice),
    };
  }

  // Fetch Order Book Depth
  public async fetchOrderBook(limit: number = 20): Promise<OrderBook | null> {
    const directUrl = `https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=${limit}`;
    const proxyUrl = `/api/binance/depth?symbol=BTCUSDT&limit=${limit}`;

    let data: any = null;
    try {
      const res = await fetch(directUrl);
      if (res.ok) data = await res.json();
    } catch {}

    if (!data) {
      try {
        const res = await fetch(proxyUrl);
        if (res.ok) data = await res.json();
      } catch {}
    }

    if (!data || !data.bids || !data.asks) return null;

    return this.parseOrderBook(data);
  }

  // Fetch Recent Trades
  public async fetchRecentTrades(limit: number = 30): Promise<Trade[]> {
    const directUrl = `https://api.binance.com/api/v3/trades?symbol=BTCUSDT&limit=${limit}`;
    const proxyUrl = `/api/binance/trades?symbol=BTCUSDT&limit=${limit}`;

    let data: any = null;
    try {
      const res = await fetch(directUrl);
      if (res.ok) data = await res.json();
    } catch {}

    if (!data) {
      try {
        const res = await fetch(proxyUrl);
        if (res.ok) data = await res.json();
      } catch {}
    }

    if (!data || !Array.isArray(data)) return [];

    return data.map((t: any) => ({
      id: t.id,
      price: parseFloat(t.price),
      qty: parseFloat(t.qty),
      time: t.time,
      isBuyerMaker: t.isBuyerMaker,
    }));
  }

  // Helper to parse order book
  public parseOrderBook(data: { bids: [string, string][]; asks: [string, string][] }): OrderBook {
    let bidTotal = 0;
    const bids = data.bids.slice(0, 15).map(([p, q]) => {
      const price = parseFloat(p);
      const quantity = parseFloat(q);
      bidTotal += quantity;
      return { price, quantity, total: bidTotal, percent: 0 };
    });

    let askTotal = 0;
    const asks = data.asks.slice(0, 15).map(([p, q]) => {
      const price = parseFloat(p);
      const quantity = parseFloat(q);
      askTotal += quantity;
      return { price, quantity, total: askTotal, percent: 0 };
    });

    const maxTotal = Math.max(bidTotal, askTotal, 0.0001);
    bids.forEach((b) => (b.percent = (b.total / maxTotal) * 100));
    asks.forEach((a) => (a.percent = (a.total / maxTotal) * 100));

    const topBid = bids[0]?.price || 0;
    const topAsk = asks[0]?.price || 0;
    const spread = topAsk > topBid ? topAsk - topBid : 0;
    const spreadPercent = topBid > 0 ? (spread / topBid) * 100 : 0;

    return {
      bids,
      asks,
      spread,
      spreadPercent,
      bidDepthTotal: bidTotal,
      askDepthTotal: askTotal,
    };
  }

  // Connect WebSocket stream
  public connect(interval: ChartTimeframe = '1m') {
    if (this.isDestroyed) return;
    this.currentInterval = interval;

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    const binanceInterval = BinanceDataService.mapTimeframeToBinance(interval);
    const streamName = `btcusdt@kline_${binanceInterval}/btcusdt@ticker/btcusdt@trade/btcusdt@depth10@100ms`;
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streamName}`;

    this.handlers.onStatusChange?.('RECONNECTING');

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.handlers.onStatusChange?.('CONNECTED');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (!payload || !payload.stream) return;

          const stream = payload.stream;
          const data = payload.data;

          if (stream.includes('@kline')) {
            const k = data.k;
            const candle: Candle = {
              time: Math.floor(k.t / 1000),
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
              closeTime: k.T,
            };
            this.handlers.onCandle?.(candle, k.x);
          } else if (stream.includes('@ticker')) {
            this.handlers.onTicker?.({
              lastPrice: parseFloat(data.c),
              priceChange: parseFloat(data.p),
              priceChangePercent: parseFloat(data.P),
              highPrice: parseFloat(data.h),
              lowPrice: parseFloat(data.l),
              volume: parseFloat(data.v),
              quoteVolume: parseFloat(data.q),
              openPrice: parseFloat(data.o),
            });
          } else if (stream.includes('@trade')) {
            const trade: Trade = {
              id: data.t,
              price: parseFloat(data.p),
              qty: parseFloat(data.q),
              time: data.T,
              isBuyerMaker: data.m,
            };
            this.handlers.onTrade?.(trade);
          } else if (stream.includes('@depth')) {
            const parsedBook = this.parseOrderBook({
              bids: data.bids,
              asks: data.asks,
            });
            this.handlers.onDepth?.(parsedBook);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('Binance WebSocket error:', err);
        this.handlers.onStatusChange?.('ERROR');
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        if (!this.isDestroyed) {
          this.scheduleReconnect();
        }
      };
    } catch (e) {
      console.error('Error instantiating WebSocket:', e);
      this.scheduleReconnect();
    }
  }

  // Switch timeframe without re-creating entire class
  public switchTimeframe(interval: ChartTimeframe) {
    if (this.currentInterval === interval) return;
    this.connect(interval);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingTime = performance.now();
        // Binance WS accepts ping
        try {
          this.ws.send(JSON.stringify({ method: 'ping', id: 1 }));
          const latency = Math.round(performance.now() - this.lastPingTime);
          this.handlers.onStatusChange?.('CONNECTED', latency);
        } catch {}
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.isDestroyed) return;

    this.handlers.onStatusChange?.('RECONNECTING');
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isDestroyed) {
        this.connect(this.currentInterval);
      }
    }, delay);
  }

  public destroy() {
    this.isDestroyed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }
}
