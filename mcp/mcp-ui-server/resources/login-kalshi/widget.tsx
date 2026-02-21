import React from 'react';
import { useWidget, useCallTool } from 'mcp-use/react';

interface Props {
  success: boolean;
  platform: string;
  account?: string;
  balance?: string;
  error?: string;
}

export default function LoginKalshi() {
  const { props, isPending } = useWidget<Props>();
  const { callTool: viewPortfolio, isPending: loading } = useCallTool('get_portfolio');

  if (isPending) {
    return (
      <div style={{ padding: 32, textAlign: 'center', fontFamily: 'system-ui' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>Authenticating with Kalshi...</div>
        <div style={{ color: '#64748b', fontSize: 14 }}>Verifying your API key and fetching balance</div>
      </div>
    );
  }

  const { success, account, balance, error: loginError } = props;

  if (!success) {
    return (
      <div
        style={{
          fontFamily: 'system-ui, sans-serif',
          padding: 24,
          maxWidth: 480,
          borderRadius: 12,
          border: '1px solid #fecaca',
          background: '#fef2f2',
        }}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#dc2626', fontWeight: 700 }}>
          Kalshi Login Failed
        </h3>
        <p style={{ margin: 0, fontSize: 14, color: '#7f1d1d' }}>{loginError}</p>
        <div style={{ marginTop: 12, fontSize: 12, color: '#991b1b' }}>
          Make sure your API Key ID and RSA private key are correct. Get them from{' '}
          <strong>kalshi.com &gt; Settings &gt; API Keys</strong>.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        maxWidth: 480,
        borderRadius: 12,
        border: '1px solid #bbf7d0',
        background: '#f0fdf4',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 24 }}>&#x2705;</span>
        <h3 style={{ margin: 0, fontSize: 18, color: '#166534', fontWeight: 700 }}>
          Kalshi Connected
        </h3>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>
            Account
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1e3a8a' }}>
            {account}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>
            Balance
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#166534' }}>
            {balance}
          </div>
        </div>
      </div>

      <button
        disabled={loading}
        onClick={() => viewPortfolio({ platform: 'kalshi' })}
        style={{
          padding: '10px 20px',
          borderRadius: 8,
          border: 'none',
          background: '#2563eb',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Loading...' : 'View Kalshi Portfolio'}
      </button>
    </div>
  );
}
