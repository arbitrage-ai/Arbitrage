import React from 'react';
import { useWidget } from 'mcp-use/react';

type Order = {
  platform?: string;
  order_id?: string;
  status?: string;
  ticker?: string;
  market?: string;
  side?: string;
  action?: string;
  quantity?: number;
  price?: string;
  total_cost?: string;
  remaining?: number;
};

type Plan = {
  opportunity?: string;
  contracts?: number;
  total_cost?: string;
  guaranteed_profit?: string;
  edge_pct?: string;
  roi_pct?: string;
  dry_run?: boolean;
  kalshi_order?: Record<string, unknown>;
  polymarket_order?: Record<string, unknown>;
};

type Props = {
  plan?: Plan;
  orders?: Order[];
  execution_errors?: string[];
  success?: boolean;
  note?: string;
  guaranteed_profit?: string;
  markdown?: string;
};

function StatusIcon({ success }: { success?: boolean }) {
  if (success === undefined) return null;

  if (success) {
    return (
      <div style={{ width: 80, height: 80, marginBottom: 20, position: 'relative' }}>
        <svg viewBox="0 0 80 80" width="80" height="80">
          <style>{`
            @keyframes drawCircle {
              0% { stroke-dashoffset: 220; }
              100% { stroke-dashoffset: 0; }
            }
            @keyframes drawCheck {
              0% { stroke-dashoffset: 50; }
              100% { stroke-dashoffset: 0; }
            }
            @keyframes scaleIn {
              0% { transform: scale(0.8); opacity: 0; }
              50% { transform: scale(1.05); }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes pulseGlow {
              0%, 100% { filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.3)); }
              50% { filter: drop-shadow(0 0 20px rgba(16, 185, 129, 0.6)); }
            }
            .success-container {
              animation: scaleIn 0.4s ease-out forwards, pulseGlow 2s ease-in-out infinite 0.8s;
            }
            .success-circle {
              stroke-dasharray: 220;
              stroke-dashoffset: 220;
              animation: drawCircle 0.6s ease-out 0.1s forwards;
            }
            .success-check {
              stroke-dasharray: 50;
              stroke-dashoffset: 50;
              animation: drawCheck 0.4s ease-out 0.5s forwards;
            }
          `}</style>
          <g className="success-container">
            <circle
              className="success-circle"
              cx="40" cy="40" r="35"
              fill="none" stroke="#10b981" strokeWidth="3"
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
            />
            <circle cx="40" cy="40" r="33" fill="#d1fae5" fillOpacity="0.15" />
            <polyline
              className="success-check"
              points="24,42 35,52 56,30"
              fill="none" stroke="#10b981" strokeWidth="4"
              strokeLinecap="round" strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: '#fee2e2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 28,
        marginBottom: 16,
        border: '3px solid #ef4444',
      }}
    >
      ✗
    </div>
  );
}

