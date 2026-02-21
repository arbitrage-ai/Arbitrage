import React from 'react';
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

type Props = z.infer<typeof propSchema>;

function StatusIcon({ success }: { success?: boolean }) {
  if (success === undefined) return null;
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: success ? '#dcfce7' : '#fee2e2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 24,
        marginBottom: 12,
      }}
    >
      {success ? '✓' : '✗'}
    </div>
  );
}

function PlatformCard({ platform, data }: { platform: 'kalshi' | 'polymarket'; data: Record<string, unknown> }) {
  const colors = {
    kalshi: { bg: '#eff6ff', border: '#bfdbfe', label: '#3b82f6', text: '#1e40af' },
    polymarket: { bg: '#fdf4ff', border: '#e9d5ff', label: '#7e22ce', text: '#4c1d95' },
  };
  const c = colors[platform];

  return (
    <div style={{ flex: 1, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: '12px 16px' }}>
      <div style={{ fontSize: 11, color: c.label, fontWeight: 700, marginBottom: 8 }}>
        {platform.toUpperCase()}
      </div>
      {Object.entries(data).map(([key, val]) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {key.replace(/_/g, ' ')}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: c.text }}>
            {String(val)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function TradeConfirmation() {
  const { props } = useWidget<Props>({ orders: [], execution_errors: [] });
  const { plan, execution_errors, success, note } = props;
  const orders = props.orders ?? [];
  const isDryRun = plan?.dry_run;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 600 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
        <StatusIcon success={isDryRun ? undefined : success} />
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', textAlign: 'center' }}>
          {isDryRun ? '📋 Trade Plan (Dry Run)' : success ? '✅ Trade Executed!' : '⚠️ Partial Execution'}
        </h2>
        {note && (
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#64748b', textAlign: 'center' }}>
            {note}
          </p>
        )}
      </div>

      {plan && (
        <>
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 12, color: '#166534', fontWeight: 700, marginBottom: 8 }}>
              PROFIT SUMMARY
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: '#4ade80' }}>Guaranteed Profit</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a' }}>
                  {plan.guaranteed_profit}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Edge</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#15803d' }}>{plan.edge_pct}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Total Cost</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>{plan.total_cost}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748b' }}>ROI</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>{plan.roi_pct}</div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 13, color: '#475569', marginBottom: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 6 }}>
            {plan.opportunity}
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {plan.kalshi_order && (
              <PlatformCard
                platform="kalshi"
                data={{
                  Ticker: plan.kalshi_order.ticker,
                  Side: plan.kalshi_order.side.toUpperCase(),
                  Quantity: plan.kalshi_order.quantity,
                  Price: `${(plan.kalshi_order.price * 100).toFixed(1)}¢`,
                  Cost: plan.kalshi_order.cost,
                }}
              />
            )}
            {plan.polymarket_order && (
              <PlatformCard
                platform="polymarket"
                data={{
                  Slug: plan.polymarket_order.slug,
                  Side: plan.polymarket_order.side,
                  Quantity: plan.polymarket_order.quantity,
                  Price: `${(plan.polymarket_order.price * 100).toFixed(1)}¢`,
                  Cost: plan.polymarket_order.cost,
                }}
              />
            )}
          </div>
        </>
      )}

      {orders.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
            PLACED ORDERS
          </div>
          {orders.map((order, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: '#f8fafc',
                borderRadius: 6,
                marginBottom: 6,
                fontSize: 12,
              }}
            >
              <div>
                <span
                  style={{
                    background: order.platform === 'kalshi' ? '#eff6ff' : '#fdf4ff',
                    color: order.platform === 'kalshi' ? '#1d4ed8' : '#7e22ce',
                    borderRadius: 3,
                    padding: '1px 6px',
                    fontWeight: 700,
                    fontSize: 10,
                    marginRight: 6,
                  }}
                >
                  {order.platform.toUpperCase()}
                </span>
                {order.ticker || order.market} · {order.side.toUpperCase()} · {order.quantity} @ {order.price}
              </div>
              <span
                style={{
                  color: order.status === 'resting' || order.status === 'active' ? '#16a34a' : '#64748b',
                  fontWeight: 600,
                }}
              >
                {order.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {execution_errors && execution_errors.length > 0 && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '10px 14px',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>
            ERRORS
          </div>
          {execution_errors.map((err, i) => (
            <div key={i} style={{ fontSize: 12, color: '#b91c1c', marginBottom: 2 }}>
              • {err}
            </div>
          ))}
        </div>
      )}

      {isDryRun && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 14px',
            background: '#fef9c3',
            border: '1px solid #fde047',
            borderRadius: 6,
            fontSize: 12,
            color: '#713f12',
          }}
        >
          ⚠️ Dry run — no real trades were placed. Set <code>dry_run=false</code> to execute.
        </div>
      )}
    </div>
  );
}
