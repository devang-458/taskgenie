import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"TaskGenie" <${process.env.BREVO_SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
};

export const emailService = {
  async sendVerificationEmail(user, token) {
    const html = `
      <h2>Email Verification</h2>
      <p>Hello ${user.name},</p>
      <p>Click the link below to verify your email address:</p>
      <a href="http://localhost:3000/verify-email?token=${token}">Verify Email</a>
    `;
    return sendEmail({
      to: user.email,
      subject: "Verify Your Email - TaskGenie",
      html,
    });
  },

  async sendPasswordResetEmail(user, token) {
    const html = `
      <h2>Reset Your Password</h2>
      <p>Hello ${user.name},</p>
      <p>Click the link below to reset your password:</p>
      <a href="http://localhost:3000/reset-password?token=${token}">Reset Password</a>
    `;
    return sendEmail({
      to: user.email,
      subject: "Password Reset - TaskGenie",
      html,
    });
  },
};


