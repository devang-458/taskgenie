export function extractUser(req, res, next) {
  req.user = {
    userId: req.headers['x-user-id'],
    email: req.headers['x-user-email'],
    username: req.headers['x-user-username']
  };
  
  if (!req.user.userId) {
    return res.status(401).json({ success: false, error: 'User authentication required' });
  }
  next();
};
