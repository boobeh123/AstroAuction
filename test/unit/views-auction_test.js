const path = require('path');
const ejs = require('ejs');
const {
    formatMoney,
    isAuctionLive,
    AMOUNT_LIMITS,
    INCREMENT_LIMITS,
    DURATION_CHOICES,
} = require('../../utils/bidding');
const { isHighlighted } = require('../../utils/highlight');

/**
 * The listings page and its Create Listing form, rendered from the real
 * template.
 */
const VIEW = path.join(__dirname, '../../views/auction.ejs');

const LISTINGS = [
    { _id: '507f1f77bcf86cd799439011', title: 'Koa bowl', category: 'Art', saleType: 'fixed', price: 25, images: [], user: null },
    { _id: '507f1f77bcf86cd799439012', title: 'Brass lamp', category: 'Antiques', saleType: 'fixed', price: 40, images: [], user: null },
];

// The Create Listing form is only on the page for accounts that finished
// onboarding
const SELLER = { id: '507f1f77bcf86cd799439099', displayName: 'Kai', onboardingComplete: true, emailVerified: true };

function renderPage() {
    return ejs.renderFile(VIEW, {
        listings: LISTINGS,
        formatMoney,
        isAuctionLive,
        isHighlighted,
        durationChoices: DURATION_CHOICES,
        amountLimits: AMOUNT_LIMITS,
        incrementLimits: INCREMENT_LIMITS,
        user: SELLER,
        currentPath: '/auction',
        success: [],
        error: [],
        errors: [],
        highlightedListing: null,
    });
}

// Listings come from .lean() queries, which have _id but no id. Every card
// used to get id="listing-", so the page repeated the same id.
test('each listing card gets an id from its own _id', async () => {
    const html = await renderPage();

    expect(html).toContain('id="listing-507f1f77bcf86cd799439011"');
    expect(html).toContain('id="listing-507f1f77bcf86cd799439012"');
    expect(html).not.toContain('id="listing-"');
});

test('the money inputs use the same limits as the server', async () => {
    const html = await renderPage();

    expect(html).toMatch(/id="modal-price-input"[^>]*min="1" max="100000"/);
    expect(html).toMatch(/id="modal-starting-price-input"[^>]*min="1" max="100000"/);
    expect(html).toMatch(/id="modal-increment-input"[^>]*min="0.5" max="1000"/);
});

test('the video link and photo inputs have labels', async () => {
    const html = await renderPage();

    expect(html).toContain('<label for="video-url-input"');
    expect(html).toContain('<label for="modal-file-input"');
});
