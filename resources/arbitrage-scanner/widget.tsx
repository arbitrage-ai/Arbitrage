import React, { useState } from 'react';
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

type Opportunity = z.infer<typeof opportunitySchema>;
type Props = z.infer<typeof propSchema>;

function EdgeBar({ edge }: { edge: number }) {
  const pct = Math.min(edge, 15); // cap at 15% for display
  const color = edge >= 5 ? '#16a34a' : edge >= 2 ? '#ca8a04' : '#ea580c';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: 80,
          height: 8,
          background: '#e2e8f0',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${(pct / 15) * 100}%`,
            height: '100%',
            background: color,
            borderRadius: 4,
          }}
        />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{edge.toFixed(2)}%</span>
    </div>
  );
}

function ExecuteButton({ opp, maxStake }: { opp: Opportunity; maxStake: number }) {
  const { callTool, isPending, isSuccess, isError } = useCallTool<{
    sport: 'nfl' | 'nba' | 'mlb' | 'nhl' | 'ncaaf' | 'ncaab' | 'all';
    max_stake: number;
    dry_run: boolean;
  }>('quick_arb');
  const [showConfirm, setShowConfirm] = useState(false);

  if (isSuccess) {
    return (
      <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
        ✓ Executed!
      </span>
    );
  }

  if (showConfirm) {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => {
            callTool({
              sport: 'all',
              max_stake: maxStake,
              dry_run: false,
            });
            setShowConfirm(false);
          }}
          disabled={isPending}
          style={{
            background: '#dc2626',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '4px 10px',
            fontSize: 12,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {isPending ? 'Placing...' : 'Confirm'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          style={{
            background: '#f1f5f9',
            color: '#475569',
            border: 'none',
            borderRadius: 4,
            padding: '4px 10px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      style={{
        background: '#1e293b',
        color: '#fff',
        border: 'none',
        borderRadius: 4,
        padding: '5px 12px',
        fontSize: 12,
        cursor: 'pointer',
        fontWeight: 600,
      }}
    >
      Execute →
    </button>
  );
}

export default function ArbitrageScanner() {
  const { props } = useWidget<Props>({ opportunities: [] });
  const [maxStake, setMaxStake] = useState(10);

  const opportunities = props.opportunities || [];
  const summary = props.scan_summary;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
            Arbitrage Scanner
          </h2>
          {summary && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
              {summary.sport.toUpperCase()} · {summary.matched_pairs} matched pairs · {opportunities.length} opportunities
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, color: '#64748b' }}>Max stake:</label>
          <input
            type="number"
            value={maxStake}
            onChange={(e) => setMaxStake(Number(e.target.value))}
            min={1}
            style={{
              width: 60,
              padding: '4px 8px',
              border: '1px solid #e2e8f0',
              borderRadius: 4,
              fontSize: 13,
            }}
          />
        </div>
      </div>

      {opportunities.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 48,
            background: '#f8fafc',
            borderRadius: 8,
            color: '#94a3b8',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No Arbitrage Found</div>
          <div style={{ fontSize: 13 }}>Markets are currently efficiently priced between platforms.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {opportunities.map((opp, i) => (
            <div
              key={opp.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px 16px',
                background: i === 0 ? '#f0fdf4' : '#fff',
                borderColor: i === 0 ? '#86efac' : '#e2e8f0',
              }}
            >
              {i === 0 && (
                <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, marginBottom: 4 }}>
                  ★ BEST OPPORTUNITY
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, marginRight: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                    {opp.event}
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>
                    {opp.trade}
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <EdgeBar edge={opp.edge_pct} />
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      ${opp.profit_per_contract.toFixed(4)}/contract · {opp.roi_pct.toFixed(1)}% ROI
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <ExecuteButton opp={opp} maxStake={maxStake} />
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {Math.floor(maxStake / opp.total_cost_per_pair)} contracts · ${(Math.floor(maxStake / opp.total_cost_per_pair) * opp.profit_per_contract).toFixed(2)} profit
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <div style={{ flex: 1, background: '#eff6ff', borderRadius: 6, padding: '6px 10px' }}>
                  <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 700, marginBottom: 2 }}>KALSHI</div>
                  <div style={{ fontSize: 12, color: '#1e40af' }}>
                    {opp.kalshi_side.toUpperCase()} @ {(opp.kalshi_price * 100).toFixed(1)}¢
                  </div>
                  <div style={{ fontSize: 10, color: '#93c5fd' }}>{opp.kalshi_ticker}</div>
                </div>
                <div style={{ flex: 1, background: '#fdf4ff', borderRadius: 6, padding: '6px 10px' }}>
                  <div style={{ fontSize: 10, color: '#7e22ce', fontWeight: 700, marginBottom: 2 }}>POLYMARKET</div>
                  <div style={{ fontSize: 12, color: '#4c1d95' }}>
                    {opp.polymarket_side} @ {(opp.polymarket_price * 100).toFixed(1)}¢
                  </div>
                  <div style={{ fontSize: 10, color: '#c084fc' }}>{opp.polymarket_slug}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', color: '#94a3b8', fontSize: 11 }}>
                  {opp.match_confidence}% match
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
