module.exports = (error, req, res, next) => {
  console.error('Auth Service Error:', error);
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};
