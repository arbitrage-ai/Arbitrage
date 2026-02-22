import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useWidget, useCallTool } from 'mcp-use/react';
import { z } from 'zod';
const opportunitySchema = z.object({
    id: z.string(),
    event: z.string(),
    trade: z.string(),
    edge_pct: z.number(),
    profit_per_contract: z.number(),
    total_cost_per_pair: z.number(),
    roi_pct: z.number(),
    kalshi_ticker: z.string(),
    kalshi_side: z.string(),
    kalshi_price: z.number(),
    polymarket_slug: z.string(),
    polymarket_side: z.string(),
    polymarket_price: z.number(),
    match_confidence: z.number(),
});
const propSchema = z.object({
    opportunities: z.array(opportunitySchema).default([]),
    scan_summary: z
        .object({
        sport: z.string(),
        kalshi_markets_fetched: z.number(),
        polymarket_markets_fetched: z.number(),
        matched_pairs: z.number(),
        opportunities_found: z.number(),
        min_edge_filter: z.number(),
    })
        .optional(),
    markdown: z.string().optional(),
});
function EdgeBar({ edge }) {
    const pct = Math.min(edge, 15); // cap at 15% for display
    const color = edge >= 5 ? '#16a34a' : edge >= 2 ? '#ca8a04' : '#ea580c';
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: {
                    width: 80,
                    height: 8,
                    background: '#e2e8f0',
                    borderRadius: 4,
                    overflow: 'hidden',
                }, children: _jsx("div", { style: {
                        width: `${(pct / 15) * 100}%`,
                        height: '100%',
                        background: color,
                        borderRadius: 4,
                    } }) }), _jsxs("span", { style: { fontSize: 13, fontWeight: 700, color }, children: [edge.toFixed(2), "%"] })] }));
}
function ExecuteButton({ opp, maxStake }) {
    const { callTool, isPending, isSuccess, isError } = useCallTool('quick_arb');
    const [showConfirm, setShowConfirm] = useState(false);
    if (isSuccess) {
        return (_jsx("span", { style: { fontSize: 12, color: '#16a34a', fontWeight: 600 }, children: "\u2713 Executed!" }));
    }
    if (showConfirm) {
        return (_jsxs("div", { style: { display: 'flex', gap: 6 }, children: [_jsx("button", { onClick: () => {
                        callTool({
                            sport: 'all',
                            max_stake: maxStake,
                            dry_run: false,
                        });
                        setShowConfirm(false);
                    }, disabled: isPending, style: {
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 10px',
                        fontSize: 12,
                        cursor: 'pointer',
                        fontWeight: 600,
                    }, children: isPending ? 'Placing...' : 'Confirm' }), _jsx("button", { onClick: () => setShowConfirm(false), style: {
                        background: '#f1f5f9',
                        color: '#475569',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 10px',
                        fontSize: 12,
                        cursor: 'pointer',
                    }, children: "Cancel" })] }));
    }
    return (_jsx("button", { onClick: () => setShowConfirm(true), style: {
            background: '#1e293b',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '5px 12px',
            fontSize: 12,
            cursor: 'pointer',
            fontWeight: 600,
        }, children: "Execute \u2192" }));
}
export default function ArbitrageScanner() {
    const { props } = useWidget({ opportunities: [] });
    const [maxStake, setMaxStake] = useState(10);
    const opportunities = props.opportunities || [];
    const summary = props.scan_summary;
    return (_jsxs("div", { style: { fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 800, background: '#fafafa', minHeight: '100vh' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }, children: [_jsxs("div", { children: [_jsx("h2", { style: { margin: 0, fontSize: 24, fontWeight: 700, color: '#111', letterSpacing: '-0.02em' }, children: "Arbitrage Scanner" }), summary && (_jsxs("p", { style: { margin: '6px 0 0', fontSize: 14, color: '#666' }, children: [summary.sport.toUpperCase(), " \u00B7 ", summary.matched_pairs, " pairs \u00B7 ", opportunities.length, " opportunities"] }))] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e5e5' }, children: [_jsx("label", { style: { fontSize: 13, color: '#666', fontWeight: 500 }, children: "Max stake:" }), _jsx("input", { type: "number", value: maxStake, onChange: (e) => setMaxStake(Number(e.target.value)), min: 1, style: {
                                    width: 70,
                                    padding: '6px 10px',
                                    border: '1px solid #e5e5e5',
                                    borderRadius: 6,
                                    fontSize: 14,
                                    fontWeight: 500,
                                } })] })] }), opportunities.length === 0 ? (_jsxs("div", { style: {
                    textAlign: 'center',
                    padding: 60,
                    background: '#fff',
                    borderRadius: 12,
                    color: '#999',
                    border: '1px solid #e5e5e5',
                }, children: [_jsx("div", { style: { fontSize: 36, marginBottom: 12 }, children: "\uD83D\uDD0D" }), _jsx("div", { style: { fontSize: 16, fontWeight: 600, marginBottom: 6, color: '#333' }, children: "No Arbitrage Found" }), _jsx("div", { style: { fontSize: 14 }, children: "Markets are efficiently priced" })] })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: opportunities.map((opp, i) => (_jsxs("div", { style: {
                        border: i === 0 ? '2px solid #10b981' : '1px solid #e5e5e5',
                        borderRadius: 12,
                        padding: '16px 20px',
                        background: '#fff',
                        boxShadow: i === 0 ? '0 4px 12px rgba(16, 185, 129, 0.1)' : 'none',
                    }, children: [i === 0 && (_jsx("div", { style: { fontSize: 11, color: '#10b981', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: "\u2605 Best Opportunity" })), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }, children: [_jsxs("div", { style: { flex: 1, marginRight: 16 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 6, lineHeight: 1.3 }, children: opp.event }), _jsx("div", { style: { fontSize: 13, color: '#666', marginBottom: 12 }, children: opp.trade }), _jsxs("div", { style: { display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsx(EdgeBar, { edge: opp.edge_pct }), _jsxs("span", { style: { fontSize: 13, color: '#888' }, children: ["$", opp.profit_per_contract.toFixed(4), "/contract \u00B7 ", opp.roi_pct.toFixed(1), "% ROI"] })] })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }, children: [_jsx(ExecuteButton, { opp: opp, maxStake: maxStake }), _jsxs("div", { style: { fontSize: 12, color: '#999', textAlign: 'right' }, children: [Math.floor(maxStake / opp.total_cost_per_pair), " contracts", _jsx("br", {}), "$", (Math.floor(maxStake / opp.total_cost_per_pair) * opp.profit_per_contract).toFixed(2), " profit"] })] })] }), _jsxs("div", { style: { display: 'flex', gap: 10, marginTop: 14 }, children: [_jsxs("div", { style: { flex: 1, background: '#f0f9ff', borderRadius: 8, padding: '10px 12px', border: '1px solid #e0f2fe' }, children: [_jsx("div", { style: { fontSize: 10, color: '#0284c7', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: "Kalshi" }), _jsxs("div", { style: { fontSize: 13, color: '#111', fontWeight: 600 }, children: [opp.kalshi_side.toUpperCase(), " @ ", (opp.kalshi_price * 100).toFixed(1), "\u00A2"] }), _jsx("div", { style: { fontSize: 10, color: '#0284c7', marginTop: 2, opacity: 0.7 }, children: opp.kalshi_ticker })] }), _jsxs("div", { style: { flex: 1, background: '#faf5ff', borderRadius: 8, padding: '10px 12px', border: '1px solid #f3e8ff' }, children: [_jsx("div", { style: { fontSize: 10, color: '#9333ea', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: "Polymarket" }), _jsxs("div", { style: { fontSize: 13, color: '#111', fontWeight: 600 }, children: [opp.polymarket_side, " @ ", (opp.polymarket_price * 100).toFixed(1), "\u00A2"] }), _jsx("div", { style: { fontSize: 10, color: '#9333ea', marginTop: 2, opacity: 0.7 }, children: opp.polymarket_slug })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', color: '#999', fontSize: 12, fontWeight: 500 }, children: [opp.match_confidence, "%"] })] })] }, opp.id))) }))] }));
}
