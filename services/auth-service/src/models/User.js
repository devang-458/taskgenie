import mongoose from "mongoose";
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import validator from "validator";
import crypto from "crypto";


const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Invaild email address"],
    },
    username: {
      type: String,
      required: true,
      unique: true,
      mixlength: 3,
      maxlength: 30,
      validate: {
        validator: function (v) {
          return /^[a-zA-Z0-9_]+$/.test(v);
        },
        message: "Username can only contain letters, numbers, and underscores",
      },
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    avatar: {
      type: String,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    passwordResetToken: String,
    passwordResetExpires: Date,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,
    lastLogin: Date,
    preferences: {
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "system",
      },
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        taskDeadlines: { type: Boolean, default: true },
        collaborationUpdates: { type: Boolean, default: true },
      },
      aiAssistance: {
        autoSuggestions: { type: Boolean, default: true },
        smartPrioritization: { type: Boolean, default: true },
        contextualHelp: { type: Boolean, default: true },
      },
    },
    subscription: {
      type: String,
      createdAt: { type: Date, default: Date.now },
      expiresAt: Date,
      deviceInfo: String,
    },
    refreshTokens: [
      {
        token: String,
        createdAt: { type: Date, default: Date.now },
        expiresAt: Date,
        deviceInfo: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Virtual for account lock status
userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const saltRound = parseInt(process.env.BCRYPT_ROUND) || 12;
    this.password = await bcrypt.hash(this.password, saltRound);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePasswprd = async function (candidatePassword) {
  if (this.isLocked) {
    throw new Error(
      "Account is temporarily locked due to too many failed login attempts"
    );
  }
  const isMatch = await bcrypt.compare(candidatePassword, this.password);

  if (!isMatch) {
    this.loginAttempts += 1;

    // Lock account after 5 failed attempts for 2 hours
    if (this.loginAttempts >= 5) {
      this.lockUntil = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
    }

    await this.save();
    throw new Error("Invalid credentials");
  }

  // Reset login attempts on successful login
  if (this.loginAttempts > 0) {
    this.loginAttempts = 0;
    this.lockUntil = undefined;
  }

  this.lastLogin = new Date();
  await this.save();

  return true;
};

// Generate JWT tokens
userSchema.methods.generateTokens = function () {
  const payload = {
    userId: this._id,
    email: this.email,
    username: this.username,
  };

  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET || "dev-jwt-secret-key",
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
  );

  const refreshToken = jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-key",
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.emailVerificationToken = token;
  return token;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = token;
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return token;
};

const User = mongoose.model("User", userSchema);

export default User

