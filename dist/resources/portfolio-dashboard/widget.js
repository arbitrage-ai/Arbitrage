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
        kalshi: { bg: '#eff6ff', text: '#0284c7' },
        polymarket: { bg: '#faf5ff', text: '#9333ea' },
    };
    const style = colors[platform] || { bg: '#f5f5f5', text: '#666' };
    return (_jsx("span", { style: {
            background: style.bg,
            color: style.text,
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
        }, children: platform }));
}
export default function PortfolioDashboard() {
    const { props } = useWidget({
        positions: [],
    });
    const [activeTab, setActiveTab] = useState('all');
    const filteredPositions = (props.positions || []).filter((p) => activeTab === 'all' || p.platform === activeTab);
    const tabStyle = (tab) => ({
        padding: '8px 18px',
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: 13,
        background: activeTab === tab ? '#111' : 'transparent',
        color: activeTab === tab ? '#fff' : '#666',
        transition: 'all 0.2s ease',
    });
    return (_jsxs("div", { style: { fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 900, background: '#fafafa', minHeight: '100vh' }, children: [_jsx("h2", { style: { margin: '0 0 24px', fontSize: 24, fontWeight: 700, color: '#111', letterSpacing: '-0.02em' }, children: "Portfolio Overview" }), _jsxs("div", { style: { display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }, children: [props.kalshi && (_jsxs("div", { style: {
                            flex: 1,
                            minWidth: 250,
                            background: '#fff',
                            borderRadius: 12,
                            padding: '16px 20px',
                            border: '1px solid #e5e5e5',
                        }, children: [_jsx("div", { style: { fontSize: 11, color: '#0284c7', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: "Kalshi" }), _jsx("div", { style: { fontSize: 28, fontWeight: 700, color: '#111' }, children: props.kalshi.balance || '—' }), _jsxs("div", { style: { fontSize: 13, color: '#888', marginTop: 8 }, children: [props.kalshi.open_positions || 0, " positions \u00B7 ", props.kalshi.realized_pnl && (_jsx(PnlBadge, { value: props.kalshi.realized_pnl })), " P&L"] })] })), props.polymarket && (_jsxs("div", { style: {
                            flex: 1,
                            minWidth: 250,
                            background: '#fff',
                            borderRadius: 12,
                            padding: '16px 20px',
                            border: '1px solid #e5e5e5',
                        }, children: [_jsx("div", { style: { fontSize: 11, color: '#9333ea', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: "Polymarket" }), _jsx("div", { style: {
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: '#111',
                                    wordBreak: 'break-all',
                                    fontFamily: 'ui-monospace, monospace',
                                }, children: props.polymarket.address
                                    ? `${props.polymarket.address.slice(0, 8)}...${props.polymarket.address.slice(-6)}`
                                    : '—' }), _jsxs("div", { style: { fontSize: 13, color: '#888', marginTop: 8 }, children: [props.polymarket.open_positions || 0, " positions", props.polymarket.total_pnl && (_jsxs(_Fragment, { children: [' · ', _jsx(PnlBadge, { value: props.polymarket.total_pnl })] }))] })] }))] }), _jsx("div", { style: { display: 'flex', gap: 6, marginBottom: 16, background: '#fff', borderRadius: 10, padding: 6, border: '1px solid #e5e5e5' }, children: ['all', 'kalshi', 'polymarket'].map((tab) => (_jsx("button", { style: tabStyle(tab), onClick: () => setActiveTab(tab), children: tab.charAt(0).toUpperCase() + tab.slice(1) }, tab))) }), filteredPositions.length === 0 ? (_jsx("div", { style: { textAlign: 'center', color: '#999', padding: 48, fontSize: 14, background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5' }, children: "No positions found" })) : (_jsx("div", { style: { border: '1px solid #e5e5e5', borderRadius: 12, overflow: 'hidden', background: '#fff' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 }, children: [_jsx("thead", { children: _jsxs("tr", { style: { background: '#fafafa' }, children: [_jsx("th", { style: { padding: '12px 16px', textAlign: 'left', color: '#666', fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }, children: "Platform" }), _jsx("th", { style: { padding: '12px 16px', textAlign: 'left', color: '#666', fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }, children: "Market" }), _jsx("th", { style: { padding: '12px 16px', textAlign: 'right', color: '#666', fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }, children: "Position" }), _jsx("th", { style: { padding: '12px 16px', textAlign: 'right', color: '#666', fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }, children: "P&L" })] }) }), _jsx("tbody", { children: filteredPositions.map((pos, i) => (_jsxs("tr", { style: { borderTop: '1px solid #f0f0f0' }, children: [_jsx("td", { style: { padding: '12px 16px' }, children: _jsx(PlatformBadge, { platform: pos.platform }) }), _jsxs("td", { style: { padding: '12px 16px', color: '#111', maxWidth: 280 }, children: [_jsx("div", { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }, children: pos.ticker || pos.market || 'Unknown' }), pos.outcome && (_jsx("div", { style: { fontSize: 12, color: '#888', marginTop: 2 }, children: pos.outcome }))] }), _jsxs("td", { style: { padding: '12px 16px', textAlign: 'right', color: '#111', fontWeight: 600 }, children: [pos.position ?? pos.size ?? '—', pos.exposure && (_jsx("div", { style: { fontSize: 12, color: '#888', marginTop: 2 }, children: pos.exposure }))] }), _jsx("td", { style: { padding: '12px 16px', textAlign: 'right' }, children: pos.pnl ? _jsx(PnlBadge, { value: pos.pnl }) : pos.realized_pnl ? _jsx(PnlBadge, { value: pos.realized_pnl }) : '—' })] }, i))) })] }) })), _jsxs("div", { style: { fontSize: 12, color: '#999', marginTop: 12, textAlign: 'right' }, children: [props.total_positions || 0, " total positions"] })] }));
}
