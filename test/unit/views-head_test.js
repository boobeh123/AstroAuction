const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

/**
 * The <head> every page shares, rendered from the real partial.
 */
const VIEW = path.join(__dirname, '../../views/partials/head.ejs');
const VIEWS_DIR = path.join(__dirname, '../../views');

const renderHead = (data = {}) => ejs.renderFile(VIEW, data);

// The title is what a browser tab, a bookmark and a screen reader announce
// first, so each page names itself
describe('page titles', () => {
    test('a page title comes first, then the site name', async () => {
        const html = await renderHead({ pageTitle: 'Log in' });

        expect(html).toContain('<title>Log in | Astro Auction</title>');
    });

    test('the home page is just the site name', async () => {
        const html = await renderHead();

        expect(html).toContain('<title>Astro Auction</title>');
    });

    // Listing titles are typed by users
    test('a title is escaped', async () => {
        const html = await renderHead({ pageTitle: '<b>Lamp</b>' });

        expect(html).toContain('<title>&lt;b&gt;Lamp&lt;/b&gt; | Astro Auction</title>');
    });

    test('every page except the home page passes its own title', () => {
        const pages = [
            ...fs.readdirSync(VIEWS_DIR).filter((file) => file.endsWith('.ejs')),
            ...fs.readdirSync(path.join(VIEWS_DIR, 'errors')).map((file) => `errors/${file}`),
        ].filter((file) => file !== 'index.ejs');

        const missing = pages.filter((file) => {
            const source = fs.readFileSync(path.join(VIEWS_DIR, file), 'utf8');
            return !/include\('[./]*partials\/head\.ejs', \{ pageTitle: /.test(source);
        });

        expect(missing).toEqual([]);
    });
});

// No page uses Material Icons, so loading the font only cost a request
test("doesn't load the unused Material Icons font", async () => {
    const html = await renderHead();

    expect(html).not.toContain('Material+Icons');
});

// If cdnjs ever served a different file, the browser would refuse it
test('loads Font Awesome with an integrity check', async () => {
    const html = await renderHead();

    expect(html).toMatch(/font-awesome\/6\.4\.0\/css\/all\.min\.css" integrity="sha512-iecdLmaskl7CVkqkXNQ\/ZH\/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT\/E0iPtmFIB46ZmdtAc9eNBvH0H\/ZpiBw==" crossorigin="anonymous" referrerpolicy="no-referrer">/);
});
