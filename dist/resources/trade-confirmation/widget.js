import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useWidget } from 'mcp-use/react';
import { z } from 'zod';
const orderSchema = z.object({
    platform: z.enum(['kalshi', 'polymarket']),
    order_id: z.string(),
    status: z.string(),
    ticker: z.string().optional(),
    market: z.string().optional(),
    side: z.string(),
    action: z.string().optional(),
    quantity: z.number(),
    price: z.string(),
    total_cost: z.string().optional(),
    remaining: z.number().optional(),
});
const propSchema = z.object({
    plan: z
        .object({
        opportunity: z.string(),
        contracts: z.number(),
        total_cost: z.string(),
        guaranteed_profit: z.string(),
        edge_pct: z.string(),
        roi_pct: z.string(),
        dry_run: z.boolean(),
        kalshi_order: z
            .object({
            ticker: z.string(),
            side: z.string(),
            quantity: z.number(),
            price: z.number(),
            cost: z.string(),
        })
            .optional(),
        polymarket_order: z
            .object({
            slug: z.string(),
            side: z.string(),
            quantity: z.number(),
            price: z.number(),
            cost: z.string(),
        })
            .optional(),
    })
        .optional(),
    orders: z.array(orderSchema).default([]),
    execution_errors: z.array(z.string()).default([]),
    success: z.boolean().optional(),
    note: z.string().optional(),
    guaranteed_profit: z.string().optional(),
});
function StatusIcon({ success }) {
    if (success === undefined)
        return null;
    return (_jsx("div", { style: {
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: success ? '#dcfce7' : '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            marginBottom: 12,
        }, children: success ? '✓' : '✗' }));
}
function PlatformCard({ platform, data }) {
    const colors = {
        kalshi: { bg: '#eff6ff', border: '#bfdbfe', label: '#3b82f6', text: '#1e40af' },
        polymarket: { bg: '#fdf4ff', border: '#e9d5ff', label: '#7e22ce', text: '#4c1d95' },
    };
    const c = colors[platform];
    return (_jsxs("div", { style: { flex: 1, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: '12px 16px' }, children: [_jsx("div", { style: { fontSize: 11, color: c.label, fontWeight: 700, marginBottom: 8 }, children: platform.toUpperCase() }), Object.entries(data).map(([key, val]) => (_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 }, children: [_jsx("span", { style: { fontSize: 12, color: '#64748b' }, children: key.replace(/_/g, ' ') }), _jsx("span", { style: { fontSize: 12, fontWeight: 600, color: c.text }, children: String(val) })] }, key)))] }));
}
export default function TradeConfirmation() {
    const { props } = useWidget({ orders: [], execution_errors: [] });
    const { plan, execution_errors, success, note } = props;
    const orders = props.orders ?? [];
    const isDryRun = plan?.dry_run;
    return (_jsxs("div", { style: { fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 600 }, children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }, children: [_jsx(StatusIcon, { success: isDryRun ? undefined : success }), _jsx("h2", { style: { margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', textAlign: 'center' }, children: isDryRun ? '📋 Trade Plan (Dry Run)' : success ? '✅ Trade Executed!' : '⚠️ Partial Execution' }), note && (_jsx("p", { style: { margin: '8px 0 0', fontSize: 14, color: '#64748b', textAlign: 'center' }, children: note }))] }), plan && (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                            background: '#f0fdf4',
                            border: '1px solid #86efac',
                            borderRadius: 8,
                            padding: '12px 16px',
                            marginBottom: 16,
                        }, children: [_jsx("div", { style: { fontSize: 12, color: '#166534', fontWeight: 700, marginBottom: 8 }, children: "PROFIT SUMMARY" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 11, color: '#4ade80' }, children: "Guaranteed Profit" }), _jsx("div", { style: { fontSize: 22, fontWeight: 800, color: '#16a34a' }, children: plan.guaranteed_profit })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 11, color: '#64748b' }, children: "Edge" }), _jsx("div", { style: { fontSize: 18, fontWeight: 700, color: '#15803d' }, children: plan.edge_pct })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 11, color: '#64748b' }, children: "Total Cost" }), _jsx("div", { style: { fontSize: 15, fontWeight: 600, color: '#1e293b' }, children: plan.total_cost })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 11, color: '#64748b' }, children: "ROI" }), _jsx("div", { style: { fontSize: 15, fontWeight: 600, color: '#1e293b' }, children: plan.roi_pct })] })] })] }), _jsx("div", { style: { fontSize: 13, color: '#475569', marginBottom: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 6 }, children: plan.opportunity }), _jsxs("div", { style: { display: 'flex', gap: 10, marginBottom: 16 }, children: [plan.kalshi_order && (_jsx(PlatformCard, { platform: "kalshi", data: {
                                    Ticker: plan.kalshi_order.ticker,
                                    Side: plan.kalshi_order.side.toUpperCase(),
                                    Quantity: plan.kalshi_order.quantity,
                                    Price: `${(plan.kalshi_order.price * 100).toFixed(1)}¢`,
                                    Cost: plan.kalshi_order.cost,
                                } })), plan.polymarket_order && (_jsx(PlatformCard, { platform: "polymarket", data: {
                                    Slug: plan.polymarket_order.slug,
                                    Side: plan.polymarket_order.side,
                                    Quantity: plan.polymarket_order.quantity,
                                    Price: `${(plan.polymarket_order.price * 100).toFixed(1)}¢`,
                                    Cost: plan.polymarket_order.cost,
                                } }))] })] })), orders.length > 0 && (_jsxs("div", { style: { marginBottom: 12 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }, children: "PLACED ORDERS" }), orders.map((order, i) => (_jsxs("div", { style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            background: '#f8fafc',
                            borderRadius: 6,
                            marginBottom: 6,
                            fontSize: 12,
                        }, children: [_jsxs("div", { children: [_jsx("span", { style: {
                                            background: order.platform === 'kalshi' ? '#eff6ff' : '#fdf4ff',
                                            color: order.platform === 'kalshi' ? '#1d4ed8' : '#7e22ce',
                                            borderRadius: 3,
                                            padding: '1px 6px',
                                            fontWeight: 700,
                                            fontSize: 10,
                                            marginRight: 6,
                                        }, children: order.platform.toUpperCase() }), order.ticker || order.market, " \u00B7 ", order.side.toUpperCase(), " \u00B7 ", order.quantity, " @ ", order.price] }), _jsx("span", { style: {
                                    color: order.status === 'resting' || order.status === 'active' ? '#16a34a' : '#64748b',
                                    fontWeight: 600,
                                }, children: order.status })] }, i)))] })), execution_errors && execution_errors.length > 0 && (_jsxs("div", { style: {
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 8,
                    padding: '10px 14px',
                }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 6 }, children: "ERRORS" }), execution_errors.map((err, i) => (_jsxs("div", { style: { fontSize: 12, color: '#b91c1c', marginBottom: 2 }, children: ["\u2022 ", err] }, i)))] })), isDryRun && (_jsxs("div", { style: {
                    marginTop: 12,
                    padding: '8px 14px',
                    background: '#fef9c3',
                    border: '1px solid #fde047',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#713f12',
                }, children: ["\u26A0\uFE0F Dry run \u2014 no real trades were placed. Set ", _jsx("code", { children: "dry_run=false" }), " to execute."] }))] }));
}
