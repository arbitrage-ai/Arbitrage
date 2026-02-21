import React from 'react';
import { useWidget, useCallTool } from 'mcp-use/react';

interface PlatformStatus {
  authenticated: boolean;
  account?: string;
  address?: string;
  balance?: string;
}

interface Props {
  kalshi: PlatformStatus;
  polymarket: PlatformStatus;
}

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: connected ? '#22c55e' : '#ef4444',
        marginRight: 8,
        boxShadow: connected ? '0 0 6px #22c55e' : 'none',
      }}
    />
  );
}

export default function AuthDashboard() {
  const { props, isPending } = useWidget<Props>();
  const { callTool: loginKalshi, isPending: kalshiLoading } = useCallTool('kalshi_login');
  const { callTool: loginPoly, isPending: polyLoading } = useCallTool('polymarket_login');
  const { callTool: fetchPortfolio, isPending: portfolioLoading } = useCallTool('get_portfolio');

  if (isPending) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontFamily: 'system-ui' }}>
        Loading auth status...
      </div>
    );
  }

  const { kalshi, polymarket } = props;
  const bothConnected = kalshi.authenticated && polymarket.authenticated;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 20, maxWidth: 640 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
        PredictEdge Auth
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>
        Connect your Kalshi and Polymarket accounts to view your portfolio.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {/* Kalshi Card */}
        <div
          style={{
            flex: 1,
            borderRadius: 10,
            padding: '16px 20px',
            border: `1px solid ${kalshi.authenticated ? '#bfdbfe' : '#fecaca'}`,
            background: kalshi.authenticated ? '#eff6ff' : '#fef2f2',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <StatusDot connected={kalshi.authenticated} />
            <span style={{ fontWeight: 600, fontSize: 15, color: '#1e3a8a' }}>Kalshi</span>
          </div>
          {kalshi.authenticated ? (
            <>
              <div style={{ fontSize: 12, color: '#3b82f6', marginBottom: 2 }}>
                Account: {kalshi.account || 'connected'}
              </div>
              {kalshi.balance && (
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1e3a8a' }}>
                  {kalshi.balance}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: '#dc2626' }}>
              Not connected. Provide your Kalshi API Key ID and RSA private key to log in.
            </div>
          )}
        </div>

        {/* Polymarket Card */}
        <div
          style={{
            flex: 1,
            borderRadius: 10,
            padding: '16px 20px',
            border: `1px solid ${polymarket.authenticated ? '#e9d5ff' : '#fecaca'}`,
            background: polymarket.authenticated ? '#fdf4ff' : '#fef2f2',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <StatusDot connected={polymarket.authenticated} />
            <span style={{ fontWeight: 600, fontSize: 15, color: '#4c1d95' }}>Polymarket</span>
          </div>
          {polymarket.authenticated ? (
            <div style={{ fontSize: 13, color: '#7e22ce', wordBreak: 'break-all' }}>
              {polymarket.address
                ? `${polymarket.address.slice(0, 6)}...${polymarket.address.slice(-4)}`
                : 'connected'}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#dc2626' }}>
              Not connected. Provide your Ethereum wallet private key to log in.
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!kalshi.authenticated && (
          <button
            disabled={kalshiLoading}
            onClick={() =>
              loginKalshi({
                api_key_id: prompt('Enter Kalshi API Key ID:') || '',
                private_key_pem: prompt('Paste your RSA private key (PEM):') || '',
              })
            }
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: kalshiLoading ? 'not-allowed' : 'pointer',
              opacity: kalshiLoading ? 0.6 : 1,
            }}
          >
            {kalshiLoading ? 'Connecting...' : 'Login to Kalshi'}
          </button>
        )}
        {!polymarket.authenticated && (
          <button
            disabled={polyLoading}
            onClick={() =>
              loginPoly({
                private_key: prompt('Enter Ethereum wallet private key:') || '',
                funder_address: prompt('Proxy wallet address (optional, press Cancel to skip):') || undefined,
              })
            }
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#7c3aed',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: polyLoading ? 'not-allowed' : 'pointer',
              opacity: polyLoading ? 0.6 : 1,
            }}
          >
            {polyLoading ? 'Deriving keys...' : 'Login to Polymarket'}
          </button>
        )}
        {(kalshi.authenticated || polymarket.authenticated) && (
          <button
            disabled={portfolioLoading}
            onClick={() => fetchPortfolio({ platform: 'both' })}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: bothConnected ? '#0f172a' : '#f8fafc',
              color: bothConnected ? '#fff' : '#0f172a',
              fontSize: 14,
              fontWeight: 600,
              cursor: portfolioLoading ? 'not-allowed' : 'pointer',
              opacity: portfolioLoading ? 0.6 : 1,
            }}
          >
            {portfolioLoading ? 'Loading...' : 'View Portfolio'}
          </button>
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: '#94a3b8' }}>
        Your credentials are stored in-memory for this session only and never persisted to disk.
      </div>
    </div>
  );
}
