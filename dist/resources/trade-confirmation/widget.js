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
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: success ? '#d1fae5' : '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            marginBottom: 16,
            border: `3px solid ${success ? '#10b981' : '#ef4444'}`,
        }, children: success ? '✓' : '✗' }));
}
function PlatformCard({ platform, data }) {
    const colors = {
        kalshi: { bg: '#f0f9ff', border: '#e0f2fe', label: '#0284c7', text: '#0369a1' },
        polymarket: { bg: '#faf5ff', border: '#f3e8ff', label: '#9333ea', text: '#7e22ce' },
    };
    const c = colors[platform];
    return (_jsxs("div", { style: { flex: 1, minWidth: 200, background: '#fff', border: `2px solid ${c.border}`, borderRadius: 12, padding: '14px 18px' }, children: [_jsx("div", { style: { fontSize: 11, color: c.label, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: platform }), Object.entries(data).map(([key, val]) => (_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 }, children: [_jsx("span", { style: { fontSize: 12, color: '#888' }, children: key.replace(/_/g, ' ') }), _jsx("span", { style: { fontSize: 13, fontWeight: 600, color: '#111' }, children: String(val) })] }, key)))] }));
}
export default function TradeConfirmation() {
    const { props } = useWidget({ orders: [], execution_errors: [] });
    const { plan, execution_errors, success, note } = props;
    const orders = props.orders ?? [];
    const isDryRun = plan?.dry_run;
    return (_jsxs("div", { style: { fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 700, background: '#fafafa', minHeight: '100vh' }, children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }, children: [_jsx(StatusIcon, { success: isDryRun ? undefined : success }), _jsx("h2", { style: { margin: 0, fontSize: 24, fontWeight: 700, color: '#111', textAlign: 'center', letterSpacing: '-0.02em' }, children: isDryRun ? 'Trade Plan (Dry Run)' : success ? 'Trade Executed!' : 'Partial Execution' }), note && (_jsx("p", { style: { margin: '10px 0 0', fontSize: 14, color: '#666', textAlign: 'center' }, children: note }))] }), plan && (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                            background: '#fff',
                            border: '2px solid #10b981',
                            borderRadius: 12,
                            padding: '18px 20px',
                            marginBottom: 20,
                        }, children: [_jsx("div", { style: { fontSize: 11, color: '#10b981', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: "Profit Summary" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, color: '#888', marginBottom: 4 }, children: "Guaranteed Profit" }), _jsx("div", { style: { fontSize: 28, fontWeight: 800, color: '#10b981' }, children: plan.guaranteed_profit })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, color: '#888', marginBottom: 4 }, children: "Edge" }), _jsx("div", { style: { fontSize: 20, fontWeight: 700, color: '#059669' }, children: plan.edge_pct })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, color: '#888', marginBottom: 4 }, children: "Total Cost" }), _jsx("div", { style: { fontSize: 16, fontWeight: 600, color: '#111' }, children: plan.total_cost })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, color: '#888', marginBottom: 4 }, children: "ROI" }), _jsx("div", { style: { fontSize: 16, fontWeight: 600, color: '#111' }, children: plan.roi_pct })] })] })] }), _jsx("div", { style: { fontSize: 14, color: '#666', marginBottom: 16, padding: '12px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e5e5e5' }, children: plan.opportunity }), _jsxs("div", { style: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }, children: [plan.kalshi_order && (_jsx(PlatformCard, { platform: "kalshi", data: {
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
                                } }))] })] })), orders.length > 0 && (_jsxs("div", { style: { marginBottom: 16 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: "Placed Orders" }), orders.map((order, i) => (_jsxs("div", { style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 16px',
                            background: '#fff',
                            borderRadius: 10,
                            marginBottom: 8,
                            fontSize: 13,
                            border: '1px solid #e5e5e5',
                        }, children: [_jsxs("div", { children: [_jsx("span", { style: {
                                            background: order.platform === 'kalshi' ? '#eff6ff' : '#faf5ff',
                                            color: order.platform === 'kalshi' ? '#0284c7' : '#9333ea',
                                            borderRadius: 6,
                                            padding: '4px 8px',
                                            fontWeight: 700,
                                            fontSize: 10,
                                            marginRight: 8,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                        }, children: order.platform }), order.ticker || order.market, " \u00B7 ", order.side.toUpperCase(), " \u00B7 ", order.quantity, " @ ", order.price] }), _jsx("span", { style: {
                                    color: order.status === 'resting' || order.status === 'active' ? '#10b981' : '#888',
                                    fontWeight: 700,
                                    fontSize: 12,
                                    textTransform: 'uppercase',
                                }, children: order.status })] }, i)))] })), execution_errors && execution_errors.length > 0 && (_jsxs("div", { style: {
                    background: '#fff',
                    border: '2px solid #fca5a5',
                    borderRadius: 12,
                    padding: '14px 18px',
                }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: "Errors" }), execution_errors.map((err, i) => (_jsxs("div", { style: { fontSize: 13, color: '#dc2626', marginBottom: 4 }, children: ["\u2022 ", err] }, i)))] })), isDryRun && (_jsxs("div", { style: {
                    marginTop: 16,
                    padding: '12px 16px',
                    background: '#fff',
                    border: '2px solid #fde047',
                    borderRadius: 12,
                    fontSize: 13,
                    color: '#92400e',
                }, children: [_jsx("strong", { children: "Dry run mode:" }), " No real trades were placed. Set ", _jsx("code", { style: { background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }, children: "dry_run=false" }), " to execute."] }))] }));
}
