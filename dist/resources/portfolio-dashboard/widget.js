import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useWidget } from 'mcp-use/react';
import { z } from 'zod';
const positionSchema = z.object({
    platform: z.string(),
    ticker: z.string().optional(),
    market: z.string().optional(),
    outcome: z.string().optional(),
    position: z.number().optional(),
    exposure: z.string().optional(),
    size: z.number().optional(),
    avg_price: z.number().optional(),
    current_price: z.number().optional(),
    pnl: z.string().optional(),
    realized_pnl: z.string().optional(),
    resting_orders: z.number().optional(),
});
const propSchema = z.object({
    positions: z.array(positionSchema).default([]),
    kalshi: z
        .object({
        balance: z.string().optional(),
        open_positions: z.number().optional(),
        total_exposure: z.string().optional(),
        realized_pnl: z.string().optional(),
    })
        .optional(),
    polymarket: z
        .object({
        address: z.string().optional(),
        open_positions: z.number().optional(),
        total_pnl: z.string().optional(),
    })
        .optional(),
    total_positions: z.number().optional(),
});
function PnlBadge({ value }) {
    const isPositive = value.startsWith('+') || (parseFloat(value.replace(/[^0-9.-]/g, '')) > 0);
    const color = isPositive ? '#16a34a' : value.includes('-') ? '#dc2626' : '#6b7280';
    return (_jsx("span", { style: { color, fontWeight: 600 }, children: value }));
}
function PlatformBadge({ platform }) {
    const colors = {
        kalshi: { bg: '#eff6ff', text: '#1d4ed8' },
        polymarket: { bg: '#fdf4ff', text: '#7e22ce' },
    };
    const style = colors[platform] || { bg: '#f3f4f6', text: '#374151' };
    return (_jsx("span", { style: {
            background: style.bg,
            color: style.text,
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
        }, children: platform }));
}
export default function PortfolioDashboard() {
    const { props } = useWidget({
        positions: [],
    });
    const [activeTab, setActiveTab] = useState('all');
    const filteredPositions = (props.positions || []).filter((p) => activeTab === 'all' || p.platform === activeTab);
    const tabStyle = (tab) => ({
        padding: '6px 16px',
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        fontWeight: 500,
        fontSize: 13,
        background: activeTab === tab ? '#1e293b' : 'transparent',
        color: activeTab === tab ? '#fff' : '#64748b',
    });
    return (_jsxs("div", { style: { fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 720 }, children: [_jsx("h2", { style: { margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: '#0f172a' }, children: "Portfolio Overview" }), _jsxs("div", { style: { display: 'flex', gap: 12, marginBottom: 16 }, children: [props.kalshi && (_jsxs("div", { style: {
                            flex: 1,
                            background: '#eff6ff',
                            borderRadius: 8,
                            padding: '12px 16px',
                            border: '1px solid #bfdbfe',
                        }, children: [_jsx("div", { style: { fontSize: 12, color: '#3b82f6', fontWeight: 600, marginBottom: 4 }, children: "KALSHI" }), _jsx("div", { style: { fontSize: 22, fontWeight: 700, color: '#1e3a8a' }, children: props.kalshi.balance || '—' }), _jsxs("div", { style: { fontSize: 12, color: '#6b7280', marginTop: 4 }, children: [props.kalshi.open_positions || 0, " positions \u00B7 ", props.kalshi.realized_pnl && (_jsx(PnlBadge, { value: props.kalshi.realized_pnl })), " P&L"] })] })), props.polymarket && (_jsxs("div", { style: {
                            flex: 1,
                            background: '#fdf4ff',
                            borderRadius: 8,
                            padding: '12px 16px',
                            border: '1px solid #e9d5ff',
                        }, children: [_jsx("div", { style: { fontSize: 12, color: '#7e22ce', fontWeight: 600, marginBottom: 4 }, children: "POLYMARKET" }), _jsx("div", { style: {
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: '#4c1d95',
                                    wordBreak: 'break-all',
                                }, children: props.polymarket.address
                                    ? `${props.polymarket.address.slice(0, 6)}...${props.polymarket.address.slice(-4)}`
                                    : '—' }), _jsxs("div", { style: { fontSize: 12, color: '#6b7280', marginTop: 4 }, children: [props.polymarket.open_positions || 0, " positions", props.polymarket.total_pnl && (_jsxs(_Fragment, { children: [' · ', _jsx(PnlBadge, { value: props.polymarket.total_pnl })] }))] })] }))] }), _jsx("div", { style: { display: 'flex', gap: 4, marginBottom: 12, background: '#f1f5f9', borderRadius: 8, padding: 4 }, children: ['all', 'kalshi', 'polymarket'].map((tab) => (_jsx("button", { style: tabStyle(tab), onClick: () => setActiveTab(tab), children: tab.charAt(0).toUpperCase() + tab.slice(1) }, tab))) }), filteredPositions.length === 0 ? (_jsx("div", { style: { textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 14 }, children: "No positions found" })) : (_jsx("div", { style: { border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 }, children: [_jsx("thead", { children: _jsxs("tr", { style: { background: '#f8fafc' }, children: [_jsx("th", { style: { padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }, children: "Platform" }), _jsx("th", { style: { padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }, children: "Market" }), _jsx("th", { style: { padding: '8px 12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }, children: "Position" }), _jsx("th", { style: { padding: '8px 12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }, children: "P&L" })] }) }), _jsx("tbody", { children: filteredPositions.map((pos, i) => (_jsxs("tr", { style: { borderTop: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#f8fafc' }, children: [_jsx("td", { style: { padding: '8px 12px' }, children: _jsx(PlatformBadge, { platform: pos.platform }) }), _jsxs("td", { style: { padding: '8px 12px', color: '#1e293b', maxWidth: 240 }, children: [_jsx("div", { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: pos.ticker || pos.market || 'Unknown' }), pos.outcome && (_jsx("div", { style: { fontSize: 11, color: '#94a3b8' }, children: pos.outcome }))] }), _jsxs("td", { style: { padding: '8px 12px', textAlign: 'right', color: '#1e293b' }, children: [pos.position ?? pos.size ?? '—', pos.exposure && (_jsx("div", { style: { fontSize: 11, color: '#94a3b8' }, children: pos.exposure }))] }), _jsx("td", { style: { padding: '8px 12px', textAlign: 'right' }, children: pos.pnl ? _jsx(PnlBadge, { value: pos.pnl }) : pos.realized_pnl ? _jsx(PnlBadge, { value: pos.realized_pnl }) : '—' })] }, i))) })] }) })), _jsxs("div", { style: { fontSize: 11, color: '#94a3b8', marginTop: 8, textAlign: 'right' }, children: [props.total_positions || 0, " total positions"] })] }));
}
