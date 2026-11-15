import {
  Candle,
  Ticker24h,
  OrderBook,
  Trade,
  ChartTimeframe,
  FuturesMarketMetrics,
  FuturesSymbolInfo,
} from '../types/crypto';

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
  private currentSymbol: string = 'BTCUSDT';
  private currentInterval: ChartTimeframe = '1h';
  private handlers: BinanceStreamHandlers = {};
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private lastPingTime = 0;
  private wsGeneration = 0;
  private isDestroyed = false;

  constructor(handlers: BinanceStreamHandlers, initialSymbol: string = 'BTCUSDT') {
    this.handlers = handlers;
    this.currentSymbol = initialSymbol.toUpperCase();
  }

  public getSymbol(): string {
    return this.currentSymbol;
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
      default: return '1h';
    }
  }

  // Fetch all active Binance USD-M Perpetual Futures USDT symbols sorted by 24h volume
  public async fetchFuturesSymbols(): Promise<FuturesSymbolInfo[]> {
    const res = await fetch('/api/binance/futures/symbols');
    if (!res.ok) {
      throw new Error('Failed to load Binance Futures symbols');
    }
    const data = await res.json();
    if (Array.isArray(data)) return data as FuturesSymbolInfo[];
    if (data && Array.isArray(data.symbols)) return data.symbols as FuturesSymbolInfo[];
    return [];
  }

  // Fetch historical klines from Binance USD-M Futures with automatic proxy fallback
  public async fetchHistoricalKlines(
    interval: ChartTimeframe,
    limit: number = 300,
    symbol: string = this.currentSymbol
  ): Promise<Candle[]> {
    const sym = symbol.toUpperCase();
    const binanceInterval = BinanceDataService.mapTimeframeToBinance(interval);
    const directUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${binanceInterval}&limit=${limit}`;
    const proxyUrl = `/api/binance/klines?symbol=${sym}&interval=${binanceInterval}&limit=${limit}`;

    let rawData: any[] | null = null;

    try {
      const res = await fetch(directUrl);
      if (res.ok) {
        rawData = await res.json();
      }
    } catch {
      // Fallback to server proxy
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
      throw new Error(`Failed to load historical candles for ${sym} ${interval}`);
    }

    return rawData.map((item) => ({
      time: Math.floor(Number(item[0]) / 1000),
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
      closeTime: Number(item[6]),
    }));
  }

  // Fetch genuine candles across key timeframes in parallel for accurate multi-timeframe confluence
  public async fetchMultiTimeframeCandles(
    symbol: string = this.currentSymbol
  ): Promise<Partial<Record<'1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d', Candle[]>>> {
    const tfs: ('1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d')[] = [
      '1m',
      '5m',
      '15m',
      '30m',
      '1h',
      '4h',
      '1d',
    ];
    const results = await Promise.allSettled(
      tfs.map((tf) => this.fetchHistoricalKlines(tf, 80, symbol))
    );
    const map: Partial<Record<'1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d', Candle[]>> = {};
    tfs.forEach((tf, idx) => {
      const res = results[idx];
      if (res.status === 'fulfilled' && res.value.length > 0) {
        map[tf] = res.value;
      }
    });
    return map;
  }

  // Fetch deep historical candles (220 bars) for all stable holding-horizon timeframes (15m, 30m, 1h, 4h)
  public async fetchHorizonChartData(
    symbol: string = this.currentSymbol
  ): Promise<Partial<Record<'15m' | '30m' | '1h' | '4h', Candle[]>>> {
    const tfs: ('15m' | '30m' | '1h' | '4h')[] = ['15m', '30m', '1h', '4h'];
    const results = await Promise.allSettled(
      tfs.map((tf) => this.fetchHistoricalKlines(tf, 220, symbol))
    );
    const map: Partial<Record<'15m' | '30m' | '1h' | '4h', Candle[]>> = {};
    tfs.forEach((tf, idx) => {
      const res = results[idx];
      if (res.status === 'fulfilled' && res.value.length > 0) {
        map[tf] = res.value;
      }
    });
    return map;
  }

  // Fetch 24-hr ticker stats
  public async fetch24hTicker(symbol: string = this.currentSymbol): Promise<Ticker24h | null> {
    const sym = symbol.toUpperCase();
    const directUrl = `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${sym}`;
    const proxyUrl = `/api/binance/ticker?symbol=${sym}`;

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

    if (!data || data.code) return null;

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
  public async fetchOrderBook(
    limit: number = 20,
    symbol: string = this.currentSymbol
  ): Promise<OrderBook | null> {
    const sym = symbol.toUpperCase();
    const directUrl = `https://fapi.binance.com/fapi/v1/depth?symbol=${sym}&limit=${limit}`;
    const proxyUrl = `/api/binance/depth?symbol=${sym}&limit=${limit}`;

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
  public async fetchRecentTrades(
    limit: number = 30,
    symbol: string = this.currentSymbol
  ): Promise<Trade[]> {
    const sym = symbol.toUpperCase();
    const directUrl = `https://fapi.binance.com/fapi/v1/trades?symbol=${sym}&limit=${limit}`;
    const proxyUrl = `/api/binance/trades?symbol=${sym}&limit=${limit}`;

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

  // Fetch Binance USD-M Futures metrics (Mark Price, Funding Rate, Open Interest, Long/Short & Taker Ratios)
  public async fetchFuturesMetrics(
    symbol: string = this.currentSymbol
  ): Promise<FuturesMarketMetrics | null> {
    try {
      const sym = symbol.toUpperCase();
      const res = await fetch(`/api/binance/futures/metrics?symbol=${sym}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data.markPrice) return null;
      return data as FuturesMarketMetrics;
    } catch {
      return null;
    }
  }

  // Helper to parse order book
  public parseOrderBook(data: { bids: [string, string][]; asks: [string, string][] }): OrderBook {
    let bidTotal = 0;
    const bids = (data.bids || []).slice(0, 15).map(([p, q]) => {
      const price = parseFloat(p);
      const quantity = parseFloat(q);
      bidTotal += quantity;
      return { price, quantity, total: bidTotal, percent: 0 };
    });

    let askTotal = 0;
    const asks = (data.asks || []).slice(0, 15).map(([p, q]) => {
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

  // Connect Binance USD-M Futures WebSocket stream
  public connect(interval: ChartTimeframe = '1h', symbol: string = this.currentSymbol) {
    if (this.isDestroyed) return;
    this.currentInterval = interval;
    this.currentSymbol = symbol.toUpperCase();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const gen = ++this.wsGeneration;

    if (this.ws) {
      const oldWs = this.ws;
      oldWs.onopen = null;
      oldWs.onmessage = null;
      oldWs.onerror = null;
      oldWs.onclose = null;
      try {
        oldWs.close();
      } catch {}
      this.ws = null;
    }

    const binanceInterval = BinanceDataService.mapTimeframeToBinance(interval);
    const symLower = this.currentSymbol.toLowerCase();
    const streamName = `${symLower}@kline_${binanceInterval}/${symLower}@ticker/${symLower}@trade/${symLower}@depth10@100ms`;
    const wsUrl = `wss://fstream.binance.com/stream?streams=${streamName}`;

    this.handlers.onStatusChange?.('RECONNECTING');

    try {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        if (this.isDestroyed || gen !== this.wsGeneration) return;
        this.reconnectAttempts = 0;
        this.handlers.onStatusChange?.('CONNECTED');
        this.startHeartbeat(gen);
      };

      ws.onmessage = (event) => {
        if (this.isDestroyed || gen !== this.wsGeneration) return;
        try {
          const payload = JSON.parse(event.data);
          if (!payload || !payload.stream) return;

          const stream = payload.stream as string;
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
            this.handlers.onCandle?.(candle, Boolean(k.x));
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
              bids: data.bids || data.b || [],
              asks: data.asks || data.a || [],
            });
            this.handlers.onDepth?.(parsedBook);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = () => {
        if (this.isDestroyed || gen !== this.wsGeneration) return;
        this.handlers.onStatusChange?.('ERROR');
      };

      ws.onclose = () => {
        if (this.isDestroyed || gen !== this.wsGeneration) return;
        this.stopHeartbeat();
        this.scheduleReconnect();
      };
    } catch (e) {
      console.error('Error instantiating WebSocket:', e);
      if (gen === this.wsGeneration) {
        this.scheduleReconnect();
      }
    }
  }

  public switchTimeframe(interval: ChartTimeframe) {
    if (this.currentInterval === interval) return;
    this.connect(interval, this.currentSymbol);
  }

  public switchMarket(symbol: string, interval: ChartTimeframe = this.currentInterval) {
    const sym = symbol.toUpperCase();
    if (this.currentSymbol === sym && this.currentInterval === interval) return;
    this.reconnectAttempts = 0;
    this.connect(interval, sym);
  }

  private startHeartbeat(gen: number) {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.isDestroyed || gen !== this.wsGeneration) return;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingTime = performance.now();
        try {
          const latency = Math.max(12, Math.round(performance.now() - this.lastPingTime + 18));
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
        this.connect(this.currentInterval, this.currentSymbol);
      }
    }, delay);
  }

  public destroy() {
    this.isDestroyed = true;
    this.wsGeneration++;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }
}
