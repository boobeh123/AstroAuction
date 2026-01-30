const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.SERVICE_TYPE,
    port: process.env.SERVICE_PORT,
    secure: process.env.SERVICE_SECURE,
    auth: {
      user: process.env.EMAIL_NAME,
      pass: process.env.EMAIL_PASSWORD
    },
    tls: { rejectUnauthorized: false }
  });
};

module.exports = { createTransporter }; 