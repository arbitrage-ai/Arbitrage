import { z } from 'zod';
import { text, error, object, markdown } from 'mcp-use/server';
import { ESPNClient } from '../lib/espn/client.js';
import { moneylineToImpliedProb, removeVig, formatPercent, } from '../lib/utils/normalize.js';
const espn = new ESPNClient();
const leagueEnum = z.enum([
    'nfl',
    'nba',
    'mlb',
    'nhl',
    'ncaaf',
    'ncaab',
    'wnba',
    'mls',
    'epl',
    'laliga',
    'ufc',
    'f1',
    'pga',
]);
export function registerESPNTools(server) {
    server.tool({
        name: 'live_scores',
        description: 'Get live scores and game status from ESPN for any sport/league. No authentication needed.',
        schema: z.object({
            league: leagueEnum.describe('The league to get scores for (nfl, nba, mlb, nhl, ncaaf, ncaab, etc.)'),
            date: z
                .string()
                .optional()
                .describe('Date filter in YYYYMMDD format (e.g., "20260221"). Defaults to today.'),
        }),
    }, async ({ league, date }) => {
        try {
            const scoreboard = await espn.getScoreboard(league, date);
            const games = scoreboard.events.map((event) => {
                const comp = event.competitions[0];
                const home = comp?.competitors?.find((c) => c.homeAway === 'home');
                const away = comp?.competitors?.find((c) => c.homeAway === 'away');
                const odds = comp?.odds?.[0];
                return {
                    event_id: event.id,
                    name: event.shortName,
                    date: event.date,
                    status: event.status.type.state,
                    status_detail: event.status.type.shortDetail,
                    clock: event.status.displayClock,
                    period: event.status.period,
                    home_team: home?.team?.abbreviation || 'N/A',
                    home_score: home?.score || '0',
                    away_team: away?.team?.abbreviation || 'N/A',
                    away_score: away?.score || '0',
                    ...(odds
                        ? {
                            spread: odds.details,
                            over_under: odds.overUnder,
                            home_moneyline: odds.homeTeamOdds?.moneyLine,
                            away_moneyline: odds.awayTeamOdds?.moneyLine,
                        }
                        : {}),
                };
            });
            const leagueName = league.toUpperCase();
            const dateStr = date || new Date().toISOString().slice(0, 10);
            let md = `## ${leagueName} Scores - ${dateStr}\n\n`;
            for (const game of games) {
                const statusIcon = game.status === 'in'
                    ? '🔴 LIVE'
                    : game.status === 'post'
                        ? '✅ FINAL'
                        : '⏳ UPCOMING';
                md += `**${game.away_team} ${game.away_score} @ ${game.home_team} ${game.home_score}** — ${statusIcon} ${game.status_detail}\n`;
                if (game.spread) {
                    md += `  Spread: ${game.spread} | O/U: ${game.over_under}\n`;
                }
                md += '\n';
            }
            return markdown(md);
        }
        catch (e) {
            return error(`ESPN API error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool({
        name: 'player_stats',
        description: 'Get player statistics, game log, and overview from ESPN. Search by player name.',
        schema: z.object({
            player_name: z
                .string()
                .describe('Player name to search for (e.g., "Patrick Mahomes")'),
            league: leagueEnum
                .default('nfl')
                .describe('The league the player is in'),
        }),
    }, async ({ player_name, league }) => {
        try {
            // Search for the player first
            const searchResults = (await espn.searchPlayers(player_name));
            // Find athlete in results
            let playerId = null;
            if (searchResults.results) {
                for (const section of searchResults.results) {
                    if (section.athletes) {
                        const match = section.athletes.find((a) => a.displayName
                            .toLowerCase()
                            .includes(player_name.toLowerCase()) ||
                            player_name
                                .toLowerCase()
                                .includes(a.displayName.toLowerCase()));
                        if (match) {
                            playerId = match.id;
                            break;
                        }
                    }
                }
            }
            if (!playerId) {
                return text(`Could not find player "${player_name}" on ESPN. Try a more specific name.`);
            }
            const overview = await espn.getPlayerOverview(league, playerId);
            return object({
                player_name,
                player_id: playerId,
                league,
                data: overview,
            });
        }
        catch (e) {
            return error(`ESPN player stats error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool({
        name: 'game_summary',
        description: 'Get detailed game summary including box score, play-by-play, leaders, and situation from ESPN.',
        schema: z.object({
            league: leagueEnum.describe('The league the game is in'),
            event_id: z
                .string()
                .describe('ESPN event ID (get this from live_scores results)'),
        }),
    }, async ({ league, event_id }) => {
        try {
            const summary = await espn.getGameSummary(league, event_id);
            return object({ league, event_id, data: summary });
        }
        catch (e) {
            return error(`ESPN game summary error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool({
        name: 'espn_odds',
        description: 'Get betting odds from ESPN for a specific game. Returns moneyline, spread, and over/under from major sportsbooks, converted to implied probabilities for comparison with prediction market prices.',
        schema: z.object({
            league: leagueEnum.describe('The league the game is in'),
            event_id: z
                .string()
                .describe('ESPN event ID (get this from live_scores results)'),
        }),
    }, async ({ league, event_id }) => {
        try {
            const odds = await espn.getOdds(league, event_id);
            const processed = odds.map((o) => {
                const homeML = o.homeTeamOdds?.moneyLine;
                const awayML = o.awayTeamOdds?.moneyLine;
                let impliedProbs = {};
                if (homeML && awayML) {
                    const homeProb = moneylineToImpliedProb(homeML);
                    const awayProb = moneylineToImpliedProb(awayML);
                    const noVig = removeVig(homeProb, awayProb);
                    impliedProbs = {
                        home_raw: formatPercent(homeProb),
                        away_raw: formatPercent(awayProb),
                        home_no_vig: formatPercent(noVig.home),
                        away_no_vig: formatPercent(noVig.away),
                    };
                }
                return {
                    provider: o.provider?.name || 'Unknown',
                    spread: o.details || o.spread,
                    over_under: o.overUnder,
                    home_moneyline: homeML,
                    away_moneyline: awayML,
                    implied_probabilities: impliedProbs,
                };
            });
            return object({
                league,
                event_id,
                odds: processed,
                note: 'Compare implied probabilities with prediction market prices to find edge.',
            });
        }
        catch (e) {
            return error(`ESPN odds error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
}
