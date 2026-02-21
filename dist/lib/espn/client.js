import { SPORT_LEAGUE_MAP } from './types.js';
const SITE_API = 'https://site.api.espn.com/apis/site/v2/sports';
const CORE_API = 'https://sports.core.api.espn.com/v2/sports';
const ATHLETE_API = 'https://site.web.api.espn.com/apis/common/v3/sports';
const CDN_API = 'https://cdn.espn.com/core';
export class ESPNClient {
    resolveSportLeague(leagueKey) {
        const mapping = SPORT_LEAGUE_MAP[leagueKey];
        if (!mapping) {
            throw new Error(`Unknown league: ${leagueKey}. Valid: ${Object.keys(SPORT_LEAGUE_MAP).join(', ')}`);
        }
        return mapping;
    }
    async getScoreboard(leagueKey, date) {
        const { sport, league } = this.resolveSportLeague(leagueKey);
        const params = new URLSearchParams();
        if (date)
            params.set('dates', date);
        const qs = params.toString();
        const url = `${SITE_API}/${sport}/${league}/scoreboard${qs ? `?${qs}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`ESPN API error ${response.status}: ${url}`);
        }
        return response.json();
    }
    async getGameSummary(leagueKey, eventId) {
        const { sport, league } = this.resolveSportLeague(leagueKey);
        const url = `${SITE_API}/${sport}/${league}/summary?event=${eventId}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`ESPN API error ${response.status}: ${url}`);
        }
        return response.json();
    }
    async getOdds(leagueKey, eventId) {
        const { sport, league } = this.resolveSportLeague(leagueKey);
        // Competition ID is typically the same as event ID
        const url = `${CORE_API}/${sport}/leagues/${league}/events/${eventId}/competitions/${eventId}/odds`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`ESPN Odds API error ${response.status}: ${url}`);
        }
        const data = (await response.json());
        return data.items || [];
    }
    async getPlayerOverview(leagueKey, playerId) {
        const { sport, league } = this.resolveSportLeague(leagueKey);
        const url = `${ATHLETE_API}/${sport}/${league}/athletes/${playerId}/overview`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`ESPN Athlete API error ${response.status}: ${url}`);
        }
        return response.json();
    }
    async getPlayerGamelog(leagueKey, playerId, season) {
        const { sport, league } = this.resolveSportLeague(leagueKey);
        const params = new URLSearchParams();
        if (season)
            params.set('season', String(season));
        const qs = params.toString();
        const url = `${ATHLETE_API}/${sport}/${league}/athletes/${playerId}/gamelog${qs ? `?${qs}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`ESPN Gamelog API error ${response.status}: ${url}`);
        }
        return response.json();
    }
    async searchPlayers(query, limit = 10) {
        const url = `https://site.web.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(query)}&limit=${limit}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`ESPN Search API error ${response.status}`);
        }
        return response.json();
    }
    async getTeams(leagueKey) {
        const { sport, league } = this.resolveSportLeague(leagueKey);
        const url = `${SITE_API}/${sport}/${league}/teams`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`ESPN Teams API error ${response.status}`);
        }
        return response.json();
    }
    async getStandings(leagueKey) {
        const { sport, league } = this.resolveSportLeague(leagueKey);
        const url = `${SITE_API}/${sport}/${league}/standings`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`ESPN Standings API error ${response.status}`);
        }
        return response.json();
    }
    async getNews(leagueKey, limit = 10) {
        const { sport, league } = this.resolveSportLeague(leagueKey);
        const url = `${SITE_API}/${sport}/${league}/news?limit=${limit}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`ESPN News API error ${response.status}`);
        }
        return response.json();
    }
    async getLiveScoreboard(leagueKey) {
        // CDN endpoint for faster/live data
        const { league } = this.resolveSportLeague(leagueKey);
        const url = `${CDN_API}/${league}/scoreboard?xhr=1`;
        const response = await fetch(url);
        if (!response.ok) {
            // Fall back to regular API
            return this.getScoreboard(leagueKey);
        }
        return response.json();
    }
}
