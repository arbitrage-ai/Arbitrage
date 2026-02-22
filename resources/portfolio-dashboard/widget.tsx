import React, { useState } from 'react';
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

type Props = z.infer<typeof propSchema>;

function PnlBadge({ value }: { value: string }) {
  const isPositive = value.startsWith('+') || (parseFloat(value.replace(/[^0-9.-]/g, '')) > 0);
  const color = isPositive ? '#16a34a' : value.includes('-') ? '#dc2626' : '#6b7280';
  return (
    <span style={{ color, fontWeight: 600 }}>{value}</span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    kalshi: { bg: '#eff6ff', text: '#0284c7' },
    polymarket: { bg: '#faf5ff', text: '#9333ea' },
  };
  const style = colors[platform] || { bg: '#f5f5f5', text: '#666' };
  return (
    <span
      style={{
        background: style.bg,
        color: style.text,
        borderRadius: 6,
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {platform}
    </span>
  );
}

export default function PortfolioDashboard() {
  const { props } = useWidget<Props>({
    positions: [],
  });
  const [activeTab, setActiveTab] = useState<'all' | 'kalshi' | 'polymarket'>('all');

  const filteredPositions = (props.positions || []).filter(
    (p) => activeTab === 'all' || p.platform === activeTab
  );

  const tabStyle = (tab: string) => ({
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

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 900, background: '#fafafa', minHeight: '100vh' }}>
      <h2 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 700, color: '#111', letterSpacing: '-0.02em' }}>
        Portfolio Overview
      </h2>

      {/* Platform summary cards */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        {props.kalshi && (
          <div
            style={{
              flex: 1,
              minWidth: 250,
              background: '#fff',
              borderRadius: 12,
              padding: '16px 20px',
              border: '1px solid #e5e5e5',
            }}
          >
            <div style={{ fontSize: 11, color: '#0284c7', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Kalshi
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#111' }}>
              {props.kalshi.balance || '—'}
            </div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 8 }}>
              {props.kalshi.open_positions || 0} positions · {props.kalshi.realized_pnl && (
                <PnlBadge value={props.kalshi.realized_pnl} />
              )} P&L
            </div>
          </div>
        )}
        {props.polymarket && (
          <div
            style={{
              flex: 1,
              minWidth: 250,
              background: '#fff',
              borderRadius: 12,
              padding: '16px 20px',
              border: '1px solid #e5e5e5',
            }}
          >
            <div style={{ fontSize: 11, color: '#9333ea', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Polymarket
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#111',
                wordBreak: 'break-all',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {props.polymarket.address
                ? `${props.polymarket.address.slice(0, 8)}...${props.polymarket.address.slice(-6)}`
                : '—'}
            </div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 8 }}>
              {props.polymarket.open_positions || 0} positions
              {props.polymarket.total_pnl && (
                <>
                  {' · '}
                  <PnlBadge value={props.polymarket.total_pnl} />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: '#fff', borderRadius: 10, padding: 6, border: '1px solid #e5e5e5' }}>
        {(['all', 'kalshi', 'polymarket'] as const).map((tab) => (
          <button key={tab} style={tabStyle(tab)} onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Positions table */}
      {filteredPositions.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: 48, fontSize: 14, background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5' }}>
          No positions found
        </div>
      ) : (
        <div style={{ border: '1px solid #e5e5e5', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#666', fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }}>Platform</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#666', fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }}>Market</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#666', fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }}>Position</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#666', fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }}>P&L</th>
              </tr>
            </thead>
            <tbody>
              {filteredPositions.map((pos, i) => (
                <tr
                  key={i}
                  style={{ borderTop: '1px solid #f0f0f0' }}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <PlatformBadge platform={pos.platform} />
                  </td>
                  <td style={{ padding: '12px 16px', color: '#111', maxWidth: 280 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {pos.ticker || pos.market || 'Unknown'}
                    </div>
                    {pos.outcome && (
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{pos.outcome}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#111', fontWeight: 600 }}>
                    {pos.position ?? pos.size ?? '—'}
                    {pos.exposure && (
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{pos.exposure}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {pos.pnl ? <PnlBadge value={pos.pnl} /> : pos.realized_pnl ? <PnlBadge value={pos.realized_pnl} /> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: 12, color: '#999', marginTop: 12, textAlign: 'right' }}>
        {props.total_positions || 0} total positions
      </div>
    </div>
  );
}
