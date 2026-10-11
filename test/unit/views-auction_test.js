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

function renderPage(overrides = {}) {
    return ejs.renderFile(VIEW, {
        listings: LISTINGS,
        totalListings: LISTINGS.length,
        currentPage: 1,
        pageCount: 1,
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
        ...overrides,
    });
}

describe('pages of listings', () => {
    test('the count shows every listing, not just this page', async () => {
        const html = await renderPage({ totalListings: 60, currentPage: 2, pageCount: 3 });

        expect(html).toMatch(/60 total\s+listings/);
    });

    test('a middle page links to the pages before and after it', async () => {
        const html = await renderPage({ totalListings: 60, currentPage: 2, pageCount: 3 });

        expect(html).toContain('href="/auction?page=1"');
        expect(html).toContain('href="/auction?page=3"');
        expect(html).toContain('Page 2 of 3');
    });

    test('the first page has no Previous link, and the last page no Next link', async () => {
        const first = await renderPage({ totalListings: 60, currentPage: 1, pageCount: 3 });
        const last = await renderPage({ totalListings: 60, currentPage: 3, pageCount: 3 });

        expect(first).not.toContain('rel="prev"');
        expect(first).toContain('href="/auction?page=2"');
        expect(last).not.toContain('rel="next"');
        expect(last).toContain('href="/auction?page=2"');
    });

    test('a single page has no page links at all', async () => {
        const html = await renderPage();

        expect(html).not.toContain('class="pagination"');
    });
});

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
