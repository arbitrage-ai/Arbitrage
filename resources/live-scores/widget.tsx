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
    in: { label: detail, color: '#ef4444', bg: '#fef2f2', dot: true },
    post: { label: 'Final', color: '#666', bg: '#f5f5f5' },
    pre: { label: detail, color: '#3b82f6', bg: '#eff6ff' },
  };
  const conf = configs[status] || { label: detail, color: '#666', bg: '#f5f5f5' };

  return (
    <span
      style={{
        background: conf.bg,
        color: conf.color,
        borderRadius: 6,
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {conf.dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#ef4444',
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
        border: `1px solid ${isLive ? '#fca5a5' : '#e5e5e5'}`,
        borderRadius: 12,
        padding: '14px 18px',
        background: '#fff',
        minWidth: 220,
        flex: '1 1 220px',
        boxShadow: isLive ? '0 4px 12px rgba(239, 68, 68, 0.15)' : 'none',
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <StatusBadge status={game.status} detail={game.status_detail} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: isFinal && parseInt(game.away_score) > parseInt(game.home_score) ? 700 : 500, fontSize: 15, color: '#111' }}>
            {game.away_team}
          </span>
          <span style={{ fontSize: 24, fontWeight: 700, color: '#111', minWidth: 36, textAlign: 'right' }}>
            {game.away_score}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: isFinal && parseInt(game.home_score) > parseInt(game.away_score) ? 700 : 500, fontSize: 15, color: '#111' }}>
            {game.home_team}
          </span>
          <span style={{ fontSize: 24, fontWeight: 700, color: '#111', minWidth: 36, textAlign: 'right' }}>
            {game.home_score}
          </span>
        </div>
      </div>

      {(game.spread || game.over_under || game.home_moneyline) && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            fontSize: 12,
            color: '#888',
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
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 900, background: '#fafafa', minHeight: '100vh' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111', letterSpacing: '-0.02em' }}>
          {props.league?.toUpperCase() || 'Live Scores'}
        </h2>
        {props.date && (
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#666' }}>{props.date}</p>
        )}
      </div>

      {games.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#999', fontSize: 14, background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5' }}>
          No games scheduled
        </div>
      ) : (
        <>
          {liveGames.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                Live Now
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {liveGames.map((game) => (
                  <GameCard key={game.event_id} game={game} />
                ))}
              </div>
            </div>
          )}

          {otherGames.length > 0 && (
            <div>
              {liveGames.length > 0 && (
                <div style={{ fontSize: 12, fontWeight: 700, color: '#666', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Other Games
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
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
