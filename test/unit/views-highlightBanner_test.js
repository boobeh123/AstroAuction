const path = require('path');
const ejs = require('ejs');
const { formatMoney } = require('../../utils/bidding');

/**
 * The spotlight banner scrolls two copies of the same link so the loop looks
 * seamless. The second copy is only decoration: screen readers should skip it
 * and the Tab key shouldn't stop on it.
 *
 * Its attributes used to come out escaped (aria-hidden=&#34;true&#34;), which
 * browsers don't read as true or -1, so the link was announced and focused
 * twice.
 */
const VIEW = path.join(__dirname, '../../views/partials/highlightBanner.ejs');

const SPOTLIGHT = {
    _id: '507f1f77bcf86cd799439011',
    title: 'Koa rocking chair',
    saleType: 'fixed',
    price: 250,
};

function renderBanner() {
    return ejs.renderFile(VIEW, { highlightedListing: SPOTLIGHT, currentPath: '/', formatMoney });
}

test('the repeated link is hidden from screen readers and the Tab key', async () => {
    const html = await renderBanner();

    expect(html).toContain('aria-hidden="true" tabindex="-1"');
    expect(html).not.toContain('&#34;');
});

test('only the repeated link is hidden', async () => {
    const html = await renderBanner();

    expect(html.match(/class="highlight-banner-content"/g)).toHaveLength(2);
    expect(html.match(/aria-hidden="true" tabindex="-1"/g)).toHaveLength(1);
});
