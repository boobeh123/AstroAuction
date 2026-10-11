const path = require('path');
const ejs = require('ejs');

/**
 * The navigation bar, rendered from the real partial. Log out is a button in
 * a small POST form, not a link: see routes-authRoutes_test.js for why.
 */
const VIEW = path.join(__dirname, '../../views/partials/navigation.ejs');

function renderNav(user, currentPath = '/profile') {
    return ejs.renderFile(VIEW, { user, currentPath, highlightedListing: null });
}

const LOGOUT_FORM = /<form action="\/logout" method="POST" class="logout-form">\s*<button type="submit" class="btn btn-secondary logout-button">Log out<\/button>\s*<\/form>/;

test.each([
    ['a logged-in user', { id: 'u1', displayName: 'Lani', onboardingComplete: true }],
    ['a user still setting up their account', { id: 'u2', displayName: '', onboardingComplete: false }],
])('Log out is a button that posts a form for %s', async (_label, user) => {
    const html = await renderNav(user);

    expect(html).toMatch(LOGOUT_FORM);
    expect(html).not.toContain('href="/logout"');
});

test('visitors get Log in and Create account, not Log out', async () => {
    const html = await renderNav(null);

    expect(html).toContain('href="/login"');
    expect(html).not.toContain('Log out');
});
