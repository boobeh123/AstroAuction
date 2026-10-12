const path = require('path');
const ejs = require('ejs');
const { formatMoney, AMOUNT_LIMITS } = require('../../utils/bidding');
const { photoUrl } = require('../../utils/photos');

/**
 * Deleting an account removes the user but keeps their comments, so each of
 * those comments comes back with `user: null` after populate(). The template
 * used to read comment.user.image straight off it, which threw, and every
 * visitor to that listing got a 500 page instead of the listing.
 *
 * Bid history already showed "Removed user" for this case. These tests render
 * the real template to prove comments now do the same.
 */
const VIEW = path.join(__dirname, '../../views/detailedAuction.ejs');

const LISTING = {
    _id: '507f1f77bcf86cd799439011',
    title: 'Vintage lamp',
    description: 'Brass, works fine.',
    category: 'Antiques',
    saleType: 'fixed',
    price: 40,
    images: [],
    user: {
        _id: '507f1f77bcf86cd799439012',
        displayName: 'Seller',
        image: '',
        createdAt: new Date('2026-01-01'),
    },
    createdAt: new Date('2026-10-01'),
};

function renderListingPage(comments, overrides = {}) {
    return ejs.renderFile(VIEW, {
        listing: LISTING,
        videoEmbedUrl: null,
        comments,
        bids: [],
        auctionLive: false,
        minNextBid: 0,
        formatMoney,
        photoUrl,
        conversation: null,
        amountLimits: AMOUNT_LIMITS,
        user: null,
        currentPath: `/auction/viewAuction/${LISTING._id}`,
        success: [],
        error: [],
        errors: [],
        highlightedListing: null,
        ...overrides,
    });
}

function comment(user, body) {
    return { user, body, createdAt: new Date('2026-10-02') };
}

describe('comments from deleted accounts', () => {
    test('render as "Removed user" instead of crashing the page', async () => {
        const html = await renderListingPage([comment(null, 'Is this still available?')]);

        expect(html).toContain('Removed user');
        expect(html).toContain('Is this still available?');
    });

    test('get the placeholder avatar', async () => {
        const html = await renderListingPage([comment(null, 'Does it work?')]);

        expect(html).toContain('src="/images/avatarPlaceholder.svg"');
    });

    test('sit alongside comments from accounts that still exist', async () => {
        const html = await renderListingPage([
            comment(null, 'First!'),
            comment({ displayName: 'Kai', image: 'https://res.cloudinary.com/demo/kai.jpg' }, 'Second'),
        ]);

        expect(html).toContain('Removed user');
        expect(html).toContain('Kai');
        expect(html).toContain('https://res.cloudinary.com/demo/kai.jpg');
    });
});

test("the page title is the listing's title", async () => {
    const html = await renderListingPage([]);

    expect(html).toContain('<title>Vintage lamp | Astro Auction</title>');
});

describe('photo thumbnails', () => {
    // The first thumbnail is marked as the photo on show. The attribute used
    // to come out escaped, as aria-current=&#34;true&#34;, which isn't valid.
    test('mark the first photo with a real aria-current attribute', async () => {
        const html = await renderListingPage([], {
            listing: {
                ...LISTING,
                images: ['https://res.cloudinary.com/demo/a.jpg', 'https://res.cloudinary.com/demo/b.jpg'],
            },
        });

        expect(html).toContain('aria-current="true"');
        expect(html).not.toContain('&#34;');
    });
});

