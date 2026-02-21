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
    kalshi: { bg: '#eff6ff', text: '#1d4ed8' },
    polymarket: { bg: '#fdf4ff', text: '#7e22ce' },
  };
  const style = colors[platform] || { bg: '#f3f4f6', text: '#374151' };
  return (
    <span
      style={{
        background: style.bg,
        color: style.text,
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
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
    padding: '6px 16px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 13,
    background: activeTab === tab ? '#1e293b' : 'transparent',
    color: activeTab === tab ? '#fff' : '#64748b',
  });

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 720 }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
        Portfolio Overview
      </h2>

      {/* Platform summary cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {props.kalshi && (
          <div
            style={{
              flex: 1,
              background: '#eff6ff',
              borderRadius: 8,
              padding: '12px 16px',
              border: '1px solid #bfdbfe',
            }}
          >
            <div style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600, marginBottom: 4 }}>
              KALSHI
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1e3a8a' }}>
              {props.kalshi.balance || '—'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
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
              background: '#fdf4ff',
              borderRadius: 8,
              padding: '12px 16px',
              border: '1px solid #e9d5ff',
            }}
          >
            <div style={{ fontSize: 12, color: '#7e22ce', fontWeight: 600, marginBottom: 4 }}>
              POLYMARKET
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#4c1d95',
                wordBreak: 'break-all',
              }}
            >
              {props.polymarket.address
                ? `${props.polymarket.address.slice(0, 6)}...${props.polymarket.address.slice(-4)}`
                : '—'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
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
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: '#f1f5f9', borderRadius: 8, padding: 4 }}>
        {(['all', 'kalshi', 'polymarket'] as const).map((tab) => (
          <button key={tab} style={tabStyle(tab)} onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Positions table */}
      {filteredPositions.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 14 }}>
          No positions found
        </div>
      ) : (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Platform</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Market</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Position</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>P&L</th>
              </tr>
            </thead>
            <tbody>
              {filteredPositions.map((pos, i) => (
                <tr
                  key={i}
                  style={{ borderTop: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}
                >
                  <td style={{ padding: '8px 12px' }}>
                    <PlatformBadge platform={pos.platform} />
                  </td>
                  <td style={{ padding: '8px 12px', color: '#1e293b', maxWidth: 240 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pos.ticker || pos.market || 'Unknown'}
                    </div>
                    {pos.outcome && (
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{pos.outcome}</div>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1e293b' }}>
                    {pos.position ?? pos.size ?? '—'}
                    {pos.exposure && (
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{pos.exposure}</div>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    {pos.pnl ? <PnlBadge value={pos.pnl} /> : pos.realized_pnl ? <PnlBadge value={pos.realized_pnl} /> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, textAlign: 'right' }}>
        {props.total_positions || 0} total positions
      </div>
    </div>
  );
}
