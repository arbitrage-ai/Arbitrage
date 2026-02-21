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
        in: { label: detail, color: '#dc2626', bg: '#fef2f2', dot: true },
        post: { label: 'Final', color: '#374151', bg: '#f3f4f6' },
        pre: { label: detail, color: '#2563eb', bg: '#eff6ff' },
    };
    const conf = configs[status] || { label: detail, color: '#374151', bg: '#f3f4f6' };
    return (_jsxs("span", { style: {
            background: conf.bg,
            color: conf.color,
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
        }, children: [conf.dot && (_jsx("span", { style: {
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#dc2626',
                    display: 'inline-block',
                    animation: 'pulse 1.5s infinite',
                } })), conf.label] }));
}
function GameCard({ game }) {
    const isLive = game.status === 'in';
    const isFinal = game.status === 'post';
    return (_jsxs("div", { style: {
            border: `1px solid ${isLive ? '#fca5a5' : '#e2e8f0'}`,
            borderRadius: 8,
            padding: '12px 16px',
            background: isLive ? '#fff7f7' : '#fff',
            minWidth: 200,
            flex: '1 1 200px',
        }, children: [_jsx("div", { style: { marginBottom: 8 }, children: _jsx(StatusBadge, { status: game.status, detail: game.status_detail }) }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("span", { style: { fontWeight: isFinal && parseInt(game.away_score) > parseInt(game.home_score) ? 700 : 500, fontSize: 15, color: '#1e293b' }, children: game.away_team }), _jsx("span", { style: { fontSize: 22, fontWeight: 700, color: '#0f172a', minWidth: 32, textAlign: 'right' }, children: game.away_score })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("span", { style: { fontWeight: isFinal && parseInt(game.home_score) > parseInt(game.away_score) ? 700 : 500, fontSize: 15, color: '#1e293b' }, children: game.home_team }), _jsx("span", { style: { fontSize: 22, fontWeight: 700, color: '#0f172a', minWidth: 32, textAlign: 'right' }, children: game.home_score })] })] }), (game.spread || game.over_under || game.home_moneyline) && (_jsxs("div", { style: {
                    marginTop: 10,
                    paddingTop: 8,
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    gap: 10,
                    fontSize: 11,
                    color: '#64748b',
                }, children: [game.spread && _jsxs("span", { children: ["Spread: ", game.spread] }), game.over_under && _jsxs("span", { children: ["O/U: ", game.over_under] }), game.home_moneyline && game.away_moneyline && (_jsxs("span", { children: ["ML: ", moneylineToStr(game.away_moneyline), " / ", moneylineToStr(game.home_moneyline)] }))] }))] }));
}
export default function LiveScores() {
    const { props } = useWidget({ games: [] });
    const games = props.games || [];
    const liveGames = games.filter((g) => g.status === 'in');
    const otherGames = games.filter((g) => g.status !== 'in');
    return (_jsxs("div", { style: { fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 800 }, children: [_jsxs("div", { style: { marginBottom: 16 }, children: [_jsx("h2", { style: { margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }, children: props.league?.toUpperCase() || 'Live Scores' }), props.date && (_jsx("p", { style: { margin: '2px 0 0', fontSize: 12, color: '#64748b' }, children: props.date }))] }), games.length === 0 ? (_jsx("div", { style: { textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }, children: "No games scheduled" })) : (_jsxs(_Fragment, { children: [liveGames.length > 0 && (_jsxs("div", { style: { marginBottom: 16 }, children: [_jsxs("div", { style: { fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx("span", { style: { width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block' } }), "LIVE NOW"] }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 10 }, children: liveGames.map((game) => (_jsx(GameCard, { game: game }, game.event_id))) })] })), otherGames.length > 0 && (_jsxs("div", { children: [liveGames.length > 0 && (_jsx("div", { style: { fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }, children: "OTHER GAMES" })), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 10 }, children: otherGames.map((game) => (_jsx(GameCard, { game: game }, game.event_id))) })] }))] }))] }));
}
