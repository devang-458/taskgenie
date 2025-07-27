// Validation middleware
export const validateRegistration = (req, res, next) => {
  const { email, username, password, firstName, lastName } = req.body;
  const errors = [];

  if (!email || !validator.isEmail(email)) {
    errors.push({ field: "email", message: "Valid email is required" });
  }

  if (!username || username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push({
      field: "username",
      message:
        "Username must be 3+ characters and contain only letters, numbers, and underscores",
    });
  }

  if (!password || password.length < 8) {
    errors.push({
      field: "password",
      message: "Password must be at least 8 characters long",
    });
  }

  if (!firstName || firstName.trim().length === 0) {
    errors.push({ field: "firstName", message: "First name is required" });
  }

  if (!lastName || lastName.trim().length === 0) {
    errors.push({ field: "lastName", message: "Last name is required" });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      validationErrors: errors,
    });
  }

  next();
};


