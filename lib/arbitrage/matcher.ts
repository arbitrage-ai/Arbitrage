import stringSimilarity from 'string-similarity';
import type { KalshiMarket } from '../kalshi/types.js';
import type { PolymarketMarket } from '../polymarket/types.js';
import { kalshiCentsToDecimal } from '../utils/normalize.js';

export interface MatchedMarket {
  kalshiTicker: string;
  kalshiQuestion: string;
  kalshiYesPrice: number;
  kalshiNoPrice: number;
  polymarketSlug: string;
  polymarketQuestion: string;
  polymarketYesPrice: number;
  polymarketNoPrice: number;
  matchConfidence: number;
}

/** Normalize text for matching: lowercase, strip punctuation, collapse whitespace */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract meaningful keywords (skip common stop words) */
const STOP_WORDS = new Set([
  'will', 'the', 'a', 'an', 'in', 'on', 'at', 'of', 'to', 'be', 'or',
  'and', 'is', 'are', 'was', 'were', 'for', 'by', 'with', 'from', 'win',
  'vs', 'at', 'game', 'match', 'play', 'over', 'under',
]);

function keywords(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(' ')
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

function keywordOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const w of a) {
    if (b.has(w)) overlap++;
  }
  return overlap / Math.max(a.size, b.size);
}

/**
 * Fuzzy-match Kalshi markets to Polymarket markets.
 * Uses a combination of string similarity and keyword overlap.
 * Only returns matches with confidence >= threshold.
 */
export function matchMarketsAcrossPlatforms(
  kalshiMarkets: KalshiMarket[],
  polyMarkets: PolymarketMarket[],
  threshold = 0.55
): MatchedMarket[] {
  const results: MatchedMarket[] = [];

  const polyQuestions = polyMarkets.map((m) => normalize(m.question));

  for (const km of kalshiMarkets) {
    const kmText = normalize(`${km.title} ${km.subtitle}`);
    const kmWords = keywords(`${km.title} ${km.subtitle}`);

    let bestScore = 0;
    let bestPolyIdx = -1;

    for (let i = 0; i < polyMarkets.length; i++) {
      const pmText = polyQuestions[i];
      const pmWords = keywords(polyMarkets[i].question);

      const similarity = stringSimilarity.compareTwoStrings(kmText, pmText);
      const overlap = keywordOverlap(kmWords, pmWords);
      // Weighted combination: similarity + keyword overlap
      const score = similarity * 0.5 + overlap * 0.5;

      if (score > bestScore) {
        bestScore = score;
        bestPolyIdx = i;
      }
    }

    if (bestScore >= threshold && bestPolyIdx >= 0) {
      const pm = polyMarkets[bestPolyIdx];
      const yesPrice = parseFloat(pm.outcome_prices?.[0] || '0');
      const noPrice = parseFloat(pm.outcome_prices?.[1] || '0');

      results.push({
        kalshiTicker: km.ticker,
        kalshiQuestion: `${km.title} ${km.subtitle}`.trim(),
        kalshiYesPrice: kalshiCentsToDecimal(km.yes_bid),
        kalshiNoPrice: kalshiCentsToDecimal(km.no_bid),
        polymarketSlug: pm.slug,
        polymarketQuestion: pm.question,
        polymarketYesPrice: yesPrice,
        polymarketNoPrice: noPrice,
        matchConfidence: bestScore,
      });
    }
  }

  return results;
}
