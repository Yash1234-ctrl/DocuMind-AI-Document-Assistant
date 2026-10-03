export function notFoundHandler(req, res) {
    res.status(404).json({ error: "Not found", requestId: req.id });
}

export function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);

    let status = Number(error.statusCode || error.status || 500);
    if (error.headers && Number.isInteger(error.status)) status = 502;
    if (error.name === "MulterError") status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    if (error.name === "CastError") status = 400;
    if (error.message === "Only PDF files are allowed") status = 415;
    if (error.message === "Origin not allowed") status = 403;
    if (!Number.isInteger(status) || status < 400 || status > 599) status = 500;

    console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        event: "request_failed",
        requestId: req.id,
        status,
        errorName: error.name,
        message: error.message,
        ...(process.env.NODE_ENV !== "production" ? { stack: error.stack } : {}),
    }));

    const message = status >= 500 ? "Internal server error" : error.message;
    res.status(status).json({ error: message, requestId: req.id });
}