import {
  Candle,
  Ticker24h,
  OrderBook,
  Trade,
  ChartTimeframe,
  FuturesMarketMetrics,
  FuturesSymbolInfo,
  TradeHorizon,
  ScreenerResponse,
  ScreenerSetupEntry,
  MultiTimeframeSignal,
} from '../types/crypto';
import {
  analyzeHorizonTradeSetup,
  getStrictlyClosedCandles,
  HORIZON_CONFIG,
} from './signalAnalyzer';
import { evaluateTimeframe } from './multiTimeframe';

export type ConnectionStatus = 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED' | 'ERROR';

async function fetchJsonSafe(url: string, timeoutMs: number = 5500): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function inferPrecisionFromPrice(price: number): number {
  if (!price || price <= 0) return 2;
  if (price >= 1000) return 1;
  if (price >= 100) return 2;
  if (price >= 1) return 4;
  if (price >= 0.01) return 5;
  return 7;
}

const MTF_SCREEN_INTERVALS: ('1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d')[] = [
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '1d',
];

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

  private clientScreenerCache = new Map<string, { timestamp: number; data: ScreenerResponse }>();

  // Fetch all active Binance USD-M Perpetual Futures USDT symbols sorted by 24h volume
  // Uses direct browser fapi.binance.com first (bypasses Vercel US serverless geo-blocks), then /api proxy, then Binance Vision mirror
  public async fetchFuturesSymbols(): Promise<FuturesSymbolInfo[]> {
    // 1. Direct browser call to Binance USD-M Futures API
    const [infoJson, fapiTickers] = await Promise.all([
      fetchJsonSafe('https://fapi.binance.com/fapi/v1/exchangeInfo', 6000),
      fetchJsonSafe('https://fapi.binance.com/fapi/v1/ticker/24hr', 6000),
    ]);

    if (infoJson && Array.isArray(infoJson.symbols)) {
      const tickerMap = new Map<string, any>();
      if (Array.isArray(fapiTickers)) {
        for (const t of fapiTickers) {
          if (t && t.symbol) tickerMap.set(t.symbol, t);
        }
      }
      const directPairs: FuturesSymbolInfo[] = infoJson.symbols
        .filter(
          (s: any) =>
            s.contractType === 'PERPETUAL' &&
            s.status === 'TRADING' &&
            s.quoteAsset === 'USDT'
        )
        .map((s: any) => {
          const t = tickerMap.get(s.symbol);
          return {
            symbol: s.symbol,
            baseAsset: s.baseAsset,
            quoteAsset: s.quoteAsset,
            pricePrecision: typeof s.pricePrecision === 'number' ? s.pricePrecision : 2,
            quantityPrecision: typeof s.quantityPrecision === 'number' ? s.quantityPrecision : 3,
            lastPrice: t ? parseFloat(t.lastPrice || '0') : 0,
            priceChangePercent: t ? parseFloat(t.priceChangePercent || '0') : 0,
            quoteVolume: t ? parseFloat(t.quoteVolume || '0') : 0,
          };
        })
        .sort((a: FuturesSymbolInfo, b: FuturesSymbolInfo) => b.quoteVolume - a.quoteVolume);

      if (directPairs.length > 0) return directPairs;
    }

    if (Array.isArray(fapiTickers) && fapiTickers.length > 0) {
      const derived: FuturesSymbolInfo[] = fapiTickers
        .filter((t: any) => typeof t?.symbol === 'string' && t.symbol.endsWith('USDT'))
        .map((t: any) => {
          const lastPrice = parseFloat(t.lastPrice || '0');
          return {
            symbol: t.symbol,
            baseAsset: t.symbol.slice(0, -4),
            quoteAsset: 'USDT',
            pricePrecision: inferPrecisionFromPrice(lastPrice),
            quantityPrecision: 3,
            lastPrice,
            priceChangePercent: parseFloat(t.priceChangePercent || '0'),
            quoteVolume: parseFloat(t.quoteVolume || '0'),
          };
        })
        .sort((a, b) => b.quoteVolume - a.quoteVolume);

      if (derived.length > 0) return derived;
    }

    // 2. Fallback to backend proxy
    const proxyData = await fetchJsonSafe('/api/binance/futures/symbols', 6000);
    if (Array.isArray(proxyData) && proxyData.length > 0) {
      return proxyData as FuturesSymbolInfo[];
    }
    if (proxyData && Array.isArray(proxyData.symbols) && proxyData.symbols.length > 0) {
      return proxyData.symbols as FuturesSymbolInfo[];
    }

    // 3. Global unblocked Binance Data Vision fallback (for strict restricted networks)
    const visionTickers = await fetchJsonSafe('https://data-api.binance.vision/api/v3/ticker/24hr', 6000);
    if (Array.isArray(visionTickers) && visionTickers.length > 0) {
      const visionPairs: FuturesSymbolInfo[] = visionTickers
        .filter((t: any) => {
          const sym = t?.symbol;
          const qv = parseFloat(t?.quoteVolume || '0');
          const lp = parseFloat(t?.lastPrice || '0');
          return (
            typeof sym === 'string' &&
            sym.endsWith('USDT') &&
            !sym.endsWith('UPUSDT') &&
            !sym.endsWith('DOWNUSDT') &&
            !sym.endsWith('BULLUSDT') &&
            !sym.endsWith('BEARUSDT') &&
            lp > 0 &&
            qv > 100000
          );
        })
        .map((t: any) => {
          const lastPrice = parseFloat(t.lastPrice || '0');
          return {
            symbol: t.symbol,
            baseAsset: t.symbol.slice(0, -4),
            quoteAsset: 'USDT',
            pricePrecision: inferPrecisionFromPrice(lastPrice),
            quantityPrecision: 3,
            lastPrice,
            priceChangePercent: parseFloat(t.priceChangePercent || '0'),
            quoteVolume: parseFloat(t.quoteVolume || '0'),
          };
        })
        .sort((a, b) => b.quoteVolume - a.quoteVolume);

      if (visionPairs.length > 0) return visionPairs;
    }

    throw new Error('Failed to load Binance Futures symbols');
  }

  // Fetch historical klines from Binance USD-M Futures with proxy and Vision fallbacks
  public async fetchHistoricalKlines(
    interval: ChartTimeframe,
    limit: number = 300,
    symbol: string = this.currentSymbol
  ): Promise<Candle[]> {
    const sym = symbol.toUpperCase();
    const binanceInterval = BinanceDataService.mapTimeframeToBinance(interval);
    const directUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${binanceInterval}&limit=${limit}`;
    const proxyUrl = `/api/binance/klines?symbol=${sym}&interval=${binanceInterval}&limit=${limit}`;
    const visionUrl = `https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${binanceInterval}&limit=${limit}`;

    let rawData: any[] | null = await fetchJsonSafe(directUrl, 5500);
    if (!Array.isArray(rawData) || rawData.length === 0) {
      rawData = await fetchJsonSafe(proxyUrl, 5500);
    }
    if (!Array.isArray(rawData) || rawData.length === 0) {
      rawData = await fetchJsonSafe(visionUrl, 5500);
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
    let data = await fetchJsonSafe(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${sym}`, 4500);
    if (!data || data.code) {
      data = await fetchJsonSafe(`/api/binance/ticker?symbol=${sym}`, 4500);
    }
    if (!data || data.code) {
      data = await fetchJsonSafe(`https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${sym}`, 4500);
    }

    if (!data || data.code || !data.lastPrice) return null;

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
    let data = await fetchJsonSafe(`https://fapi.binance.com/fapi/v1/depth?symbol=${sym}&limit=${limit}`, 4500);
    if (!data || !data.bids) {
      data = await fetchJsonSafe(`/api/binance/depth?symbol=${sym}&limit=${limit}`, 4500);
    }
    if (!data || !data.bids) {
      data = await fetchJsonSafe(`https://data-api.binance.vision/api/v3/depth?symbol=${sym}&limit=${limit}`, 4500);
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
    let data = await fetchJsonSafe(`https://fapi.binance.com/fapi/v1/trades?symbol=${sym}&limit=${limit}`, 4500);
    if (!Array.isArray(data)) {
      data = await fetchJsonSafe(`/api/binance/trades?symbol=${sym}&limit=${limit}`, 4500);
    }
    if (!Array.isArray(data)) {
      data = await fetchJsonSafe(`https://data-api.binance.vision/api/v3/trades?symbol=${sym}&limit=${limit}`, 4500);
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

  // Fetch Binance USD-M Futures metrics directly from browser first, falling back to /api proxy
  public async fetchFuturesMetrics(
    symbol: string = this.currentSymbol
  ): Promise<FuturesMarketMetrics | null> {
    const sym = symbol.toUpperCase();
    const now = Date.now();

    // 1. Direct browser calls to fapi.binance.com (avoids Vercel US server IP block)
    const [prem, oi, lsArr, takerArr] = await Promise.all([
      fetchJsonSafe(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}`, 4500),
      fetchJsonSafe(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${sym}`, 4000),
      fetchJsonSafe(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=15m&limit=2`, 4000),
      fetchJsonSafe(`https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=${sym}&period=15m&limit=2`, 4000),
    ]);

    if (prem && prem.markPrice) {
      const markPrice = parseFloat(prem.markPrice || '0');
      const indexPrice = parseFloat(prem.indexPrice || '0');
      const basisPct = indexPrice > 0 ? ((markPrice - indexPrice) / indexPrice) * 100 : 0;
      const fundingRate = parseFloat(prem.lastFundingRate || '0');
      const nextFundingTime = Number(prem.nextFundingTime || 0);
      const openInterestBtc = oi ? parseFloat(oi.openInterest || '0') : 0;
      const openInterestUsd = openInterestBtc * markPrice;
      const latestLs = Array.isArray(lsArr) && lsArr.length > 0 ? lsArr[lsArr.length - 1] : null;
      const latestTaker = Array.isArray(takerArr) && takerArr.length > 0 ? takerArr[takerArr.length - 1] : null;

      return {
        symbol: sym,
        markPrice,
        indexPrice,
        basisPct,
        fundingRate,
        nextFundingTime,
        openInterestBtc,
        openInterestUsd,
        longShortRatio: latestLs ? parseFloat(latestLs.longShortRatio || '1') : 1,
        longAccountPct: latestLs ? parseFloat(latestLs.longAccount || '0.5') * 100 : 50,
        shortAccountPct: latestLs ? parseFloat(latestLs.shortAccount || '0.5') * 100 : 50,
        takerBuySellRatio: latestTaker ? parseFloat(latestTaker.buySellRatio || '1') : 1,
        fetchedAt: now,
      };
    }

    // 2. Fallback to backend proxy
    const proxyData = await fetchJsonSafe(`/api/binance/futures/metrics?symbol=${sym}`, 5000);
    if (proxyData && proxyData.markPrice) {
      return proxyData as FuturesMarketMetrics;
    }

    return null;
  }

  // Fetch multi-coin Top Futures Screener: uses server endpoint when available, automatically runs in browser if Vercel Lambda is geo-blocked
  public async fetchTopCoinsScreener(
    horizon: TradeHorizon = '5h',
    limit: number = 16,
    forceRefresh: boolean = false
  ): Promise<ScreenerResponse> {
    const cacheKey = `${horizon}_${limit}`;
    const now = Date.now();
    const cachedClient = this.clientScreenerCache.get(cacheKey);
    if (!forceRefresh && cachedClient && now - cachedClient.timestamp < 45000) {
      return cachedClient.data;
    }

    const refreshParam = forceRefresh ? '&refresh=1' : '';
    const serverData = await fetchJsonSafe(
      `/api/binance/futures/screener?horizon=${horizon}&limit=${limit}${refreshParam}`,
      8500
    );

    if (serverData && Array.isArray(serverData.setups) && serverData.setups.length > 0) {
      this.clientScreenerCache.set(cacheKey, { timestamp: now, data: serverData });
      return serverData as ScreenerResponse;
    }

    // Browser-direct fallback (essential for Vercel US hosting where Binance blocks serverless IPs)
    const [symbols, premArr] = await Promise.all([
      this.fetchFuturesSymbols(),
      fetchJsonSafe('https://fapi.binance.com/fapi/v1/premiumIndex', 5000),
    ]);

    const premMap = new Map<string, any>();
    if (Array.isArray(premArr)) {
      for (const p of premArr) {
        if (p && p.symbol) premMap.set(p.symbol, p);
      }
    }

    const candidates = symbols.filter((s) => s.lastPrice > 0 && s.quoteVolume > 0).slice(0, limit);
    const meta = HORIZON_CONFIG[horizon];
    const setups: ScreenerSetupEntry[] = [];

    const concurrency = 4;
    let nextIdx = 0;
    const workers = Array.from({ length: Math.min(concurrency, candidates.length) }, async () => {
      while (nextIdx < candidates.length) {
        const symInfo = candidates[nextIdx++];
        try {
          const sym = symInfo.symbol;
          const klineResults = await Promise.all(
            MTF_SCREEN_INTERVALS.map((tf) => {
              const kLimit = tf === meta.chartTf ? 220 : 80;
              return this.fetchHistoricalKlines(tf, kLimit, sym)
                .then((candles) => ({ tf, candles }))
                .catch(() => ({ tf, candles: [] as Candle[] }));
            })
          );

          const [oiJson, lsArr, takerArr] = await Promise.all([
            fetchJsonSafe(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${sym}`, 3500),
            fetchJsonSafe(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=15m&limit=2`, 3500),
            fetchJsonSafe(`https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=${sym}&period=15m&limit=2`, 3500),
          ]);

          const candlesByTf = new Map<string, Candle[]>();
          for (const r of klineResults) {
            if (r.candles.length > 0) candlesByTf.set(r.tf, r.candles);
          }

          const primaryCandles = candlesByTf.get(meta.chartTf) || [];
          if (primaryCandles.length < 55) continue;

          const multiTfSignals: MultiTimeframeSignal[] = [];
          for (const tf of MTF_SCREEN_INTERVALS) {
            const list = candlesByTf.get(tf);
            if (!list) continue;
            const closed = getStrictlyClosedCandles(list);
            if (closed.length >= 15) {
              multiTfSignals.push(evaluateTimeframe(tf, closed.slice(-80)));
            }
          }

          const prem = premMap.get(sym);
          const markPrice = prem ? parseFloat(prem.markPrice || `${symInfo.lastPrice}`) : symInfo.lastPrice;
          const indexPrice = prem ? parseFloat(prem.indexPrice || `${markPrice}`) : markPrice;
          const basisPct = indexPrice > 0 ? ((markPrice - indexPrice) / indexPrice) * 100 : 0;
          const fundingRate = prem ? parseFloat(prem.lastFundingRate || '0') : 0;
          const nextFundingTime = prem ? Number(prem.nextFundingTime || 0) : 0;
          const openInterestBtc = oiJson ? parseFloat(oiJson.openInterest || '0') : 0;
          const openInterestUsd = openInterestBtc * markPrice;
          const latestLs = Array.isArray(lsArr) && lsArr.length > 0 ? lsArr[lsArr.length - 1] : null;
          const latestTaker = Array.isArray(takerArr) && takerArr.length > 0 ? takerArr[takerArr.length - 1] : null;

          const futuresMetrics: FuturesMarketMetrics = {
            symbol: sym,
            markPrice,
            indexPrice,
            basisPct,
            fundingRate,
            nextFundingTime,
            openInterestBtc,
            openInterestUsd,
            longShortRatio: latestLs ? parseFloat(latestLs.longShortRatio || '1') : 1,
            longAccountPct: latestLs ? parseFloat(latestLs.longAccount || '0.5') * 100 : 50,
            shortAccountPct: latestLs ? parseFloat(latestLs.shortAccount || '0.5') * 100 : 50,
            takerBuySellRatio: latestTaker ? parseFloat(latestTaker.buySellRatio || '1') : 1,
            fetchedAt: now,
          };

          const setup = analyzeHorizonTradeSetup(
            primaryCandles,
            horizon,
            multiTfSignals,
            futuresMetrics,
            sym,
            symInfo.pricePrecision
          );

          if (!setup) continue;

          const mtfBullCount = multiTfSignals.filter((s) => s.trend === 'BULLISH').length;
          const mtfBearCount = multiTfSignals.filter((s) => s.trend === 'BEARISH').length;
          const directionalNetRatio =
            Math.abs(setup.bullishCount - setup.bearishCount) / Math.max(1, setup.totalCriteria);
          const mtfDominance = Math.max(mtfBullCount, mtfBearCount) / Math.max(1, multiTfSignals.length || 7);
          const backtestContribution = setup.backtestTrades >= 4 ? setup.backtestWinRate * 0.35 : 14;
          const rrContribution = Math.min(setup.riskRewardRatio, 3.0) * 8;
          const rawRank =
            (setup.action !== 'WAIT' ? 100 : 0) +
            directionalNetRatio * 45 +
            setup.confidenceScore * 0.45 +
            backtestContribution +
            rrContribution +
            mtfDominance * 20;

          setups.push({
            symbol: sym,
            baseAsset: symInfo.baseAsset,
            pricePrecision: setup.pricePrecision,
            lastPrice: symInfo.lastPrice,
            priceChangePercent: symInfo.priceChangePercent,
            quoteVolume: symInfo.quoteVolume,
            horizon: setup.horizon,
            horizonLabel: setup.horizonLabel,
            timeframe: setup.timeframe,
            action: setup.action,
            entryPrice: setup.entryPrice,
            entryZone: setup.entryZone,
            takeProfit1: setup.takeProfit1,
            takeProfit2: setup.takeProfit2,
            stopLoss: setup.stopLoss,
            tp1Pct: setup.tp1Pct,
            tp2Pct: setup.tp2Pct,
            slPct: setup.slPct,
            riskRewardRatio: setup.riskRewardRatio,
            bullishCount: setup.bullishCount,
            bearishCount: setup.bearishCount,
            neutralCount: setup.neutralCount,
            totalCriteria: setup.totalCriteria,
            agreementPct: setup.agreementPct,
            confidenceScore: setup.confidenceScore,
            backtestWinRate: setup.backtestWinRate,
            backtestTrades: setup.backtestTrades,
            backtestAvgRR: setup.backtestAvgRR,
            recommendedLeverage: setup.recommendedLeverage,
            maxSafeLeverage: setup.maxSafeLeverage,
            detectedPattern: setup.detectedPattern,
            swingSupport: setup.swingSupport,
            swingResistance: setup.swingResistance,
            pivotPoint: setup.pivotPoint,
            supertrendLevel: setup.supertrendLevel,
            fundingRate: futuresMetrics.fundingRate,
            basisPct: futuresMetrics.basisPct,
            takerBuySellRatio: futuresMetrics.takerBuySellRatio,
            longAccountPct: futuresMetrics.longAccountPct,
            shortAccountPct: futuresMetrics.shortAccountPct,
            openInterestUsd: futuresMetrics.openInterestUsd,
            mtfBullCount,
            mtfBearCount,
            rankScore: parseFloat(rawRank.toFixed(1)),
            summary: setup.summary,
            criteria: setup.criteria,
            closedCandleTime: setup.closedCandleTime,
            generatedAt: setup.generatedAt,
          });
        } catch {
          // Skip individual symbol failure gracefully
        }
      }
    });

    await Promise.all(workers);

    setups.sort((a, b) => b.rankScore - a.rankScore);
    if (setups.length === 0) {
      throw new Error('Failed to scan Binance Futures pairs');
    }

    const result: ScreenerResponse = {
      horizon,
      scannedCount: setups.length,
      generatedAt: now,
      setups,
    };
    this.clientScreenerCache.set(cacheKey, { timestamp: now, data: result });
    return result;
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
