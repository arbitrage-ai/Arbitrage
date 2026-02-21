export interface ESPNConfig {
  baseUrl?: string;
}

export interface ESPNScoreboard {
  leagues: ESPNLeague[];
  events: ESPNEvent[];
}

export interface ESPNLeague {
  id: string;
  name: string;
  abbreviation: string;
  season: { year: number; type: number };
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
    state: string;
    completed: boolean;
    description: string;
    detail: string;
    shortDetail: string;
  };
}

export interface ESPNCompetition {
  id: string;
  date: string;
  venue: { fullName: string; city: string; state?: string };
  competitors: ESPNCompetitor[];
  odds?: ESPNOdds[];
  situation?: ESPNSituation;
  headlines?: Array<{ description: string; shortLinkText: string }>;
}

export interface ESPNCompetitor {
  id: string;
  team: {
    id: string;
    name: string;
    abbreviation: string;
    displayName: string;
    logo?: string;
  };
  homeAway: "home" | "away";
  score: string;
  records?: Array<{ name: string; summary: string }>;
  statistics?: Array<{ name: string; displayValue: string }>;
  leaders?: Array<{
    name: string;
    displayName: string;
    leaders: Array<{
      displayValue: string;
      athlete: { displayName: string; position: { abbreviation: string } };
    }>;
  }>;
}

export interface ESPNOdds {
  provider: { id: string; name: string; priority: number };
  details: string;
  overUnder: number;
  spread: number;
  homeTeamOdds?: { moneyLine: number; spreadOdds: number };
  awayTeamOdds?: { moneyLine: number; spreadOdds: number };
}

export interface ESPNSituation {
  lastPlay?: {
    text: string;
    type: { text: string };
    team?: { id: string };
  };
  down?: number;
  distance?: number;
  yardLine?: number;
  possession?: string;
  isRedZone?: boolean;
  homeTimeouts?: number;
  awayTimeouts?: number;
}

export interface ESPNGameSummary {
  id: string;
  name: string;
  date: string;
  status: string;
  period: number;
  clock: string;
  homeTeam: {
    name: string;
    abbreviation: string;
    score: string;
    records?: string[];
  };
  awayTeam: {
    name: string;
    abbreviation: string;
    score: string;
    records?: string[];
  };
  venue: string;
  odds?: ESPNOdds[];
  situation?: ESPNSituation;
  headlines?: string[];
}

type Sport = "football" | "basketball" | "baseball" | "hockey" | "soccer" | "mma";
type League =
  | "nfl"
  | "nba"
  | "mlb"
  | "nhl"
  | "college-football"
  | "mens-college-basketball"
  | "wnba"
  | "mls"
  | "ufc";

const SPORT_LEAGUE_MAP: Record<League, Sport> = {
  nfl: "football",
  "college-football": "football",
  nba: "basketball",
  wnba: "basketball",
  "mens-college-basketball": "basketball",
  mlb: "baseball",
  nhl: "hockey",
  mls: "soccer",
  ufc: "mma",
};

export class ESPNClient {
  private baseUrl: string;

  constructor(config: ESPNConfig = {}) {
    this.baseUrl =
      config.baseUrl ??
      process.env.ESPN_API_URL ??
      "https://site.api.espn.com/apis/site/v2/sports";
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`ESPN API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  private getSportPath(league: League): string {
    const sport = SPORT_LEAGUE_MAP[league];
    return `/${sport}/${league}`;
  }

  async getScoreboard(
    league: League,
    dates?: string
  ): Promise<ESPNScoreboard> {
    const params = new URLSearchParams();
    if (dates) params.set("dates", dates);
    const query = params.toString();
    const path = `${this.getSportPath(league)}/scoreboard${query ? `?${query}` : ""}`;
    return this.request<ESPNScoreboard>(path);
  }

  async getLiveScores(league: League): Promise<ESPNGameSummary[]> {
    const scoreboard = await this.getScoreboard(league);
    return scoreboard.events.map((event) => this.parseEvent(event));
  }

  async getGameDetails(
    league: League,
    gameId: string
  ): Promise<ESPNGameSummary> {
    const data = await this.request<{ events?: ESPNEvent[]; header?: unknown }>(
      `${this.getSportPath(league)}/summary?event=${gameId}`
    );
    if (data.events?.length) {
      return this.parseEvent(data.events[0]);
    }
    const scoreboard = await this.getScoreboard(league);
    const event = scoreboard.events.find((e) => e.id === gameId);
    if (!event) {
      throw new Error(`Game not found: ${gameId}`);
    }
    return this.parseEvent(event);
  }

  async getGameOdds(league: League, gameId?: string): Promise<Array<{
    gameId: string;
    gameName: string;
    odds: ESPNOdds[];
  }>> {
    const scoreboard = await this.getScoreboard(league);
    let events = scoreboard.events;
    if (gameId) {
      events = events.filter((e) => e.id === gameId);
    }
    return events
      .filter((e) => e.competitions[0]?.odds?.length)
      .map((e) => ({
        gameId: e.id,
        gameName: e.shortName,
        odds: e.competitions[0].odds ?? [],
      }));
  }

  async getTeamSchedule(league: League, teamId: string): Promise<ESPNGameSummary[]> {
    const data = await this.request<{ events: ESPNEvent[] }>(
      `${this.getSportPath(league)}/teams/${teamId}/schedule`
    );
    return (data.events ?? []).map((e) => this.parseEvent(e));
  }

  private parseEvent(event: ESPNEvent): ESPNGameSummary {
    const comp = event.competitions[0];
    const home = comp?.competitors.find((c) => c.homeAway === "home");
    const away = comp?.competitors.find((c) => c.homeAway === "away");

    return {
      id: event.id,
      name: event.name,
      date: event.date,
      status: event.status.type.description,
      period: event.status.period,
      clock: event.status.displayClock,
      homeTeam: {
        name: home?.team.displayName ?? "Unknown",
        abbreviation: home?.team.abbreviation ?? "UNK",
        score: home?.score ?? "0",
        records: home?.records?.map((r) => r.summary),
      },
      awayTeam: {
        name: away?.team.displayName ?? "Unknown",
        abbreviation: away?.team.abbreviation ?? "UNK",
        score: away?.score ?? "0",
        records: away?.records?.map((r) => r.summary),
      },
      venue: comp?.venue?.fullName ?? "Unknown Venue",
      odds: comp?.odds,
      situation: comp?.situation,
      headlines: comp?.headlines?.map((h) => h.description),
    };
  }
}
