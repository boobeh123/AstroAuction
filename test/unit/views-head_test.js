const path = require('path');
const ejs = require('ejs');

/**
 * The <head> every page shares, rendered from the real partial.
 */
const VIEW = path.join(__dirname, '../../views/partials/head.ejs');

const renderHead = () => ejs.renderFile(VIEW, {});

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
