const nodemailer = require('nodemailer');
const validator = require('validator');

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_NAME,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Every email shows the same sender name in the recipient's inbox.
const sender = () => ({ name: 'Astro Auction', address: process.env.EMAIL_NAME });

// Every link in an email starts from APP_URL, never from the request's Host
// header, which whoever sends the request controls. A trailing slash is
// dropped so a link can't come out as "//verify/...", which no route matches.
const appUrl = () => {
  const url = process.env.APP_URL || 'http://localhost:3000';
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

const listingUrl = (auctionId) => `${appUrl()}/auction/viewAuction/${auctionId}`;
const verifyUrl = (token) => `${appUrl()}/verify/${token}`;
const resetUrl = (token) => `${appUrl()}/recover/${token}`;

const money = (value) => `$${Number(value).toFixed(2)}`;

// Listing titles and display names are typed by users. Escaping them keeps a
// title like <a href="...">Claim your refund</a> from turning into a real
// link inside an email sent from the AstroAuction address. Subject lines are
// plain text, not HTML, so they use the raw value.
const escapeHtml = (value) => validator.escape(String(value));

const shell = (heading, bodyHtml) => `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
    <h2 style="color: #6d28d9; margin-top: 0;">${heading}</h2>
    ${bodyHtml}
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
    <p style="font-size: 12px; color: #888;">AstroAuction — Wahiawa, HI</p>
  </div>
`;

const button = (href, label) => `
  <p style="margin: 24px 0;">
    <a href="${href}" style="background: #6d28d9; color: #ffffff; padding: 12px 22px; border-radius: 6px; text-decoration: none; display: inline-block;">${label}</a>
  </p>
`;

// The small print explaining why someone received an account email.
const footnote = (text) => `
  <p style="font-size: 13px; color: #666;">${text}</p>
`;

const sendOutbidEmail = async (user, listing, newAmount) => {
  const transporter = createTransporter();
  const url = listingUrl(listing._id);

  await transporter.sendMail({
    from: sender(),
    to: user.email,
    subject: `You've been outbid on "${listing.title}"`,
    html: shell("You've been outbid", `
      <p>Someone has placed a higher bid on <strong>${escapeHtml(listing.title)}</strong>.</p>
      <p>The bid is now <strong>${money(newAmount)}</strong>.</p>
      <p>There's still time to bid again if you want it.</p>
      ${button(url, 'View listing')}
    `),
  });
};

const sendAuctionWonEmail = async (user, listing) => {
  const transporter = createTransporter();
  const url = listingUrl(listing._id);

  await transporter.sendMail({
    from: sender(),
    to: user.email,
    subject: `You won "${listing.title}"`,
    html: shell('You won!', `
      <p>Congratulations — you had the winning bid on <strong>${escapeHtml(listing.title)}</strong>.</p>
      <p>Winning bid: <strong>${money(listing.currentBid)}</strong></p>
      <p>The seller can see your details and should be in touch to arrange payment and pickup.</p>
      ${button(url, 'View listing')}
    `),
  });
};

const sendAuctionEndedSellerEmail = async (user, listing, winnerName) => {
  const transporter = createTransporter();
  const url = listingUrl(listing._id);

  const outcome = winnerName
    ? `<p>Winning bid: <strong>${money(listing.currentBid)}</strong> by <strong>${escapeHtml(winnerName)}</strong>.</p>
       <p>Reach out to arrange payment and pickup.</p>`
    : `<p>This auction ended without any bids.</p>
       <p>You may want to relist it at a lower starting price.</p>`;

  await transporter.sendMail({
    from: sender(),
    to: user.email,
    subject: `Your auction "${listing.title}" has ended`,
    html: shell('Your auction has ended', `
      <p>Bidding has closed on <strong>${escapeHtml(listing.title)}</strong>.</p>
      ${outcome}
      ${button(url, 'View listing')}
    `),
  });
};

// Sent at signup, and again when someone presses Resend on their profile.
const sendVerificationEmail = async (user, token) => {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: sender(),
    to: user.email,
    subject: 'Welcome to Astro Auction - Please verify your email',
    html: shell('Welcome to Astro Auction', `
      <p>Thanks for joining our local marketplace community!</p>
      <p>Please confirm your email address with the button below. The link expires in 1 hour.</p>
      ${button(verifyUrl(token), 'Verify my email')}
      ${footnote("You're receiving this because someone signed up for Astro Auction with this email address. If that wasn't you, you can ignore this email.")}
    `),
  });
};

const sendPasswordResetEmail = async (user, token) => {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: sender(),
    to: user.email,
    subject: 'Astro Auction — Password Reset Request',
    html: shell('Reset your password', `
      <p>We received a request to reset the password for your Astro Auction account.</p>
      <p>Use the button below to choose a new password. The link expires in 1 hour.</p>
      ${button(resetUrl(token), 'Reset my password')}
      ${footnote("If you didn't ask to reset your password, you can ignore this email. Your password won't change.")}
    `),
  });
};

module.exports = {
  createTransporter,
  sendOutbidEmail,
  sendAuctionWonEmail,
  sendAuctionEndedSellerEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
