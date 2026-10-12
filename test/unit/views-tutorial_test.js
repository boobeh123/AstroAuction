const path = require('path');
const ejs = require('ejs');

/**
 * The first-visit tutorial on the auction page, rendered from the real
 * partial. Its steps point at the Create Listing button and form, which
 * only exist once account setup is done. Before that, it found none of its
 * steps, skipped them all and marked itself as seen, so new users never
 * got it.
 */
const VIEW = path.join(__dirname, '../../views/partials/tutorial.ejs');

const renderTutorial = (user) => ejs.renderFile(VIEW, { user, currentPath: '/auction' });

test('waits until account setup is done', async () => {
    const html = await renderTutorial({ tutorialStep: 0, onboardingComplete: false });

    expect(html).not.toContain('id="tutorial-tooltip"');
});

test('shows once setup is done', async () => {
    const html = await renderTutorial({ tutorialStep: 0, onboardingComplete: true });

    expect(html).toContain('id="tutorial-tooltip"');
});

test('stays hidden once dismissed', async () => {
    const html = await renderTutorial({ tutorialStep: null, onboardingComplete: true });

    expect(html).not.toContain('id="tutorial-tooltip"');
});
