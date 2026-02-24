import { z } from 'zod';
import { text, error, object, markdown, widget } from 'mcp-use/server';
import type { McpServerInstance } from 'mcp-use/server';
import { ESPNClient } from '../lib/espn/client.js';
import { SPORT_LEAGUE_MAP } from '../lib/espn/types.js';
import {
  moneylineToImpliedProb,
  removeVig,
  formatPercent,
} from '../lib/utils/normalize.js';

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

export function registerESPNTools(server: McpServerInstance) {
  server.tool(
    {
      name: 'live_scores',
      description:
        'Get live scores, game status, and schedule from ESPN. No auth needed. Renders a live scoreboard widget with game cards showing scores, status, and odds. ' +
        'WHEN: User asks about scores, games today, who is playing, or mentions any sports league. ' +
        'THEN: Proactively call suggest_markets or search_markets for related prediction markets. ' +
        'For live games, also call espn_odds(event_id) to compare sportsbook lines with market prices.',
      widget: {
        name: 'live-scores',
        invoking: 'Fetching scores...',
        invoked: 'Scores loaded',
      },
      schema: z.object({
        league: leagueEnum.describe(
          'The league to get scores for (nfl, nba, mlb, nhl, ncaaf, ncaab, etc.)'
        ),
        date: z
          .string()
          .optional()
          .describe(
            'Date filter in YYYYMMDD format (e.g., "20260221"). Defaults to today.'
          ),
      }),
    },
    async ({ league, date }) => {
      try {
        const scoreboard = await espn.getScoreboard(league, date);
        const games = scoreboard.events.map((event) => {
          const comp = event.competitions[0];
          const home = comp?.competitors?.find((c) => c.homeAway === 'home');
          const away = comp?.competitors?.find((c) => c.homeAway === 'away');
          const odds = comp?.odds?.[0];

          // Moneyline is nested under odds.moneyline.{home,away}.close.odds as a string
          const homeML = odds?.moneyline?.home?.close?.odds
            ? parseInt(odds.moneyline.home.close.odds, 10)
            : undefined;
          const awayML = odds?.moneyline?.away?.close?.odds
            ? parseInt(odds.moneyline.away.close.odds, 10)
            : undefined;

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
                  home_moneyline: homeML,
                  away_moneyline: awayML,
                }
              : {}),
          };
        });

        const leagueName = league.toUpperCase();
        const dateStr = date || new Date().toISOString().slice(0, 10);

        let md = `## ${leagueName} Scores - ${dateStr}\n\n`;
        for (const game of games) {
          const statusIcon =
            game.status === 'in'
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

        const liveGames = games.filter((g) => g.status === 'in');
        const upcomingGames = games.filter((g) => g.status === 'pre');
        const nextSteps: { tool: string; params?: Record<string, unknown>; reason: string }[] = [];

        if (liveGames.length > 0 || upcomingGames.length > 0) {
          nextSteps.push({ tool: 'suggest_markets', params: { topic: league }, reason: 'Show tradeable prediction markets for these games' });
          nextSteps.push({ tool: 'scan_arbitrage', params: { category: league }, reason: 'Live/upcoming games often have cross-platform price discrepancies' });
        }
        if (liveGames.length > 0) {
          const g = liveGames[0];
          nextSteps.push({ tool: 'espn_odds', params: { league, event_id: g.event_id }, reason: 'Compare live sportsbook odds with prediction market prices' });
        }

        return widget({
          props: { league, date: dateStr, games, markdown: md },
          output: object({ league, date: dateStr, games, next_steps: nextSteps, markdown: md }),
        });
      } catch (e: unknown) {
        return error(
          `ESPN API error: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  );

  server.tool(
    {
      name: 'player_stats',
      description:
        'Get player statistics and game log from ESPN by name. ' +
        'WHEN: User asks about a player, their stats, recent performance, or injury status. ' +
        'THEN: If user expresses betting intent, search_markets for player prop markets.',
      schema: z.object({
        player_name: z
          .string()
          .describe('Player name to search for (e.g., "Patrick Mahomes")'),
        league: leagueEnum
          .default('nfl')
          .describe('The league the player is in'),
      }),
    },
    async ({ player_name, league }) => {
      try {
        const searchResults = await espn.searchPlayers(player_name);

        let playerId: string | null = null;
        if (searchResults.items && searchResults.items.length > 0) {
          const match = searchResults.items.find(
            (item) =>
              item.displayName
                ?.toLowerCase()
                .includes(player_name.toLowerCase()) ||
              player_name
                .toLowerCase()
                .includes(item.displayName?.toLowerCase() ?? '')
          );
          playerId = match?.id ?? searchResults.items[0].id ?? null;
        }

        if (!playerId) {
          return text(
            `Could not find player "${player_name}" on ESPN. Try a more specific name.`
          );
        }

        const overview = await espn.getPlayerOverview(league, playerId);
        return object({
          player_name,
          player_id: playerId,
          league,
          data: overview,
        });
      } catch (e: unknown) {
        return error(
          `ESPN player stats error: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  );

  server.tool(
    {
      name: 'game_summary',
      description:
        'Get detailed game summary: box score, play-by-play, leaders, situation. ' +
        'WHEN: User asks for details on a specific game (box score, who scored, game flow). ' +
        'REQUIRES: event_id from live_scores results.',
      schema: z.object({
        league: leagueEnum.describe('The league the game is in'),
        event_id: z
          .string()
          .describe(
            'ESPN event ID (get this from live_scores results)'
          ),
      }),
    },
    async ({ league, event_id }) => {
      try {
        const summary = await espn.getGameSummary(league, event_id);
        return object({ league, event_id, data: summary });
      } catch (e: unknown) {
        return error(
          `ESPN game summary error: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  );

  server.tool(
    {
      name: 'espn_odds',
      description:
        'Get sportsbook odds (moneyline, spread, O/U) with implied probabilities. ' +
        'WHEN: Comparing prediction market prices to sportsbook lines for edge detection, or user asks about odds/lines. ' +
        'REQUIRES: event_id from live_scores. ' +
        'THEN: Compare implied_probabilities output with prediction market prices from search_markets to find mispriced markets. Use analyze_edge for a structured comparison.',
      schema: z.object({
        league: leagueEnum.describe('The league the game is in'),
        event_id: z
          .string()
          .describe(
            'ESPN event ID (get this from live_scores results)'
          ),
      }),
    },
    async ({ league, event_id }) => {
      try {
        const odds = await espn.getOdds(league, event_id);

        const processed = odds.map((o: any) => {
          const homeML = o.homeTeamOdds?.moneyLine;
          const awayML = o.awayTeamOdds?.moneyLine;

          let impliedProbs: {
            home_raw?: string;
            away_raw?: string;
            home_no_vig?: string;
            away_no_vig?: string;
          } = {};

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
          next_steps: [
            { tool: 'search_markets', params: { query: `${league} game` }, reason: 'Find prediction market prices to compare with these sportsbook odds' },
            { tool: 'analyze_edge', reason: 'Structured edge analysis comparing market price vs these implied probabilities' },
          ],
        });
      } catch (e: unknown) {
        return error(
          `ESPN odds error: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  );
}
