export const errorHandler = (logger) => (error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = error.status || 500;
    let message = error.message;
    if (error.code === '23505') { status = 409; message = 'Device code or topic already exists'; }
    if (error.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON body'; }
    if (status >= 500) {
        logger.error({ event: 'http_error', code: error.code || 'INTERNAL_ERROR', method: req.method });
        message = 'Service temporarily unavailable';
    }
    res.status(status).json({ success: false, message });
};
