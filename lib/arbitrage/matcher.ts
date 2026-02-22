import stringSimilarity from 'string-similarity';
import type { KalshiMarket } from '../kalshi/types.js';
import type { PolymarketMarket } from '../polymarket/types.js';
import { PolymarketClient } from '../polymarket/client.js';
import { kalshiCentsToDecimal } from '../utils/normalize.js';

export interface MatchedMarket {
  kalshiTicker: string;
  kalshiQuestion: string;
  kalshiYesPrice: number;
  kalshiNoPrice: number;
  kalshiYesBid: number;
  kalshiYesAsk: number;
  polymarketSlug: string;
  polymarketQuestion: string;
  polymarketYesPrice: number;
  polymarketNoPrice: number;
  polymarketTokenIds: string[];
  matchConfidence: number;
  matchMethod: 'fuzzy' | 'search';
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'will', 'the', 'a', 'an', 'in', 'on', 'at', 'of', 'to', 'be', 'or',
  'and', 'is', 'are', 'was', 'were', 'for', 'by', 'with', 'from',
  'vs', 'game', 'match', 'play', 'this', 'that', 'than', 'more',
  'does', 'do', 'has', 'have', 'been', 'before', 'after', 'during',
]);

function extractKeywords(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(' ')
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

/** Extract numbers from text — critical for threshold matching */
function extractNumbers(text: string): string[] {
  const matches = text.match(/[\d][,\d]*\.?\d*/g) || [];
  return matches.map((m) => m.replace(/,/g, ''));
}

/** Extract likely proper nouns (capitalized sequences) from original text */
function extractProperNouns(text: string): string[] {
  const matches = text.match(/[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/g) || [];
  return matches.map((m) => m.toLowerCase());
}

/** Extract uppercase abbreviations (team codes, acronyms) */
function extractAbbreviations(text: string): string[] {
  const matches = text.match(/\b[A-Z]{2,6}\b/g) || [];
  return matches.map((m) => m.toLowerCase());
}

/**
 * Compute match score between two market texts with entity-aware weighting.
 * Numbers and proper nouns are weighted much higher than generic keywords.
 */
function computeScore(kalshiText: string, polyText: string): number {
  const kNorm = normalize(kalshiText);
  const pNorm = normalize(polyText);

  // String similarity baseline
  const stringSim = stringSimilarity.compareTwoStrings(kNorm, pNorm);

  // Keyword overlap
  const kWords = extractKeywords(kalshiText);
  const pWords = extractKeywords(polyText);
  let kwOverlap = 0;
  if (kWords.size > 0 && pWords.size > 0) {
    let count = 0;
    for (const w of kWords) if (pWords.has(w)) count++;
    kwOverlap = count / Math.min(kWords.size, pWords.size);
  }

  // Number overlap — strongest matching signal
  const kNums = extractNumbers(kalshiText);
  const pNums = extractNumbers(polyText);
  let numMatch = 0;
  if (kNums.length > 0 && pNums.length > 0) {
    const pSet = new Set(pNums);
    let hits = 0;
    for (const n of kNums) if (pSet.has(n)) hits++;
    numMatch = hits / Math.max(kNums.length, pNums.length);
  }

  // Proper noun overlap — very strong signal
  const kNouns = extractProperNouns(kalshiText);
  const pNouns = extractProperNouns(polyText);
  let nounMatch = 0;
  if (kNouns.length > 0 && pNouns.length > 0) {
    const pSet = new Set(pNouns);
    let hits = 0;
    for (const n of kNouns) if (pSet.has(n)) hits++;
    nounMatch = hits / Math.max(kNouns.length, pNouns.length);
  }

  // Abbreviation overlap
  const kAbbr = extractAbbreviations(kalshiText);
  const pAbbr = extractAbbreviations(polyText);
  let abbrMatch = 0;
  if (kAbbr.length > 0 && pAbbr.length > 0) {
    const pSet = new Set(pAbbr);
    let hits = 0;
    for (const a of kAbbr) if (pSet.has(a)) hits++;
    abbrMatch = hits / Math.max(kAbbr.length, pAbbr.length);
  }

  // Strong entity matches → high confidence shortcut
  if (numMatch > 0.5 && (nounMatch > 0.3 || kwOverlap > 0.4)) return 0.85 + stringSim * 0.1;
  if (nounMatch > 0.6 && kwOverlap > 0.3) return 0.75 + stringSim * 0.15;

  // Weighted combination
  return (
    stringSim * 0.25 +
    kwOverlap * 0.30 +
    numMatch * 0.20 +
    nounMatch * 0.15 +
    abbrMatch * 0.10
  );
}

function parsePolyPrices(pm: PolymarketMarket) {
  const parsed = PolymarketClient.parseMarketFields(pm as unknown as Record<string, unknown>);
  return {
    yesPrice: parseFloat(parsed.outcomePrices[0] || '0'),
    noPrice: parseFloat(parsed.outcomePrices[1] || '0'),
    tokenIds: parsed.clobTokenIds,
  };
}

/**
 * Phase 1: Fuzzy matching of pre-fetched market lists.
 */
export function matchMarketsAcrossPlatforms(
  kalshiMarkets: KalshiMarket[],
  polyMarkets: PolymarketMarket[],
  threshold = 0.35
): MatchedMarket[] {
  const results: MatchedMarket[] = [];
  const usedPolyIds = new Set<string>();

  for (const km of kalshiMarkets) {
    const kmText = `${km.title} ${km.subtitle}`;
    let bestScore = 0;
    let bestIdx = -1;

    for (let i = 0; i < polyMarkets.length; i++) {
      if (usedPolyIds.has(polyMarkets[i].id)) continue;
      const score = computeScore(kmText, polyMarkets[i].question);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestScore >= threshold && bestIdx >= 0) {
      const pm = polyMarkets[bestIdx];
      const { yesPrice, noPrice, tokenIds } = parsePolyPrices(pm);
      if (yesPrice === 0 && noPrice === 0) continue;

      usedPolyIds.add(pm.id);
      results.push({
        kalshiTicker: km.ticker,
        kalshiQuestion: kmText.trim(),
        kalshiYesPrice: kalshiCentsToDecimal(km.yes_ask),
        kalshiNoPrice: kalshiCentsToDecimal(km.no_ask),
        kalshiYesBid: kalshiCentsToDecimal(km.yes_bid),
        kalshiYesAsk: kalshiCentsToDecimal(km.yes_ask),
        polymarketSlug: pm.slug,
        polymarketQuestion: pm.question,
        polymarketYesPrice: yesPrice,
        polymarketNoPrice: noPrice,
        polymarketTokenIds: tokenIds,
        matchConfidence: bestScore,
        matchMethod: 'fuzzy',
      });
    }
  }

  return results;
}

/**
 * Extract 3-5 word search query from a Kalshi market title for Polymarket lookup.
 */
export function extractSearchTerms(text: string): string {
  const nouns = extractProperNouns(text);
  const nums = extractNumbers(text);
  const abbr = extractAbbreviations(text);
  const kw = [...extractKeywords(text)].slice(0, 3);

  const terms = [...new Set([...nouns, ...nums, ...abbr, ...kw])];
  const query = terms.slice(0, 5).join(' ');
  return query.length >= 3 ? query : '';
}

/**
 * Match a single Kalshi market against Polymarket markets by score.
 */
function matchOneAgainstPoly(
  km: KalshiMarket,
  polyMarkets: PolymarketMarket[],
  threshold: number,
): MatchedMarket | null {
  const kmText = `${km.title} ${km.subtitle}`;
  let bestScore = 0;
  let bestPm: PolymarketMarket | null = null;

  for (const pm of polyMarkets) {
    if (!pm.question) continue;
    if (pm.closed === true || (pm as { active?: boolean }).active === false) continue;
    const polyText = `${(pm as { eventTitle?: string }).eventTitle || ''} ${pm.question}`.trim();
    const score = computeScore(kmText, polyText);
    if (score > bestScore) {
      bestScore = score;
      bestPm = pm;
    }
  }

  if (bestScore >= threshold && bestPm) {
    const { yesPrice, noPrice, tokenIds } = parsePolyPrices(bestPm);
    if (yesPrice === 0 && noPrice === 0) return null;
    return {
      kalshiTicker: km.ticker,
      kalshiQuestion: kmText.trim(),
      kalshiYesPrice: kalshiCentsToDecimal(km.yes_ask),
      kalshiNoPrice: kalshiCentsToDecimal(km.no_ask),
      kalshiYesBid: kalshiCentsToDecimal(km.yes_bid),
      kalshiYesAsk: kalshiCentsToDecimal(km.yes_ask),
      polymarketSlug: bestPm.slug,
      polymarketQuestion: bestPm.question,
      polymarketYesPrice: yesPrice,
      polymarketNoPrice: noPrice,
      polymarketTokenIds: tokenIds,
      matchConfidence: bestScore,
      matchMethod: 'search',
    };
  }
  return null;
}

/**
 * Phase 2: Search-based matching. Tries Polymarket searchText per market;
 * when it returns 422, falls back to scoring against pre-fetched polyMarkets.
 */
export async function searchBasedMatch(
  kalshiMarkets: KalshiMarket[],
  alreadyMatchedTickers: Set<string>,
  polyClient: PolymarketClient,
  threshold = 0.30,
  batchSize = 5,
  maxSearches = 25,
  polyMarketsFallback?: PolymarketMarket[],
  usedPolyIds?: Set<string>,
): Promise<MatchedMarket[]> {
  const results: MatchedMarket[] = [];
  const unmatched = kalshiMarkets.filter((km) => !alreadyMatchedTickers.has(km.ticker));
  const toSearch = unmatched.slice(0, maxSearches);
  const usedIds = new Set(usedPolyIds);

  for (let i = 0; i < toSearch.length; i += batchSize) {
    const batch = toSearch.slice(i, i + batchSize);
    const promises = batch.map(async (km): Promise<MatchedMarket | null> => {
      const terms = extractSearchTerms(`${km.title} ${km.subtitle}`);

      try {
        if (terms) {
          const searchResults = await polyClient.searchText(terms);
          if (Array.isArray(searchResults) && searchResults.length > 0) {
            const polyMarkets: PolymarketMarket[] = [];
            for (const item of searchResults) {
              const obj = item as Record<string, unknown>;
              if (Array.isArray(obj.markets)) {
                polyMarkets.push(...(obj.markets as PolymarketMarket[]));
              }
              if (typeof obj.question === 'string') {
                polyMarkets.push(obj as unknown as PolymarketMarket);
              }
            }
            if (polyMarkets.length > 0) {
              const m = matchOneAgainstPoly(km, polyMarkets, threshold);
              if (m) return m;
            }
          }
        }
      } catch { /* searchText often returns 422; use fallback */ }

      // Fallback: score against pre-fetched polyMarkets (exclude already-used)
      if (polyMarketsFallback && polyMarketsFallback.length > 0) {
        const usable = polyMarketsFallback.filter((pm) => !usedIds.has(pm.id));
        const m = matchOneAgainstPoly(km, usable, threshold);
        if (m) {
          const pm = usable.find((p) => p.slug === m.polymarketSlug || p.question === m.polymarketQuestion);
          if (pm) usedIds.add(pm.id);
          return m;
        }
      }
      return null;
    });

    const batchResults = await Promise.all(promises);
    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  return results;
}
