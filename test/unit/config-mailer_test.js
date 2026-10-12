jest.mock('nodemailer');

const nodemailer = require('nodemailer');
const {
    sendOutbidEmail,
    sendAuctionWonEmail,
    sendAuctionEndedSellerEmail,
    sendNewMessageEmail,
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
const seller = { displayName: 'Lani', email: 'lani@example.com' };
const winner = { displayName: 'Kai', email: 'kai@example.com' };
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
        ['auction won', () => sendAuctionWonEmail(recipient, hostileListing, seller)],
        ['auction ended', () => sendAuctionEndedSellerEmail(recipient, hostileListing, winner)],
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
            { ...winner, displayName: HOSTILE_NAME }
        );

        const { html } = sentMessage();
        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;img src=&quot;');
    });
});

describe('the winner and the seller can reach each other', () => {
    // The won email used to say "The seller can see your details", but the
    // seller only ever got the winner's display name
    test("the winner's email has the seller's name and a link to their address", async () => {
        await sendAuctionWonEmail(winner, hostileListing, seller);

        const { html } = sentMessage();
        expect(html).toContain('Contact the seller, <strong>Lani</strong>,');
        expect(html).toContain('<a href="mailto:lani@example.com">lani@example.com</a>');
        expect(html).not.toContain('can see your details');
    });

    test("the seller's email has the winner's name and a link to their address", async () => {
        await sendAuctionEndedSellerEmail(seller, hostileListing, winner);

        const { html } = sentMessage();
        expect(html).toContain('by <strong>Kai</strong>');
        expect(html).toContain('Contact the winner, <strong>Kai</strong>,');
        expect(html).toContain('<a href="mailto:kai@example.com">kai@example.com</a>');
    });

    // An account that never finished setup has no display name yet
    test('leaves the name out when there is none', async () => {
        await sendAuctionWonEmail(winner, hostileListing, { displayName: '', email: 'lani@example.com' });

        expect(sentMessage().html).toContain('Contact the seller at <a href="mailto:lani@example.com">');
    });

    // Bidding needs a verified email but not a finished profile. The seller's
    // email used to decide "sold" or "no bids" from the winner's name, so a
    // winner without one left the seller thinking nobody had bid.
    test("the seller's email still reports the sale when the winner has no name", async () => {
        await sendAuctionEndedSellerEmail(seller, hostileListing, { displayName: '', email: 'kai@example.com' });

        const { html } = sentMessage();
        expect(html).toContain('Winning bid:');
        expect(html).not.toContain('by <strong>');
        expect(html).toContain('Contact the winner at <a href="mailto:kai@example.com">');
        expect(html).not.toContain('without any bids');
    });

    test('says so when the other account no longer exists', async () => {
        await sendAuctionWonEmail(winner, hostileListing, null);

        const { html } = sentMessage();
        expect(html).toContain("The seller's account no longer exists");
        expect(html).not.toContain('mailto:');
    });
});

describe('the new message alert', () => {
    // Sent when the winner or the seller gets a message on the listing page.
    // It only says who wrote and where: the message stays on the site, and
    // nobody's address is in it.
    test('names the sender and the listing as text, and links to the conversation', async () => {
        await sendNewMessageEmail(recipient, hostileListing, HOSTILE_NAME);

        const { to, html } = sentMessage();
        expect(to).toBe('bidder@example.com');
        expect(html).not.toContain('<img');
        expect(html).not.toContain('<a href="https://phish.example"');
        expect(html).toContain('&lt;img src=&quot;');
        expect(html).toContain(`/auction/viewAuction/${hostileListing._id}#messages`);
    });

    // A reply would go to the store's inbox, not to the other person
    test("says replies to the email won't reach the sender, and shares no address", async () => {
        await sendNewMessageEmail(recipient, hostileListing, 'Kai');

        const { html } = sentMessage();
        expect(html).toContain("Replies to this email won't reach Kai");
        expect(html).not.toContain('mailto:');
        expect(html).not.toContain('@example.com');
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
        ['auction won', () => sendAuctionWonEmail(recipient, hostileListing, seller)],
        ['auction ended', () => sendAuctionEndedSellerEmail(recipient, hostileListing, null)],
    ])('the %s email comes from "Astro Auction"', async (_name, send) => {
        process.env.EMAIL_NAME = 'astroauction@example.com';

        await send();

        expect(sentMessage().from).toEqual({ name: 'Astro Auction', address: 'astroauction@example.com' });
    });
});
