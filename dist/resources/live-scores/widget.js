import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
function moneylineToStr(ml) {
    return ml > 0 ? `+${ml}` : `${ml}`;
}
function StatusBadge({ status, detail }) {
    const configs = {
        in: { label: detail, color: '#ef4444', bg: '#fef2f2', dot: true },
        post: { label: 'Final', color: '#666', bg: '#f5f5f5' },
        pre: { label: detail, color: '#3b82f6', bg: '#eff6ff' },
    };
    const conf = configs[status] || { label: detail, color: '#666', bg: '#f5f5f5' };
    return (_jsxs("span", { style: {
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
        }, children: [conf.dot && (_jsx("span", { style: {
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#ef4444',
                    display: 'inline-block',
                    animation: 'pulse 1.5s infinite',
                } })), conf.label] }));
}
function GameCard({ game }) {
    const isLive = game.status === 'in';
    const isFinal = game.status === 'post';
    return (_jsxs("div", { style: {
            border: `1px solid ${isLive ? '#fca5a5' : '#e5e5e5'}`,
            borderRadius: 12,
            padding: '14px 18px',
            background: '#fff',
            minWidth: 220,
            flex: '1 1 220px',
            boxShadow: isLive ? '0 4px 12px rgba(239, 68, 68, 0.15)' : 'none',
        }, children: [_jsx("div", { style: { marginBottom: 10 }, children: _jsx(StatusBadge, { status: game.status, detail: game.status_detail }) }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("span", { style: { fontWeight: isFinal && parseInt(game.away_score) > parseInt(game.home_score) ? 700 : 500, fontSize: 15, color: '#111' }, children: game.away_team }), _jsx("span", { style: { fontSize: 24, fontWeight: 700, color: '#111', minWidth: 36, textAlign: 'right' }, children: game.away_score })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("span", { style: { fontWeight: isFinal && parseInt(game.home_score) > parseInt(game.away_score) ? 700 : 500, fontSize: 15, color: '#111' }, children: game.home_team }), _jsx("span", { style: { fontSize: 24, fontWeight: 700, color: '#111', minWidth: 36, textAlign: 'right' }, children: game.home_score })] })] }), (game.spread || game.over_under || game.home_moneyline) && (_jsxs("div", { style: {
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: '1px solid #f0f0f0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                    fontSize: 12,
                    color: '#888',
                }, children: [game.spread && _jsxs("span", { children: ["Spread: ", game.spread] }), game.over_under && _jsxs("span", { children: ["O/U: ", game.over_under] }), game.home_moneyline && game.away_moneyline && (_jsxs("span", { children: ["ML: ", moneylineToStr(game.away_moneyline), " / ", moneylineToStr(game.home_moneyline)] }))] }))] }));
}
export default function LiveScores() {
    const { props } = useWidget({ games: [] });
    const games = props.games || [];
    const liveGames = games.filter((g) => g.status === 'in');
    const otherGames = games.filter((g) => g.status !== 'in');
    return (_jsxs("div", { style: { fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 900, background: '#fafafa', minHeight: '100vh' }, children: [_jsxs("div", { style: { marginBottom: 24 }, children: [_jsx("h2", { style: { margin: 0, fontSize: 24, fontWeight: 700, color: '#111', letterSpacing: '-0.02em' }, children: props.league?.toUpperCase() || 'Live Scores' }), props.date && (_jsx("p", { style: { margin: '6px 0 0', fontSize: 14, color: '#666' }, children: props.date }))] }), games.length === 0 ? (_jsx("div", { style: { textAlign: 'center', padding: 60, color: '#999', fontSize: 14, background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5' }, children: "No games scheduled" })) : (_jsxs(_Fragment, { children: [liveGames.length > 0 && (_jsxs("div", { style: { marginBottom: 24 }, children: [_jsxs("div", { style: { fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: [_jsx("span", { style: { width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' } }), "Live Now"] }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 12 }, children: liveGames.map((game) => (_jsx(GameCard, { game: game }, game.event_id))) })] })), otherGames.length > 0 && (_jsxs("div", { children: [liveGames.length > 0 && (_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: '#666', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: "Other Games" })), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 12 }, children: otherGames.map((game) => (_jsx(GameCard, { game: game }, game.event_id))) })] }))] }))] }));
}
