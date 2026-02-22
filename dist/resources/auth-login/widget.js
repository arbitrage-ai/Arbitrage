import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
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
const LoadingSpinner = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", style: { animation: 'spin 0.8s linear infinite' }, children: [_jsx("path", { d: "M21 12a9 9 0 1 1-6.219-8.56" }), _jsx("style", { children: `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    ` })] }));
function PlatformLoginCard({ platform, isAuthenticated, userInfo }) {
    // Kalshi fields
    const [kalshiApiKey, setKalshiApiKey] = useState('');
    const [kalshiPem, setKalshiPem] = useState('');
    // Polymarket fields
    const [polyPrivateKey, setPolyPrivateKey] = useState('');
    const [polyApiKey, setPolyApiKey] = useState('');
    const [polySecret, setPolySecret] = useState('');
    const [polyPassphrase, setPolyPassphrase] = useState('');
    const [polyFunderAddress, setPolyFunderAddress] = useState('');
    const [isFocused, setIsFocused] = useState(null);
    const { callTool: loginKalshi, isPending: kalshiPending, isSuccess: kalshiSuccess, isError: kalshiError } = useCallTool('kalshi_login');
    const { callTool: loginPolymarket, isPending: polymarketPending, isSuccess: polymarketSuccess, isError: polymarketError } = useCallTool('polymarket_login_with_api_key');
    const colors = COLORS[platform];
    const isPending = platform === 'kalshi' ? kalshiPending : polymarketPending;
    const isSuccess = platform === 'kalshi' ? kalshiSuccess : polymarketSuccess;
    const isError = platform === 'kalshi' ? kalshiError : polymarketError;
    const handleLogin = () => {
        if (platform === 'kalshi' && kalshiApiKey && kalshiPem) {
            loginKalshi({ api_key: kalshiApiKey, pem: kalshiPem });
        }
        else if (platform === 'polymarket' && polyPrivateKey && polyApiKey && polySecret && polyPassphrase && polyFunderAddress) {
            loginPolymarket({
                private_key: polyPrivateKey,
                api_key: polyApiKey,
                secret: polySecret,
                passphrase: polyPassphrase,
                funder_address: polyFunderAddress
            });
        }
    };
    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleLogin();
        }
    };
    const inputStyle = (name) => ({
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
    return (_jsxs("div", { style: {
            flex: 1,
            minWidth: 320,
            maxWidth: 400,
            background: '#FFFFFF',
            border: `2px solid ${isAuthenticated ? COLORS.success.primary : colors.border}`,
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s ease',
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: {
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    background: colors.bg,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 16,
                                    fontWeight: 700,
                                    color: colors.primary,
                                }, children: platform === 'kalshi' ? 'K' : 'P' }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 16, fontWeight: 700, color: COLORS.neutral[900], lineHeight: 1.2 }, children: platform === 'kalshi' ? 'Kalshi' : 'Polymarket' }), _jsx("div", { style: { fontSize: 12, color: COLORS.neutral[500], lineHeight: 1.2 }, children: platform === 'kalshi' ? 'Event Contracts' : 'Prediction Market' })] })] }), isAuthenticated && (_jsxs("div", { style: {
                            background: COLORS.success.bg,
                            color: COLORS.success.text,
                            borderRadius: 20,
                            padding: '4px 12px',
                            fontSize: 11,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            border: `1px solid ${COLORS.success.border}`,
                        }, children: [_jsx("span", { style: { width: 6, height: 6, borderRadius: '50%', background: COLORS.success.primary } }), "Connected"] }))] }), isAuthenticated ? (_jsxs("div", { style: { padding: '16px 0' }, children: [_jsxs("div", { style: { marginBottom: 16 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: COLORS.neutral[500], marginBottom: 8 }, children: platform === 'kalshi' ? 'User ID' : 'Wallet Address' }), _jsx("div", { style: {
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: COLORS.neutral[900],
                                    fontFamily: 'ui-monospace, monospace',
                                    padding: 12,
                                    background: COLORS.neutral[50],
                                    borderRadius: 8,
                                    wordBreak: 'break-all',
                                    border: `1px solid ${COLORS.neutral[200]}`,
                                }, children: userInfo?.id || (userInfo?.address ? `${userInfo.address.slice(0, 8)}...${userInfo.address.slice(-6)}` : '—') })] }), userInfo?.balance && (_jsxs("div", { children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: COLORS.neutral[500], marginBottom: 8 }, children: "Balance" }), _jsx("div", { style: { fontSize: 28, fontWeight: 700, color: colors.primary, lineHeight: 1 }, children: userInfo.balance })] }))] })) : (_jsxs("div", { children: [platform === 'kalshi' ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: { marginBottom: 16 }, children: [_jsx("label", { style: { fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 8 }, children: "API Key" }), _jsx("input", { type: "password", value: kalshiApiKey, onChange: (e) => setKalshiApiKey(e.target.value), onFocus: () => setIsFocused('kalshi-api-key'), onBlur: () => setIsFocused(null), onKeyPress: handleKeyPress, placeholder: "Enter your API key", style: inputStyle('kalshi-api-key') })] }), _jsxs("div", { style: { marginBottom: 20 }, children: [_jsx("label", { style: { fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 8 }, children: "PEM Certificate" }), _jsx("textarea", { value: kalshiPem, onChange: (e) => setKalshiPem(e.target.value), onFocus: () => setIsFocused('kalshi-pem'), onBlur: () => setIsFocused(null), placeholder: "Enter your PEM certificate", rows: 4, style: {
                                            ...inputStyle('kalshi-pem'),
                                            resize: 'vertical',
                                            fontFamily: 'ui-monospace, monospace',
                                            fontSize: 12,
                                        } })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: { marginBottom: 16 }, children: [_jsx("label", { style: { fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 8 }, children: "Private Key" }), _jsx("input", { type: "password", value: polyPrivateKey, onChange: (e) => setPolyPrivateKey(e.target.value), onFocus: () => setIsFocused('poly-private-key'), onBlur: () => setIsFocused(null), onKeyPress: handleKeyPress, placeholder: "Enter your private key", style: inputStyle('poly-private-key') })] }), _jsxs("div", { style: { marginBottom: 16 }, children: [_jsx("label", { style: { fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 8 }, children: "API Key" }), _jsx("input", { type: "password", value: polyApiKey, onChange: (e) => setPolyApiKey(e.target.value), onFocus: () => setIsFocused('poly-api-key'), onBlur: () => setIsFocused(null), onKeyPress: handleKeyPress, placeholder: "Enter your API key", style: inputStyle('poly-api-key') })] }), _jsxs("div", { style: { marginBottom: 16 }, children: [_jsx("label", { style: { fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 8 }, children: "Secret" }), _jsx("input", { type: "password", value: polySecret, onChange: (e) => setPolySecret(e.target.value), onFocus: () => setIsFocused('poly-secret'), onBlur: () => setIsFocused(null), onKeyPress: handleKeyPress, placeholder: "Enter your secret", style: inputStyle('poly-secret') })] }), _jsxs("div", { style: { marginBottom: 16 }, children: [_jsx("label", { style: { fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 8 }, children: "Passphrase" }), _jsx("input", { type: "password", value: polyPassphrase, onChange: (e) => setPolyPassphrase(e.target.value), onFocus: () => setIsFocused('poly-passphrase'), onBlur: () => setIsFocused(null), onKeyPress: handleKeyPress, placeholder: "Enter your passphrase", style: inputStyle('poly-passphrase') })] }), _jsxs("div", { style: { marginBottom: 20 }, children: [_jsx("label", { style: { fontSize: 13, fontWeight: 600, color: COLORS.neutral[700], display: 'block', marginBottom: 8 }, children: "Funder Address" }), _jsx("input", { type: "text", value: polyFunderAddress, onChange: (e) => setPolyFunderAddress(e.target.value), onFocus: () => setIsFocused('poly-funder-address'), onBlur: () => setIsFocused(null), onKeyPress: handleKeyPress, placeholder: "0x...", style: {
                                            ...inputStyle('poly-funder-address'),
                                            fontFamily: 'ui-monospace, monospace',
                                        } })] })] })), _jsxs("button", { onClick: handleLogin, disabled: isPending || (platform === 'kalshi' ? !kalshiApiKey || !kalshiPem : !polyPrivateKey || !polyApiKey || !polySecret || !polyPassphrase || !polyFunderAddress), style: {
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
                        }, onMouseEnter: (e) => {
                            if (!isPending && (platform === 'kalshi' ? kalshiApiKey && kalshiPem : polyPrivateKey && polyApiKey && polySecret && polyPassphrase && polyFunderAddress)) {
                                e.currentTarget.style.background = colors.primaryDark;
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)';
                            }
                        }, onMouseLeave: (e) => {
                            if (!isPending && (platform === 'kalshi' ? kalshiApiKey && kalshiPem : polyPrivateKey && polyApiKey && polySecret && polyPassphrase && polyFunderAddress)) {
                                e.currentTarget.style.background = colors.primary;
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                            }
                        }, children: [isPending && _jsx(LoadingSpinner, {}), isPending ? 'Connecting...' : 'Connect Account'] }), isSuccess && (_jsxs("div", { style: {
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
                        }, children: [_jsx("span", { style: { fontSize: 16 }, children: "\u2713" }), "Successfully connected!"] })), isError && (_jsxs("div", { style: {
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
                        }, children: [_jsx("span", { style: { fontSize: 16 }, children: "\u26A0" }), "Connection failed. Please check your credentials."] }))] }))] }));
}
export default function AuthLogin() {
    const { props } = useWidget({});
    const authStatus = props.auth_status;
    return (_jsx("div", { style: {
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            minHeight: '100vh',
            background: `linear-gradient(to bottom, ${COLORS.neutral[50]}, ${COLORS.neutral[100]})`,
            padding: '32px 24px',
        }, children: _jsxs("div", { style: { maxWidth: 900, margin: '0 auto' }, children: [_jsxs("div", { style: { marginBottom: 32, textAlign: 'center' }, children: [_jsx("h1", { style: { margin: 0, fontSize: 32, fontWeight: 800, color: COLORS.neutral[900], lineHeight: 1.2, marginBottom: 8 }, children: "Connect Your Accounts" }), _jsx("p", { style: { margin: 0, fontSize: 16, color: COLORS.neutral[600], lineHeight: 1.5 }, children: "Authenticate with Kalshi and Polymarket to start trading" })] }), _jsxs("div", { style: { display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }, children: [_jsx(PlatformLoginCard, { platform: "kalshi", isAuthenticated: authStatus?.kalshi?.authenticated || false, userInfo: {
                                id: authStatus?.kalshi?.user_id,
                                balance: authStatus?.kalshi?.balance,
                            } }), _jsx(PlatformLoginCard, { platform: "polymarket", isAuthenticated: authStatus?.polymarket?.authenticated || false, userInfo: {
                                address: authStatus?.polymarket?.address,
                                balance: authStatus?.polymarket?.balance,
                            } })] }), props.message && (_jsx("div", { style: {
                        maxWidth: 600,
                        margin: '0 auto 24px',
                        padding: '14px 18px',
                        background: COLORS.success.bg,
                        border: `1px solid ${COLORS.success.border}`,
                        borderRadius: 12,
                        fontSize: 14,
                        color: COLORS.success.text,
                        fontWeight: 500,
                    }, children: props.message })), _jsx("div", { style: {
                        maxWidth: 600,
                        margin: '0 auto',
                        padding: '16px 20px',
                        background: '#FFFFFF',
                        border: `2px solid ${COLORS.neutral[200]}`,
                        borderRadius: 12,
                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                    }, children: _jsxs("div", { children: [_jsx("div", { style: { fontSize: 14, fontWeight: 700, color: COLORS.neutral[900], marginBottom: 6 }, children: "Data Storage" }), _jsx("div", { style: { fontSize: 13, color: COLORS.neutral[600], lineHeight: 1.6 }, children: "Your data is stored securely on Kalshi and Polymarket platforms." })] }) })] }) }));
}
