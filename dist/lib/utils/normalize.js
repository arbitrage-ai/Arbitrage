/**
 * Price normalization utilities for cross-platform compatibility.
 * Kalshi uses cents (integer 1-99), Polymarket uses decimals (0.01-0.99).
 */
export function kalshiCentsToDecimal(cents) {
    return cents / 100;
}
export function decimalToKalshiCents(decimal) {
    return Math.round(decimal * 100);
}
export function moneylineToImpliedProb(moneyline) {
    if (moneyline > 0) {
        return 100 / (moneyline + 100);
    }
    return Math.abs(moneyline) / (Math.abs(moneyline) + 100);
}
export function removeVig(homeProb, awayProb) {
    const total = homeProb + awayProb;
    return { home: homeProb / total, away: awayProb / total };
}
export function formatDollars(amount) {
    return `$${amount.toFixed(2)}`;
}
export function formatPercent(decimal) {
    return `${(decimal * 100).toFixed(1)}%`;
}
export function formatPnl(amount) {
    const sign = amount >= 0 ? '+' : '';
    return `${sign}$${amount.toFixed(2)}`;
}