describe('photo sizes', () => {
    const PHOTOS = [
        'https://res.cloudinary.com/dvzx6pt8h/image/upload/v1770578503/8e809005409b08f232583a0a935c0641.jpg',
        'https://res.cloudinary.com/dvzx6pt8h/image/upload/v1770163513/548f208b862745f573157d606a81e311.png',
    ];
    const withPhotos = { ...LISTING, images: PHOTOS };

    test('the main photo and its thumbnails each load a copy sized for them', async () => {
        const html = await renderListingPage([], { listing: withPhotos });

        expect(html).toContain(`src="${photoUrl(PHOTOS[0], 'main')}"`);
        PHOTOS.forEach((photo) => {
            expect(html).toContain(`<img src="${photoUrl(photo, 'thumb')}" alt="">`);
            // Clicking a thumbnail swaps it into the main photo, so that's the size it asks for
            expect(html).toContain(`data-image-url="${photoUrl(photo, 'main')}"`);
        });
        expect(html).not.toMatch(/(src|data-image-url)="https:\/\/res\.cloudinary\.com\/dvzx6pt8h\/image\/upload\/v\d/);
    });

    // With a video, the photos sit in a strip and open in the photo viewer
    test('next to a video, the strip shows thumbnails and the viewer gets the large size', async () => {
        const html = await renderListingPage([], {
            listing: withPhotos,
            videoEmbedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        });

        PHOTOS.forEach((photo) => {
            expect(html).toContain(`data-image-url="${photoUrl(photo, 'full')}"`);
            expect(html).toContain(`src="${photoUrl(photo, 'thumb')}"`);
        });
    });
});

describe('the bid form on a live auction', () => {
    const LIVE_AUCTION = {
        ...LISTING,
        saleType: 'auction',
        price: null,
        startingPrice: 100,
        currentBid: null,
        bidCount: 0,
        status: 'open',
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
    };

    function renderAuctionFor(emailVerified) {
        return renderListingPage([], {
            listing: LIVE_AUCTION,
            auctionLive: true,
            minNextBid: 100,
            user: { id: '507f1f77bcf86cd799439099', emailVerified },
        });
    }

    test('a verified user gets the form, capped at the bid limit', async () => {
        const html = await renderAuctionFor(true);

        expect(html).toContain('class="bid-form"');
        expect(html).toContain('max="100000"');
    });

    // The server refuses their bid anyway. This tells them why before they try.
    test('an unverified user is asked to verify their email instead', async () => {
        const html = await renderAuctionFor(false);

        expect(html).not.toContain('class="bid-form"');
        expect(html).toContain('Verify your email to bid');
    });

    // Bidders are told up front how they'll reach the seller if they win
    test('the form says the winner and the seller can message each other', async () => {
        const html = await renderAuctionFor(true);

        expect(html).toContain('If you win, you and the seller can message each other on this page to arrange payment and pickup.');
        expect(html).not.toContain('email address');
    });
});

describe('messages once an auction ends', () => {
    // Only the winner and the seller get a conversation from the controller,
    // so only their page has the Messages card
    const WINNER = { id: '507f1f77bcf86cd799439099' };
    const SELLER_ID = LISTING.user._id;
    const ENDED = {
        ...LISTING,
        saleType: 'auction',
        price: null,
        startingPrice: 100,
        currentBid: 150,
        bidCount: 1,
        status: 'ended',
        endsAt: new Date(Date.now() - 60 * 60 * 1000),
    };

    function renderFor(user, conversation) {
        return renderListingPage([], { listing: ENDED, user, conversation });
    }

    function conversationWith(messages, other = { displayName: 'Lani' }) {
        return { otherRole: 'seller', other, messages };
    }

    test('the winner sees the conversation, with their own messages marked "You"', async () => {
        const html = await renderFor(WINNER, conversationWith([
            { body: 'Pickup Saturday?', sender: WINNER.id, createdAt: new Date('2026-10-12') },
            { body: 'Saturday works.', sender: SELLER_ID, createdAt: new Date('2026-10-12') },
        ]));

        expect(html).toContain('id="messages"');
        expect(html).toMatch(/You<\/span>[\s\S]*?Pickup Saturday\?/);
        expect(html).toMatch(/Lani<\/span>[\s\S]*?Saturday works\./);
    });

    test("the form sends the message to this listing's conversation", async () => {
        const html = await renderFor(WINNER, conversationWith([]));

        expect(html).toContain(`action="/auction/postMessage/${LISTING._id}"`);
        expect(html).toContain('<label for="message-body"');
        expect(html).toContain('No messages yet.');
    });

    test('a message is shown as text, not run as HTML', async () => {
        const html = await renderFor(WINNER, conversationWith([
            { body: '<img src=x onerror=alert(1)>', sender: SELLER_ID, createdAt: new Date() },
        ]));

        expect(html).not.toContain('<img src=x');
        expect(html).toContain('&lt;img src=x');
    });

    test('the "Auction ended" box links to the conversation, with no address', async () => {
        const html = await renderFor(WINNER, conversationWith([]));

        expect(html).toContain('<a href="#messages">Message the seller</a> to arrange payment and pickup.');
        expect(html).not.toContain('mailto:');
    });

    test('everyone else sees the result, but no link and no Messages card', async () => {
        const html = await renderFor({ id: '507f1f77bcf86cd799439098' }, null);

        expect(html).toContain('Won with a bid of');
        expect(html).not.toContain('#messages');
        expect(html).not.toContain('id="messages"');
        expect(html).not.toContain('postMessage');
    });

    test("when the other account is gone, there's a note and no form", async () => {
        const html = await renderFor(WINNER, conversationWith([], null));

        expect(html).toContain("The seller's account no longer exists, so you can't message them.");
        expect(html).not.toContain('postMessage');
    });
});
