const nodemailer = require('nodemailer');

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

const appUrl = () => process.env.APP_URL || 'http://localhost:3000';

const listingUrl = (auctionId) => `${appUrl()}/auction/viewAuction/${auctionId}`;

const money = (value) => `$${Number(value).toFixed(2)}`;

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

const sendOutbidEmail = async (user, listing, newAmount) => {
  const transporter = createTransporter();
  const url = listingUrl(listing._id);

  await transporter.sendMail({
    from: process.env.EMAIL_NAME,
    to: user.email,
    subject: `You've been outbid on "${listing.title}"`,
    html: shell("You've been outbid", `
      <p>Someone has placed a higher bid on <strong>${listing.title}</strong>.</p>
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
    from: process.env.EMAIL_NAME,
    to: user.email,
    subject: `You won "${listing.title}"`,
    html: shell('You won!', `
      <p>Congratulations — you had the winning bid on <strong>${listing.title}</strong>.</p>
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
    ? `<p>Winning bid: <strong>${money(listing.currentBid)}</strong> by <strong>${winnerName}</strong>.</p>
       <p>Reach out to arrange payment and pickup.</p>`
    : `<p>This auction ended without any bids.</p>
       <p>You may want to relist it at a lower starting price.</p>`;

  await transporter.sendMail({
    from: process.env.EMAIL_NAME,
    to: user.email,
    subject: `Your auction "${listing.title}" has ended`,
    html: shell('Your auction has ended', `
      <p>Bidding has closed on <strong>${listing.title}</strong>.</p>
      ${outcome}
      ${button(url, 'View listing')}
    `),
  });
};

module.exports = {
  createTransporter,
  sendOutbidEmail,
  sendAuctionWonEmail,
  sendAuctionEndedSellerEmail,
};
