jest.mock('nodemailer');

const nodemailer = require('nodemailer');
const {
    sendOutbidEmail,
    sendAuctionWonEmail,
    sendAuctionEndedSellerEmail,
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
