export class AppError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}
export function check(condition, message) {
    if (!condition) throw new AppError(400, message);
}
export function deviceCode(value) {
    check(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value), 'Invalid device_code');
    return value;
}
export function timestamp(value, field) {
    check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), `Invalid ${field}: ISO timestamp with timezone required`);
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    check(month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate(), `Invalid ${field}`);
    return value;
}
export function relayBody(body) {
    check(body?.relay_number === 1 && typeof body.state === 'boolean', 'relay_number must be 1 and state must be boolean');
    return body;
}
export function uuid(value) {
    check(typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value), 'Invalid command_id');
    return value;
}
