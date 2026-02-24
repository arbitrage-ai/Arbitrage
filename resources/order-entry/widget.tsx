import React, { useState } from 'react';
import { useWidget, useCallTool } from 'mcp-use/react';
import { z } from 'zod';

const marketSchema = z.object({
  platform: z.string().optional(),
  ticker: z.string().optional(),
  slug: z.string().optional(),
  title: z.string().optional(),
  question: z.string().optional(),
  yes_price: z.union([z.string(), z.number()]).optional(),
  no_price: z.union([z.string(), z.number()]).optional(),
  yes_bid: z.number().optional(),
  yes_ask: z.number().optional(),
  no_bid: z.number().optional(),
  no_ask: z.number().optional(),
}).passthrough();

const propSchema = z.object({
  markets: z.array(marketSchema).default([]),
  message: z.string().optional(),
});

type Props = z.infer<typeof propSchema>;

// Design System
const COLORS = {
  kalshi: {
    bg: '#EFF6FF',
    bgHover: '#DBEAFE',
    border: '#93C5FD',
    primary: '#3B82F6',
    primaryDark: '#2563EB',
    text: '#1E40AF',
    textLight: '#60A5FA',
  },
  polymarket: {
    bg: '#FAF5FF',
    bgHover: '#F3E8FF',
    border: '#D8B4FE',
    primary: '#A855F7',
    primaryDark: '#9333EA',
    text: '#7C3AED',
    textLight: '#C084FC',
  },
  success: {
    bg: '#F0FDF4',
    border: '#86EFAC',
    text: '#166534',
    primary: '#22C55E',
  },
  error: {
    bg: '#FEF2F2',
    border: '#FECACA',
    text: '#991B1B',
    primary: '#EF4444',
  },
  neutral: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
};

const LoadingSpinner = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    style={{ animation: 'spin 0.8s linear infinite' }}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    <style>{`
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `}</style>
  </svg>
);

