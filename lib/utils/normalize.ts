/**
 * Price normalization utilities for cross-platform compatibility.
 * Kalshi uses cents (integer 1-99), Polymarket uses decimals (0.01-0.99).
 */

export function kalshiCentsToDecimal(cents: number): number {
  return cents / 100;
}

export function decimalToKalshiCents(decimal: number): number {
  return Math.round(decimal * 100);
}

export function moneylineToImpliedProb(moneyline: number): number {
  if (moneyline > 0) {
    return 100 / (moneyline + 100);
  }
  return Math.abs(moneyline) / (Math.abs(moneyline) + 100);
}

export function removeVig(
  homeProb: number,
  awayProb: number
): { home: number; away: number } {
  const total = homeProb + awayProb;
  return { home: homeProb / total, away: awayProb / total };
}

export function formatDollars(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatPercent(decimal: number): string {
  return `${(decimal * 100).toFixed(1)}%`;
}

export function formatPnl(amount: number): string {
  if (amount >= 0) return `+$${amount.toFixed(2)}`;
  return `-$${Math.abs(amount).toFixed(2)}`;
}
