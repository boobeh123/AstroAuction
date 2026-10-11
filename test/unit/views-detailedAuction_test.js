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
});
