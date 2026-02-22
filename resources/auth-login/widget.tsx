import React, { useState } from 'react';
import { useWidget, useCallTool } from 'mcp-use/react';
import { z } from 'zod';

const authStatusSchema = z.object({
  kalshi: z.object({
    authenticated: z.boolean(),
    user_id: z.string().optional(),
    balance: z.string().optional(),
  }).optional(),
  polymarket: z.object({
    authenticated: z.boolean(),
    address: z.string().optional(),
    balance: z.string().optional(),
  }).optional(),
});

const propSchema = z.object({
  auth_status: authStatusSchema.optional(),
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
  warning: {
    bg: '#FFFBEB',
    border: '#FDE68A',
    text: '#92400E',
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

function PlatformLoginCard({
  platform,
  isAuthenticated,
  userInfo
}: {
  platform: 'kalshi' | 'polymarket';
  isAuthenticated: boolean;
  userInfo?: { id?: string; address?: string; balance?: string };
}) {
  // Kalshi fields
  const [kalshiApiKey, setKalshiApiKey] = useState('');
  const [kalshiPem, setKalshiPem] = useState('');

  // Polymarket fields
  const [polyPrivateKey, setPolyPrivateKey] = useState('');
  const [polyApiKey, setPolyApiKey] = useState('');
  const [polySecret, setPolySecret] = useState('');
  const [polyPassphrase, setPolyPassphrase] = useState('');
  const [polyFunderAddress, setPolyFunderAddress] = useState('');

  const [isFocused, setIsFocused] = useState<string | null>(null);

  const { callTool: loginKalshi, isPending: kalshiPending, isSuccess: kalshiSuccess, isError: kalshiError } = useCallTool<{
    api_key: string;
    pem: string;
  }>('kalshi_login');

  const { callTool: loginPolymarket, isPending: polymarketPending, isSuccess: polymarketSuccess, isError: polymarketError } = useCallTool<{
    private_key: string;
    api_key: string;
    secret: string;
    passphrase: string;
    funder_address: string;
  }>('polymarket_login_with_api_key');

  const colors = COLORS[platform];
  const isPending = platform === 'kalshi' ? kalshiPending : polymarketPending;
  const isSuccess = platform === 'kalshi' ? kalshiSuccess : polymarketSuccess;
  const isError = platform === 'kalshi' ? kalshiError : polymarketError;

  const handleLogin = () => {
    if (platform === 'kalshi' && kalshiApiKey && kalshiPem) {
      loginKalshi({ api_key: kalshiApiKey, pem: kalshiPem });
    } else if (platform === 'polymarket' && polyPrivateKey && polyApiKey && polySecret && polyPassphrase && polyFunderAddress) {
      loginPolymarket({
        private_key: polyPrivateKey,
        api_key: polyApiKey,
        secret: polySecret,
        passphrase: polyPassphrase,
        funder_address: polyFunderAddress
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

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
        flex: 1,
        minWidth: 340,
        maxWidth: 450,
        background: '#FFFFFF',
        border: `2px solid ${isAuthenticated ? '#10b981' : '#e5e5e5'}`,
        borderRadius: 16,
        padding: 28,
        boxShadow: isAuthenticated ? '0 4px 12px rgba(16, 185, 129, 0.15)' : 'none',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: colors.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
              color: colors.primary,
            }}
          >
            {platform === 'kalshi' ? 'K' : 'P'}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111', lineHeight: 1.2 }}>
              {platform === 'kalshi' ? 'Kalshi' : 'Polymarket'}
            </div>
            <div style={{ fontSize: 12, color: '#888', lineHeight: 1.2, marginTop: 2 }}>
              {platform === 'kalshi' ? 'Event Contracts' : 'Prediction Market'}
            </div>
          </div>
        </div>
        {isAuthenticated && (
          <div
            style={{
              background: '#d1fae5',
              color: '#166534',
              borderRadius: 20,
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              border: `2px solid #10b981`,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
            Connected
          </div>
        )}
      </div>

      {/* Content */}
      {isAuthenticated ? (
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: COLORS.neutral[500], marginBottom: 8 }}>
              {platform === 'kalshi' ? 'User ID' : 'Wallet Address'}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: COLORS.neutral[900],
                fontFamily: 'ui-monospace, monospace',
                padding: 12,
                background: COLORS.neutral[50],
                borderRadius: 8,
                wordBreak: 'break-all',
                border: `1px solid ${COLORS.neutral[200]}`,
              }}
            >
              {userInfo?.id || (userInfo?.address ? `${userInfo.address.slice(0, 8)}...${userInfo.address.slice(-6)}` : '—')}
            </div>
          </div>
          {userInfo?.balance && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: COLORS.neutral[500], marginBottom: 8 }}>
                Balance
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: colors.primary, lineHeight: 1 }}>
                {userInfo.balance}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          {platform === 'kalshi' ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 8 }}>
                  API Key
                </label>
                <input
                  type="password"
                  value={kalshiApiKey}
                  onChange={(e) => setKalshiApiKey(e.target.value)}
                  onFocus={() => setIsFocused('kalshi-api-key')}
                  onBlur={() => setIsFocused(null)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your API key"
                  style={inputStyle('kalshi-api-key')}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 8 }}>
                  PEM Certificate
                </label>
                <textarea
                  value={kalshiPem}
                  onChange={(e) => setKalshiPem(e.target.value)}
                  onFocus={() => setIsFocused('kalshi-pem')}
                  onBlur={() => setIsFocused(null)}
                  placeholder="Enter your PEM certificate"
                  rows={4}
                  style={{
                    ...inputStyle('kalshi-pem'),
                    resize: 'vertical' as const,
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 12,
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 8 }}>
                  Private Key
                </label>
                <input
                  type="password"
                  value={polyPrivateKey}
                  onChange={(e) => setPolyPrivateKey(e.target.value)}
                  onFocus={() => setIsFocused('poly-private-key')}
                  onBlur={() => setIsFocused(null)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your private key"
                  style={inputStyle('poly-private-key')}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 8 }}>
                  API Key
                </label>
                <input
                  type="password"
                  value={polyApiKey}
                  onChange={(e) => setPolyApiKey(e.target.value)}
                  onFocus={() => setIsFocused('poly-api-key')}
                  onBlur={() => setIsFocused(null)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your API key"
                  style={inputStyle('poly-api-key')}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 8 }}>
                  Secret
                </label>
                <input
                  type="password"
                  value={polySecret}
                  onChange={(e) => setPolySecret(e.target.value)}
                  onFocus={() => setIsFocused('poly-secret')}
                  onBlur={() => setIsFocused(null)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your secret"
                  style={inputStyle('poly-secret')}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 8 }}>
                  Passphrase
                </label>
                <input
                  type="password"
                  value={polyPassphrase}
                  onChange={(e) => setPolyPassphrase(e.target.value)}
                  onFocus={() => setIsFocused('poly-passphrase')}
                  onBlur={() => setIsFocused(null)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your passphrase"
                  style={inputStyle('poly-passphrase')}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 8 }}>
                  Funder Address
                </label>
                <input
                  type="text"
                  value={polyFunderAddress}
                  onChange={(e) => setPolyFunderAddress(e.target.value)}
                  onFocus={() => setIsFocused('poly-funder-address')}
                  onBlur={() => setIsFocused(null)}
                  onKeyPress={handleKeyPress}
                  placeholder="0x..."
                  style={{
                    ...inputStyle('poly-funder-address'),
                    fontFamily: 'ui-monospace, monospace',
                  }}
                />
              </div>
            </>
          )}

          <button
            onClick={handleLogin}
            disabled={isPending || (platform === 'kalshi' ? !kalshiApiKey || !kalshiPem : !polyPrivateKey || !polyApiKey || !polySecret || !polyPassphrase || !polyFunderAddress)}
            style={{
              width: '100%',
              background: isPending || (platform === 'kalshi' ? !kalshiApiKey || !kalshiPem : !polyPrivateKey || !polyApiKey || !polySecret || !polyPassphrase || !polyFunderAddress) ? COLORS.neutral[300] : colors.primary,
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              padding: '12px 20px',
              fontSize: 15,
              fontWeight: 600,
              cursor: isPending || (platform === 'kalshi' ? !kalshiApiKey || !kalshiPem : !polyPrivateKey || !polyApiKey || !polySecret || !polyPassphrase || !polyFunderAddress) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: isPending || (platform === 'kalshi' ? !kalshiApiKey || !kalshiPem : !polyPrivateKey || !polyApiKey || !polySecret || !polyPassphrase || !polyFunderAddress) ? 'none' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            }}
            onMouseEnter={(e) => {
              if (!isPending && (platform === 'kalshi' ? kalshiApiKey && kalshiPem : polyPrivateKey && polyApiKey && polySecret && polyPassphrase && polyFunderAddress)) {
                e.currentTarget.style.background = colors.primaryDark;
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isPending && (platform === 'kalshi' ? kalshiApiKey && kalshiPem : polyPrivateKey && polyApiKey && polySecret && polyPassphrase && polyFunderAddress)) {
                e.currentTarget.style.background = colors.primary;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
              }
            }}
          >
            {isPending && <LoadingSpinner />}
            {isPending ? 'Connecting...' : 'Connect Account'}
          </button>

          {isSuccess && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 14px',
                background: COLORS.success.bg,
                border: `1px solid ${COLORS.success.border}`,
                borderRadius: 8,
                fontSize: 13,
                color: COLORS.success.text,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 16 }}>✓</span>
              Successfully connected!
            </div>
          )}
          {isError && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 14px',
                background: COLORS.error.bg,
                border: `1px solid ${COLORS.error.border}`,
                borderRadius: 8,
                fontSize: 13,
                color: COLORS.error.text,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 16 }}>⚠</span>
              Connection failed. Please check your credentials.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AuthLogin() {
  const { props } = useWidget<Props>({});
  const authStatus = props.auth_status;

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        minHeight: '100vh',
        background: '#fafafa',
        padding: '40px 24px',
      }}
    >
      <div style={{ maxWidth: 950, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 700, color: '#111', lineHeight: 1.2, marginBottom: 10, letterSpacing: '-0.02em' }}>
            Connect Your Accounts
          </h1>
          <p style={{ margin: 0, fontSize: 16, color: '#666', lineHeight: 1.5 }}>
            Authenticate with Kalshi and Polymarket to start trading
          </p>
        </div>

        {/* Login Cards */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 28 }}>
          <PlatformLoginCard
            platform="kalshi"
            isAuthenticated={authStatus?.kalshi?.authenticated || false}
            userInfo={{
              id: authStatus?.kalshi?.user_id,
              balance: authStatus?.kalshi?.balance,
            }}
          />
          <PlatformLoginCard
            platform="polymarket"
            isAuthenticated={authStatus?.polymarket?.authenticated || false}
            userInfo={{
              address: authStatus?.polymarket?.address,
              balance: authStatus?.polymarket?.balance,
            }}
          />
        </div>

        {/* Messages */}
        {props.message && (
          <div
            style={{
              maxWidth: 650,
              margin: '0 auto 20px',
              padding: '16px 20px',
              background: '#fff',
              border: `2px solid #86efac`,
              borderRadius: 12,
              fontSize: 14,
              color: '#166534',
              fontWeight: 500,
            }}
          >
            {props.message}
          </div>
        )}

        {/* Data Storage Notice */}
        <div
          style={{
            maxWidth: 650,
            margin: '0 auto',
            padding: '18px 22px',
            background: '#FFFFFF',
            border: `1px solid #e5e5e5`,
            borderRadius: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 6 }}>
              Data Storage
            </div>
            <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
              Your data is stored securely on Kalshi and Polymarket platforms.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