export default function OrderEntry() {
  const { props } = useWidget<Props>({ markets: [] });
  const [platform, setPlatform] = useState<'kalshi' | 'polymarket'>('kalshi');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarket, setSelectedMarket] = useState<string>('');
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [action, setAction] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0.5);
  const [isFocused, setIsFocused] = useState<string | null>(null);

  const { callTool: searchMarkets, isPending: searchPending } = useCallTool<{
    query: string;
    platform: 'kalshi' | 'polymarket';
    limit?: number;
  }>('search_markets');

  const { callTool: placeOrder, isPending: orderPending, isSuccess: orderSuccess, isError: orderError } = useCallTool<{
    platform: 'kalshi' | 'polymarket';
    market_id: string;
    side: 'yes' | 'no';
    action: 'buy' | 'sell';
    quantity: number;
    price?: number;
    order_type?: string;
  }>('place_order');

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMarkets({ query: searchQuery, platform, limit: 10 });
    }
  };

  const handlePlaceOrder = () => {
    if (!selectedMarket || quantity <= 0) return;

    placeOrder({
      platform,
      market_id: selectedMarket,
      side,
      action,
      quantity,
      price,
      order_type: 'limit',
    });
  };

  const totalCost = quantity * price;
  const potentialProfit = action === 'buy' ? quantity * (1 - price) : quantity * price;
  const colors = COLORS[platform];

  const inputStyle = (name: string) => ({
    width: '100%',
    padding: '10px 14px',
    border: `2px solid ${isFocused === name ? colors.primary : COLORS.neutral[200]}`,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#FFFFFF',
    color: COLORS.neutral[900],
    outline: 'none',
    transition: 'all 0.2s ease',
    boxShadow: isFocused === name ? `0 0 0 3px ${colors.bg}` : 'none',
  });

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        minHeight: '100vh',
        background: `linear-gradient(to bottom, ${COLORS.neutral[50]}, ${COLORS.neutral[100]})`,
        padding: '32px 24px',
      }}
    >
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: COLORS.neutral[900], lineHeight: 1.2, marginBottom: 8 }}>
            Place Order
          </h1>
          <p style={{ margin: 0, fontSize: 16, color: COLORS.neutral[600], lineHeight: 1.5 }}>
            Search for markets and place manual orders on Kalshi and Polymarket
          </p>
        </div>

        {/* Main Card */}
        <div
          style={{
            background: '#FFFFFF',
            border: `2px solid ${COLORS.neutral[200]}`,
            borderRadius: 16,
            padding: 32,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Platform Selector */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 12 }}>
              Platform
            </label>
            <div style={{ display: 'flex', gap: 12, background: COLORS.neutral[100], borderRadius: 12, padding: 6 }}>
              {(['kalshi', 'polymarket'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 15,
                    background: platform === p ? COLORS[p].bg : 'transparent',
                    color: platform === p ? COLORS[p].text : COLORS.neutral[600],
                    border: platform === p ? `2px solid ${COLORS[p].border}` : '2px solid transparent',
                    transition: 'all 0.2s ease',
                    boxShadow: platform === p ? '0 1px 3px 0 rgba(0, 0, 0, 0.1)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (platform !== p) {
                      e.currentTarget.style.background = COLORS.neutral[50];
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (platform !== p) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {p === 'kalshi' ? 'Kalshi' : 'Polymarket'}
                </button>
              ))}
            </div>
          </div>

          {/* Market Search */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 12 }}>
              Search Market
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsFocused('search')}
                onBlur={() => setIsFocused(null)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g., NBA, Trump, Bitcoin..."
                style={inputStyle('search')}
              />
              <button
                onClick={handleSearch}
                disabled={searchPending || !searchQuery.trim()}
                style={{
                  background: searchPending || !searchQuery.trim() ? COLORS.neutral[300] : colors.primary,
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 24px',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: searchPending || !searchQuery.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  boxShadow: searchPending || !searchQuery.trim() ? 'none' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                }}
                onMouseEnter={(e) => {
                  if (!searchPending && searchQuery.trim()) {
                    e.currentTarget.style.background = colors.primaryDark;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!searchPending && searchQuery.trim()) {
                    e.currentTarget.style.background = colors.primary;
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                  }
                }}
              >
                {searchPending && <LoadingSpinner />}
                {searchPending ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {/* Market Selector */}
          {props.markets && props.markets.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 12 }}>
                Select Market
              </label>
              <select
                value={selectedMarket}
                onChange={(e) => setSelectedMarket(e.target.value)}
                onFocus={() => setIsFocused('market')}
                onBlur={() => setIsFocused(null)}
                style={{
                  ...inputStyle('market'),
                  cursor: 'pointer',
                }}
              >
                <option value="">Choose a market...</option>
                {props.markets.map((market, i) => (
                  <option key={i} value={market.ticker || market.slug || ''}>
                    {market.title || market.question || 'Unknown'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Order Configuration */}
          <div
            style={{
              background: colors.bg,
              border: `2px solid ${colors.border}`,
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 20 }}>
              Order Configuration
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              {/* Side Selector */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 10 }}>
                  Side
                </label>
                <div style={{ display: 'flex', gap: 6, background: '#FFFFFF', borderRadius: 8, padding: 4, border: `1px solid ${COLORS.neutral[200]}` }}>
                  {(['yes', 'no'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSide(s)}
                      style={{
                        flex: 1,
                        padding: '10px 16px',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 14,
                        background: side === s ? (s === 'yes' ? COLORS.success.primary : COLORS.error.primary) : 'transparent',
                        color: side === s ? '#FFFFFF' : COLORS.neutral[600],
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Selector */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 10 }}>
                  Action
                </label>
                <div style={{ display: 'flex', gap: 6, background: '#FFFFFF', borderRadius: 8, padding: 4, border: `1px solid ${COLORS.neutral[200]}` }}>
                  {(['buy', 'sell'] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setAction(a)}
                      style={{
                        flex: 1,
                        padding: '10px 16px',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 14,
                        background: action === a ? COLORS.neutral[800] : 'transparent',
                        color: action === a ? '#FFFFFF' : COLORS.neutral[600],
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {a.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quantity Input */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 10 }}>
                Quantity (contracts)
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                onFocus={() => setIsFocused('quantity')}
                onBlur={() => setIsFocused(null)}
                min={1}
                style={inputStyle('quantity')}
              />
            </div>

            {/* Price Input */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 10 }}>
                Limit Price (0.00 - 1.00)
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)))}
                onFocus={() => setIsFocused('price')}
                onBlur={() => setIsFocused(null)}
                min={0}
                max={1}
                step={0.01}
                style={inputStyle('price')}
              />
              <div style={{ fontSize: 12, color: COLORS.neutral[500], marginTop: 8, fontWeight: 600 }}>
                {(price * 100).toFixed(1)}¢ per contract
              </div>
            </div>

            {/* Cost Summary */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 10,
                padding: '16px 18px',
                border: `2px solid ${COLORS.neutral[200]}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.neutral[600] }}>Total Cost:</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: COLORS.neutral[900] }}>
                  ${totalCost.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.neutral[600] }}>Potential Profit:</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: COLORS.success.primary }}>
                  ${potentialProfit.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Place Order Button */}
          <button
            onClick={handlePlaceOrder}
            disabled={orderPending || !selectedMarket || quantity <= 0}
            style={{
              width: '100%',
              background: orderPending || !selectedMarket || quantity <= 0 ? COLORS.neutral[300] : COLORS.neutral[900],
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 10,
              padding: '16px 24px',
              fontSize: 17,
              fontWeight: 700,
              cursor: orderPending || !selectedMarket || quantity <= 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: orderPending || !selectedMarket || quantity <= 0 ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
            }}
            onMouseEnter={(e) => {
              if (!orderPending && selectedMarket && quantity > 0) {
                e.currentTarget.style.background = COLORS.neutral[700];
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -4px rgba(0, 0, 0, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!orderPending && selectedMarket && quantity > 0) {
                e.currentTarget.style.background = COLORS.neutral[900];
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)';
              }
            }}
          >
            {orderPending && <LoadingSpinner />}
            {orderPending ? 'Placing Order...' : `Place ${action.toUpperCase()} Order`}
          </button>
        </div>

        {/* Status Messages */}
        {orderSuccess && (
          <div
            style={{
              marginTop: 16,
              padding: '14px 18px',
              background: COLORS.success.bg,
              border: `2px solid ${COLORS.success.border}`,
              borderRadius: 12,
              fontSize: 14,
              color: COLORS.success.text,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            }}
          >
            <span style={{ fontSize: 18 }}>✓</span>
            Order placed successfully!
          </div>
        )}
        {orderError && (
          <div
            style={{
              marginTop: 16,
              padding: '14px 18px',
              background: COLORS.error.bg,
              border: `2px solid ${COLORS.error.border}`,
              borderRadius: 12,
              fontSize: 14,
              color: COLORS.error.text,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            }}
          >
            <span style={{ fontSize: 18 }}>⚠</span>
            Failed to place order. Please check your credentials and try again.
          </div>
        )}
        {props.message && (
          <div
            style={{
              marginTop: 16,
              padding: '14px 18px',
              background: COLORS.success.bg,
              border: `2px solid ${COLORS.success.border}`,
              borderRadius: 12,
              fontSize: 14,
              color: COLORS.success.text,
              fontWeight: 500,
            }}
          >
            {props.message}
          </div>
        )}
      </div>
    </div>
  );
}
