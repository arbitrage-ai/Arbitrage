import React from 'react';
import { useWidget, useCallTool } from 'mcp-use/react';

interface Props {
  success: boolean;
  platform: string;
  address?: string;
  error?: string;
}

export default function LoginPolymarket() {
  const { props, isPending } = useWidget<Props>();
  const { callTool: viewPortfolio, isPending: loading } = useCallTool('get_portfolio');

  if (isPending) {
    return (
      <div style={{ padding: 32, textAlign: 'center', fontFamily: 'system-ui' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>Connecting to Polymarket...</div>
        <div style={{ color: '#64748b', fontSize: 14 }}>Deriving L2 API credentials from wallet signature</div>
      </div>
    );
  }

  const { success, address, error: loginError } = props;

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
          Polymarket Login Failed
        </h3>
        <p style={{ margin: 0, fontSize: 14, color: '#7f1d1d' }}>{loginError}</p>
        <div style={{ marginTop: 12, fontSize: 12, color: '#991b1b' }}>
          Make sure your Ethereum private key is correct. If using a proxy wallet, also provide the funder address from{' '}
          <strong>polymarket.com/settings</strong>.
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
        border: '1px solid #e9d5ff',
        background: '#faf5ff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 24 }}>&#x2705;</span>
        <h3 style={{ margin: 0, fontSize: 18, color: '#4c1d95', fontWeight: 700 }}>
          Polymarket Connected
        </h3>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>
          Wallet Address
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#7e22ce',
            wordBreak: 'break-all',
            fontFamily: 'monospace',
          }}
        >
          {address}
        </div>
      </div>

      <button
        disabled={loading}
        onClick={() => viewPortfolio({ platform: 'polymarket' })}
        style={{
          padding: '10px 20px',
          borderRadius: 8,
          border: 'none',
          background: '#7c3aed',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Loading...' : 'View Polymarket Portfolio'}
      </button>
    </div>
  );
}
