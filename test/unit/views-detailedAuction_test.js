const path = require('path');
const ejs = require('ejs');
const { formatMoney } = require('../../utils/bidding');

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

function renderListingPage(comments) {
    return ejs.renderFile(VIEW, {
        listing: LISTING,
        videoEmbedUrl: null,
        comments,
        bids: [],
        auctionLive: false,
        minNextBid: 0,
        formatMoney,
        user: null,
        currentPath: `/auction/viewAuction/${LISTING._id}`,
        success: [],
        error: [],
        errors: [],
        highlightedListing: null,
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

        expect(html).toContain('src="https://placeholder.pics/svg/100x100"');
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
