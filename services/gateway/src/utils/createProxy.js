import { createProxyMiddleware } from "http-proxy-middleware";

export const createProxy = (target, pathRewrite = {}) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    onProxyReq: (proxyReq, req, res) => {
      // Forward user information to services
      if (req.user) {
        proxyReq.setHeader("X-User-ID", req.user.userId);
        proxyReq.setHeader("X-User-Email", req.user.email);
        proxyReq.setHeader("X-User-Username", req.user.username);
      }

      // Forward original IP
      const originalIp = req.ip || req.connection.remoteAddress;
      proxyReq.setHeader("X-Forwarded-For", originalIp);
    },
    onError: (err, req, res) => {
      console.error("Proxy Error:", err.message);
      res.status(500).json({
        success: false,
        error: "Service temporarily unavailable",
      });
    },
  });
};
