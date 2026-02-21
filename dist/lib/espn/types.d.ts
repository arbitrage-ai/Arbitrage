export interface ESPNScoreboard {
    leagues: ESPNLeague[];
    events: ESPNEvent[];
}
export interface ESPNLeague {
    id: string;
    name: string;
    abbreviation: string;
    slug: string;
}
export interface ESPNEvent {
    id: string;
    name: string;
    shortName: string;
    date: string;
    status: ESPNStatus;
    competitions: ESPNCompetition[];
}
export interface ESPNStatus {
    clock: number;
    displayClock: string;
    period: number;
    type: {
        id: string;
        name: string;
        state: 'pre' | 'in' | 'post';
        completed: boolean;
        description: string;
        detail: string;
        shortDetail: string;
    };
}
export interface ESPNCompetition {
    id: string;
    date: string;
    competitors: ESPNCompetitor[];
    odds?: ESPNOdds[];
    situation?: ESPNSituation;
}
export interface ESPNCompetitor {
    id: string;
    team: ESPNTeam;
    score: string;
    homeAway: 'home' | 'away';
    winner?: boolean;
    records?: {
        name: string;
        summary: string;
    }[];
}
export interface ESPNTeam {
    id: string;
    name: string;
    abbreviation: string;
    displayName: string;
    shortDisplayName: string;
    logo: string;
    color?: string;
}
export interface ESPNOdds {
    provider: {
        id: string;
        name: string;
    };
    details: string;
    overUnder: number;
    spread: number;
    homeTeamOdds: {
        moneyLine: number;
        spreadOdds: number;
    };
    awayTeamOdds: {
        moneyLine: number;
        spreadOdds: number;
    };
}
export interface ESPNSituation {
    lastPlay?: {
        text: string;
    };
    down?: number;
    distance?: number;
    possession?: string;
}
export interface ESPNAthlete {
    id: string;
    fullName: string;
    displayName: string;
    shortName: string;
    jersey: string;
    position: {
        abbreviation: string;
        name: string;
    };
    team: {
        displayName: string;
        abbreviation: string;
    };
    headshot?: {
        href: string;
    };
}
export interface ESPNPlayerStats {
    athlete: ESPNAthlete;
    statistics: {
        name: string;
        stats: {
            name: string;
            value: number;
            displayValue: string;
        }[];
    }[];
    gameLog?: {
        entries: {
            date: string;
            opponent: string;
            stats: Record<string, string>;
        }[];
    };
}
export interface ESPNOddsDetail {
    provider: {
        id: string;
        name: string;
    };
    moneyLine?: number;
    spread?: number;
    overUnder?: number;
    homeTeamOdds?: {
        moneyLine: number;
    };
    awayTeamOdds?: {
        moneyLine: number;
    };
}
export declare const SPORT_LEAGUE_MAP: Record<string, {
    sport: string;
    league: string;
}>;
