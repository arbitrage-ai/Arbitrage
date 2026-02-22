import type { ESPNScoreboard, ESPNOddsDetail } from './types.js';
export declare class ESPNClient {
    private resolveSportLeague;
    getScoreboard(leagueKey: string, date?: string): Promise<ESPNScoreboard>;
    getGameSummary(leagueKey: string, eventId: string): Promise<unknown>;
    getOdds(leagueKey: string, eventId: string): Promise<ESPNOddsDetail[]>;
    getPlayerOverview(leagueKey: string, playerId: string): Promise<unknown>;
    getPlayerGamelog(leagueKey: string, playerId: string, season?: number): Promise<unknown>;
    searchPlayers(query: string, limit?: number): Promise<{
        items: {
            id: string;
            displayName: string;
            sport?: string;
            league?: string;
        }[];
    }>;
    getTeams(leagueKey: string): Promise<unknown>;
    getStandings(leagueKey: string): Promise<unknown>;
    getNews(leagueKey: string, limit?: number): Promise<unknown>;
    getLiveScoreboard(leagueKey: string): Promise<unknown>;
}
