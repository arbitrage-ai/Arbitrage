/**
 * Price normalization utilities for cross-platform compatibility.
 * Kalshi uses cents (integer 1-99), Polymarket uses decimals (0.01-0.99).
 */
export declare function kalshiCentsToDecimal(cents: number): number;
export declare function decimalToKalshiCents(decimal: number): number;
export declare function moneylineToImpliedProb(moneyline: number): number;
export declare function removeVig(homeProb: number, awayProb: number): {
    home: number;
    away: number;
};
export declare function formatDollars(amount: number): string;
export declare function formatPercent(decimal: number): string;
export declare function formatPnl(amount: number): string;
