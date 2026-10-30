module.exports = (err, _req, res, _next) => {
  if (res.headersSent) return;
  const status = err.status || (err.name === 'ValidationError' ? 400 : 500);
  const code = err.code && typeof err.code === 'string' ? err.code : (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR');
  const message = status === 500 ? 'An unexpected error occurred' : err.message;
  if (status === 500) console.error(err);
  res.status(status).json({ error: { code, message } });
};
