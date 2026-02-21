import React from 'react';
import { useWidget } from 'mcp-use/react';
import { z } from 'zod';

const gameSchema = z.object({
  event_id: z.string(),
  name: z.string(),
  date: z.string(),
  status: z.string(),
  status_detail: z.string(),
  clock: z.string().optional(),
  period: z.number().optional(),
  home_team: z.string(),
  home_score: z.string(),
  away_team: z.string(),
  away_score: z.string(),
  spread: z.string().optional(),
  over_under: z.number().optional(),
  home_moneyline: z.number().optional(),
  away_moneyline: z.number().optional(),
});

const propSchema = z.object({
  league: z.string().optional(),
  date: z.string().optional(),
  games: z.array(gameSchema).default([]),
});

type Game = z.infer<typeof gameSchema>;
type Props = z.infer<typeof propSchema>;

function moneylineToStr(ml: number): string {
  return ml > 0 ? `+${ml}` : `${ml}`;
}

function StatusBadge({ status, detail }: { status: string; detail: string }) {
  const configs: Record<string, { label: string; color: string; bg: string; dot?: boolean }> = {
    in: { label: detail, color: '#dc2626', bg: '#fef2f2', dot: true },
    post: { label: 'Final', color: '#374151', bg: '#f3f4f6' },
    pre: { label: detail, color: '#2563eb', bg: '#eff6ff' },
  };
  const conf = configs[status] || { label: detail, color: '#374151', bg: '#f3f4f6' };

  return (
    <span
      style={{
        background: conf.bg,
        color: conf.color,
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {conf.dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#dc2626',
            display: 'inline-block',
            animation: 'pulse 1.5s infinite',
          }}
        />
      )}
      {conf.label}
    </span>
  );
}

function GameCard({ game }: { game: Game }) {
  const isLive = game.status === 'in';
  const isFinal = game.status === 'post';

  return (
    <div
      style={{
        border: `1px solid ${isLive ? '#fca5a5' : '#e2e8f0'}`,
        borderRadius: 8,
        padding: '12px 16px',
        background: isLive ? '#fff7f7' : '#fff',
        minWidth: 200,
        flex: '1 1 200px',
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <StatusBadge status={game.status} detail={game.status_detail} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: isFinal && parseInt(game.away_score) > parseInt(game.home_score) ? 700 : 500, fontSize: 15, color: '#1e293b' }}>
            {game.away_team}
          </span>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', minWidth: 32, textAlign: 'right' }}>
            {game.away_score}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: isFinal && parseInt(game.home_score) > parseInt(game.away_score) ? 700 : 500, fontSize: 15, color: '#1e293b' }}>
            {game.home_team}
          </span>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', minWidth: 32, textAlign: 'right' }}>
            {game.home_score}
          </span>
        </div>
      </div>

      {(game.spread || game.over_under || game.home_moneyline) && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            gap: 10,
            fontSize: 11,
            color: '#64748b',
          }}
        >
          {game.spread && <span>Spread: {game.spread}</span>}
          {game.over_under && <span>O/U: {game.over_under}</span>}
          {game.home_moneyline && game.away_moneyline && (
            <span>
              ML: {moneylineToStr(game.away_moneyline!)} / {moneylineToStr(game.home_moneyline!)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function LiveScores() {
  const { props } = useWidget<Props>({ games: [] });
  const games = props.games || [];
  const liveGames = games.filter((g) => g.status === 'in');
  const otherGames = games.filter((g) => g.status !== 'in');

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 800 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
          {props.league?.toUpperCase() || 'Live Scores'}
        </h2>
        {props.date && (
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{props.date}</p>
        )}
      </div>

      {games.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>
          No games scheduled
        </div>
      ) : (
        <>
          {liveGames.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                LIVE NOW
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {liveGames.map((game) => (
                  <GameCard key={game.event_id} game={game} />
                ))}
              </div>
            </div>
          )}

          {otherGames.length > 0 && (
            <div>
              {liveGames.length > 0 && (
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
                  OTHER GAMES
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {otherGames.map((game) => (
                  <GameCard key={game.event_id} game={game} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
