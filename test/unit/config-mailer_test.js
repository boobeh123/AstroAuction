jest.mock('nodemailer');

const nodemailer = require('nodemailer');
const {
    sendOutbidEmail,
    sendAuctionWonEmail,
    sendAuctionEndedSellerEmail,
    sendVerificationEmail,
    sendPasswordResetEmail,
} = require('../../config/mailer');

/**
 * Listing titles and display names are typed by users, and they end up in
 * emails sent from the AstroAuction address. Left unescaped, a seller could
 * title a listing with a working link or a fake button and have it delivered
 * to every bidder, looking like it came from AstroAuction itself.
 */
const HOSTILE_TITLE = '<a href="https://phish.example">Claim your refund</a>';
const HOSTILE_NAME = '<img src="https://phish.example/pixel.gif">Kai';

const recipient = { email: 'bidder@example.com' };
const hostileListing = {
    _id: '507f1f77bcf86cd799439011',
    title: HOSTILE_TITLE,
    currentBid: 120,
};

let sendMail;

beforeEach(() => {
    jest.clearAllMocks();
    sendMail = jest.fn().mockResolvedValue({});
    nodemailer.createTransport.mockReturnValue({ sendMail });
});

function sentMessage() {
    expect(sendMail).toHaveBeenCalledTimes(1);
    return sendMail.mock.calls[0][0];
}

describe('listing titles are escaped in email HTML', () => {
    test.each([
        ['outbid', () => sendOutbidEmail(recipient, hostileListing, 130)],
        ['auction won', () => sendAuctionWonEmail(recipient, hostileListing)],
        ['auction ended', () => sendAuctionEndedSellerEmail(recipient, hostileListing, 'Kai')],
    ])('the %s email shows the title as text, not as a link', async (_name, send) => {
        await send();

        const { html } = sentMessage();
        expect(html).not.toContain('<a href="https://phish.example"');
        expect(html).toContain('&lt;a href=&quot;');
    });
});

describe('display names are escaped in email HTML', () => {
    test('the auction ended email shows the winner name as text', async () => {
        await sendAuctionEndedSellerEmail(
            recipient,
            { ...hostileListing, title: 'Vintage lamp' },
            HOSTILE_NAME
        );

        const { html } = sentMessage();
        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;img src=&quot;');
    });
});

describe('subject lines', () => {
    // Subjects are plain text, not HTML, so escaping them would show readers
    // literal "&lt;" sequences. They keep the title exactly as written.
    test('keep the title exactly as written', async () => {
        await sendOutbidEmail(recipient, hostileListing, 130);

        expect(sentMessage().subject).toBe(`You've been outbid on "${HOSTILE_TITLE}"`);
    });
});

describe('account emails', () => {
    const APP_URL = 'https://astroauction.up.railway.app';
    const TOKEN = '0123456789abcdef0123456789abcdef01234567';
    const originalAppUrl = process.env.APP_URL;

    beforeEach(() => {
        process.env.APP_URL = APP_URL;
    });

    afterAll(() => {
        if (originalAppUrl === undefined) {
            delete process.env.APP_URL;
        } else {
            process.env.APP_URL = originalAppUrl;
        }
    });

    test('the verification email links to /verify/<token> on APP_URL', async () => {
        await sendVerificationEmail(recipient, TOKEN);

        const { to, subject, html } = sentMessage();
        expect(to).toBe(recipient.email);
        expect(subject).toBe('Welcome to Astro Auction - Please verify your email');
        expect(html).toContain(`href="${APP_URL}/verify/${TOKEN}"`);
    });

    // The old welcome email said "you contacted Astro Auction via our
    // website", left over from a contact form. It now gives the real reason.
    test('the verification email says it was sent because of a signup', async () => {
        await sendVerificationEmail(recipient, TOKEN);

        const { html } = sentMessage();
        expect(html).toContain('signed up for Astro Auction with this email address');
        expect(html).not.toContain('contacted');
    });

    test('the password reset email links to /recover/<token> on APP_URL', async () => {
        await sendPasswordResetEmail(recipient, TOKEN);

        const { to, subject, html } = sentMessage();
        expect(to).toBe(recipient.email);
        expect(subject).toBe('Astro Auction — Password Reset Request');
        expect(html).toContain(`href="${APP_URL}/recover/${TOKEN}"`);
    });
});

describe('sender', () => {
    const originalEmailName = process.env.EMAIL_NAME;

    afterAll(() => {
        if (originalEmailName === undefined) {
            delete process.env.EMAIL_NAME;
        } else {
            process.env.EMAIL_NAME = originalEmailName;
        }
    });

    // Bid emails used to come from the bare address while account emails
    // showed "Astro Auction". Every email now uses the same sender name.
    test.each([
        ['verification', () => sendVerificationEmail(recipient, 'token')],
        ['password reset', () => sendPasswordResetEmail(recipient, 'token')],
        ['outbid', () => sendOutbidEmail(recipient, hostileListing, 130)],
        ['auction won', () => sendAuctionWonEmail(recipient, hostileListing)],
        ['auction ended', () => sendAuctionEndedSellerEmail(recipient, hostileListing, null)],
    ])('the %s email comes from "Astro Auction"', async (_name, send) => {
        process.env.EMAIL_NAME = 'astroauction@example.com';

        await send();

        expect(sentMessage().from).toEqual({ name: 'Astro Auction', address: 'astroauction@example.com' });
    });
});
