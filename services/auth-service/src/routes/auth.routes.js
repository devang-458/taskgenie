import express from "express";
import bcrypt from "bcryptjs";
import validator from "validator";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import authLimiter from "../middleware/rateLimiter.js";
import { validateRegistration } from "../middleware/validators.js";
import { emailService } from "../utils/emailService.js";

const router = express.Router();

// Register
router.post(
  "/register",
  authLimiter,
  validateRegistration,
  async (req, res) => {
    try {
      const { email, username, password, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email: email.toLowerCase() }, { username }],
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error:
            existingUser.email === email.toLowerCase()
              ? "Email already registered"
              : "Username already taken",
        });
      }

      // Create new user
      const user = new User({
        email: email.toLowerCase(),
        username,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      // Generate email verification token
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();

      // Send verification email
      await emailService.sendVerificationEmail(user, verificationToken);

      // Generate tokens
      const { accessToken, refreshToken } = user.generateTokens();

      // Store refresh token
      user.refreshTokens.push({
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        deviceInfo: req.headers["user-agent"] || "Unknown device",
      });
      await user.save();

      res.status(201).json({
        success: true,
        message:
          "Registration successful. Please check your email to verify your account.",
        data: {
          user: {
            id: user._id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            isEmailVerified: user.isEmailVerified,
            subscription: user.subscription,
            preferences: user.preferences,
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: 15 * 60, // 15 minutes in seconds
          },
        },
      });
    } catch (error) {
      console.error("Registration error:", error);

      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(409).json({
          success: false,
          error: `${
            field.charAt(0).toUpperCase() + field.slice(1)
          } already taken`,
        });
      }

      res.status(500).json({
        success: false,
        error: "Registration failed. Please try again.",
      });
    }
  }
);

// Login
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    // Find user
    const user = await User.findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    // Verify password
    await user.comparePassword(password);

    // Generate tokens
    const { accessToken, refreshToken } = user.generateTokens();

    // Store refresh token
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      deviceInfo: req.headers["user-agent"] || "Unknown device",
    });

    // Clean up old refresh tokens (keep only last 5)
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }

    await user.save();

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          isEmailVerified: user.isEmailVerified,
          subscription: user.subscription,
          preferences: user.preferences,
          lastLogin: user.lastLogin,
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 15 * 60, // 15 minutes in seconds
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    if (
      error.message === "Invalid credentials" ||
      error.message.includes("Account is temporarily locked")
    ) {
      return res.status(401).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Login failed. Please try again.",
    });
  }
});

// Refresh token
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: "Refresh token required",
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-key"
    );

    // Find user and verify refresh token exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid refresh token",
      });
    }

    const tokenIndex = user.refreshTokens.findIndex(
      (t) => t.token === refreshToken
    );
    if (tokenIndex === -1) {
      return res.status(401).json({
        success: false,
        error: "Refresh token not found",
      });
    }

    // Check if refresh token is expired
    if (user.refreshTokens[tokenIndex].expiresAt < new Date()) {
      user.refreshTokens.splice(tokenIndex, 1);
      await user.save();

      return res.status(401).json({
        success: false,
        error: "Refresh token expired",
      });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } =
      user.generateTokens();

    // Replace old refresh token with new one
    user.refreshTokens[tokenIndex] = {
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deviceInfo: req.headers["user-agent"] || "Unknown device",
    };

    await user.save();

    res.json({
      success: true,
      data: {
        tokens: {
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn: 15 * 60,
        },
      },
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(401).json({
      success: false,
      error: "Invalid refresh token",
    });
  }
});

// Logout
router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Find user by refresh token
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-key"
      );

      const user = await User.findById(decoded.userId);
      if (user) {
        // Remove the specific refresh token
        user.refreshTokens = user.refreshTokens.filter(
          (t) => t.token !== refreshToken
        );
        await user.save();
      }
    }

    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    // Still return success even if token cleanup fails
    res.json({
      success: true,
      message: "Logout successful",
    });
  }
});

// Verify email
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Verification token required",
      });
    }

    const user = await User.findOne({ emailVerificationToken: token });
    if (!user) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired verification token",
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      error: "Email verification failed",
    });
  }
});

// Forgot password
router.post("/forgot-password", authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        error: "Valid email address required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration
    const successResponse = {
      success: true,
      message:
        "If an account with that email exists, a password reset link has been sent.",
    };

    if (!user) {
      return res.json(successResponse);
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save();

    await emailService.sendPasswordResetEmail(user, resetToken);

    res.json(successResponse);
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      error: "Password reset request failed",
    });
  }
});

// Reset password
router.post("/reset-password", authLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Reset token and new password required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters long",
      });
    }

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired reset token",
      });
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;

    // Invalidate all refresh tokens
    user.refreshTokens = [];

    await user.save();

    res.json({
      success: true,
      message:
        "Password reset successful. Please log in with your new password.",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({
      success: false,
      error: "Password reset failed",
    });
  }
});

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    data: {
      service: "auth-service",
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error("Auth Service Error:", error);

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
});

// 404 handler
router.use(/(.*)/,(req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

export default router;
