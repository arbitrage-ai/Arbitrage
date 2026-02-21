export function getSessionId(ctx) {
    const anyCtx = ctx;
    if (typeof anyCtx?.session?.sessionId === 'string' &&
        anyCtx.session.sessionId.length > 0) {
        return anyCtx.session.sessionId;
    }
    if (typeof anyCtx?.sessionId === 'string' && anyCtx.sessionId.length > 0) {
        return anyCtx.sessionId;
    }
    return 'default';
}