function PlatformCard({ platform, data }: { platform: string; data: Record<string, unknown> }) {
  const isKalshi = platform.toLowerCase().includes('kalshi');
  const c = isKalshi
    ? { border: '#e0f2fe', label: '#0284c7' }
    : { border: '#f3e8ff', label: '#9333ea' };

  return (
    <div style={{ flex: 1, minWidth: 200, background: '#fff', border: `2px solid ${c.border}`, borderRadius: 12, padding: '14px 18px' }}>
      <div style={{ fontSize: 11, color: c.label, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {platform}
      </div>
      {Object.entries(data).map(([key, val]) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#888' }}>
            {key.replace(/_/g, ' ')}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
            {String(val)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function TradeConfirmation() {
  const { props, isPending } = useWidget<Props>({ orders: [], execution_errors: [] });

  // Extract with safe fallbacks — props may be partial or arrive in unexpected shapes
  const raw = props as Record<string, unknown>;
  const plan = (raw?.plan ?? raw) as Plan | undefined;
  const orders = (Array.isArray(raw?.orders) ? raw.orders : Array.isArray(raw?.orders_placed) ? raw.orders_placed : []) as Order[];
  const execution_errors = (Array.isArray(raw?.execution_errors) ? raw.execution_errors : []) as string[];
  const success = raw?.success as boolean | undefined;
  const note = (raw?.note ?? '') as string;
  const isDryRun = plan?.dry_run;
  const guaranteedProfit = (raw?.guaranteed_profit ?? plan?.guaranteed_profit ?? '') as string;

  if (isPending) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: 40, textAlign: 'center', background: '#fafafa', minHeight: '100vh' }}>
        <style>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        `}</style>
        <div style={{
          width: 48, height: 48, border: '4px solid #e5e7eb', borderTop: '4px solid #10b981',
          borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px',
        }} />
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111', animation: 'pulse 1.5s ease-in-out infinite' }}>
          Executing trades...
        </h2>
      </div>
    );
  }

  // Check if we have any meaningful data at all
  const hasPlan = plan && (plan.opportunity || plan.guaranteed_profit || plan.edge_pct);
  const hasOrders = orders.length > 0;
  const hasErrors = execution_errors.length > 0;
  const hasAnything = hasPlan || hasOrders || hasErrors || note;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 700, background: '#fafafa', minHeight: '100vh' }}>
      <style>{`
        @keyframes profitFadeIn {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes profitCountUp {
          0% { opacity: 0; transform: scale(0.5); }
          60% { transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
        <StatusIcon success={isDryRun ? undefined : success} />
        <h2 style={{
          margin: 0, fontSize: 24, fontWeight: 700, color: '#111', textAlign: 'center', letterSpacing: '-0.02em',
          ...(success && !isDryRun ? { animation: 'profitFadeIn 0.5s ease-out 0.8s both' } : {}),
        }}>
          {isDryRun ? 'Trade Plan (Dry Run)' : success ? 'Trade Executed!' : hasErrors ? 'Partial Execution' : hasAnything ? 'Trade Summary' : 'Processing...'}
        </h2>
        {success && !isDryRun && guaranteedProfit && (
          <div style={{
            marginTop: 12,
            fontSize: 36,
            fontWeight: 800,
            color: '#10b981',
            animation: 'profitCountUp 0.6s ease-out 1.0s both',
          }}>
            +{guaranteedProfit}
          </div>
        )}
        {note && (
          <p style={{ margin: '10px 0 0', fontSize: 14, color: '#666', textAlign: 'center', maxWidth: 500 }}>
            {note}
          </p>
        )}
      </div>

      {hasPlan && (
        <>
          <div
            style={{
              background: '#fff',
              border: '2px solid #10b981',
              borderRadius: 12,
              padding: '18px 20px',
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Profit Summary
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {(plan.guaranteed_profit || guaranteedProfit) && (
                <div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Guaranteed Profit</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>
                    {plan.guaranteed_profit || guaranteedProfit}
                  </div>
                </div>
              )}
              {plan.edge_pct && (
                <div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Edge</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#059669' }}>{plan.edge_pct}</div>
                </div>
              )}
              {plan.total_cost && (
                <div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Total Cost</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>{plan.total_cost}</div>
                </div>
              )}
              {plan.roi_pct && (
                <div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>ROI</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>{plan.roi_pct}</div>
                </div>
              )}
            </div>
          </div>

          {plan.opportunity && (
            <div style={{ fontSize: 14, color: '#666', marginBottom: 16, padding: '12px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e5e5e5' }}>
              {plan.opportunity}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {plan.kalshi_order && (
              <PlatformCard
                platform="kalshi"
                data={{
                  Ticker: (plan.kalshi_order as any).ticker,
                  Side: String((plan.kalshi_order as any).side || '').toUpperCase(),
                  Quantity: (plan.kalshi_order as any).quantity,
                  Price: `${(Number((plan.kalshi_order as any).price) * 100).toFixed(1)}¢`,
                  Cost: (plan.kalshi_order as any).cost,
                }}
              />
            )}
            {plan.polymarket_order && (
              <PlatformCard
                platform="polymarket"
                data={{
                  Slug: (plan.polymarket_order as any).slug,
                  Side: (plan.polymarket_order as any).side,
                  Quantity: (plan.polymarket_order as any).quantity,
                  Price: `${(Number((plan.polymarket_order as any).price) * 100).toFixed(1)}¢`,
                  Cost: (plan.polymarket_order as any).cost,
                }}
              />
            )}
          </div>
        </>
      )}

      {hasOrders && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Placed Orders
          </div>
          {orders.map((order, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#fff',
                borderRadius: 10,
                marginBottom: 8,
                fontSize: 13,
                border: '1px solid #e5e5e5',
              }}
            >
              <div>
                <span
                  style={{
                    background: order.platform === 'kalshi' ? '#eff6ff' : '#faf5ff',
                    color: order.platform === 'kalshi' ? '#0284c7' : '#9333ea',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontWeight: 700,
                    fontSize: 10,
                    marginRight: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {order.platform}
                </span>
                {order.ticker || order.market || ''} · {(order.side || '').toUpperCase()} · {order.quantity} @ {order.price}
              </div>
              <span
                style={{
                  color: order.status === 'resting' || order.status === 'active' ? '#10b981' : '#888',
                  fontWeight: 700,
                  fontSize: 12,
                  textTransform: 'uppercase',
                }}
              >
                {order.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {hasErrors && (
        <div
          style={{
            background: '#fff',
            border: '2px solid #fca5a5',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Errors
          </div>
          {execution_errors.map((err, i) => (
            <div key={i} style={{ fontSize: 13, color: '#dc2626', marginBottom: 4 }}>
              {String(err)}
            </div>
          ))}
        </div>
      )}

      {isDryRun && (
        <div
          style={{
            marginTop: 16,
            padding: '12px 16px',
            background: '#fff',
            border: '2px solid #fde047',
            borderRadius: 12,
            fontSize: 13,
            color: '#92400e',
          }}
        >
          <strong>Dry run mode:</strong> No real trades were placed. Set <code style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }}>dry_run=false</code> to execute.
        </div>
      )}
    </div>
  );
}
