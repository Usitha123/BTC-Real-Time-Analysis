export function getPriceDecimals(price: number, explicitPrecision?: number): number {
  if (typeof explicitPrecision === 'number' && explicitPrecision >= 0 && explicitPrecision <= 8) {
    return explicitPrecision;
  }
  const abs = Math.abs(price);
  if (abs === 0) return 2;
  if (abs >= 100) return 2;
  if (abs >= 10) return 3;
  if (abs >= 1) return 4;
  if (abs >= 0.05) return 5;
  if (abs >= 0.001) return 6;
  return 7;
}

export function roundToPricePrecision(
  value: number,
  referencePrice?: number,
  explicitPrecision?: number
): number {
  const decimals = getPriceDecimals(referencePrice ?? value, explicitPrecision);
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function formatCoinPrice(
  value: number,
  referencePrice?: number,
  explicitPrecision?: number
): string {
  if (!Number.isFinite(value)) return '0.00';
  const decimals = getPriceDecimals(referencePrice ?? value, explicitPrecision);
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCompactCoinPrice(
  value: number,
  referencePrice?: number,
  explicitPrecision?: number
): string {
  if (!Number.isFinite(value)) return '0';
  const ref = referencePrice ?? value;
  const abs = Math.abs(ref);
  if (abs >= 1000 && (explicitPrecision === undefined || explicitPrecision <= 2)) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  const decimals = getPriceDecimals(ref, explicitPrecision);
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function getBaseAssetFromSymbol(symbol: string): string {
  if (!symbol) return 'BTC';
  if (symbol.endsWith('USDT')) return symbol.slice(0, -4);
  if (symbol.endsWith('USDC')) return symbol.slice(0, -4);
  if (symbol.endsWith('BUSD')) return symbol.slice(0, -4);
  return symbol;
}
