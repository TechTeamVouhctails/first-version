import rateLimit from "express-rate-limit";

export const otpRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: "OTP_RATE_LIMITED",
    message: "Too many OTP attempts. Try again later."
  }
});

export const criticalActionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: "ACTION_RATE_LIMITED",
    message: "Too many requests. Try again shortly."
  }
});
