const path = require('path');
const ejs = require('ejs');

/**
 * The profile page, rendered from the real template.
 */
const VIEW = path.join(__dirname, '../../views/profile.ejs');

const USER = {
    _id: '507f1f77bcf86cd799439013',
    email: 'lani@example.com',
    displayName: 'Lani',
    image: '',
    emailVerified: true,
    onboardingComplete: true,
    createdAt: new Date('2026-01-01'),
};

function renderProfile() {
    return ejs.renderFile(VIEW, {
        user: USER,
        currentPath: '/profile',
        success: [],
        error: [],
        errors: [],
        highlightedListing: null,
    });
}

// Deleting the account deletes its listings too, so the confirmation has to
// say so before anyone presses OK
test('the Delete Profile confirmation warns that listings are deleted too', async () => {
    const html = await renderProfile();

    expect(html).toMatch(/data-confirm="[^"]*listings[^"]*"/);
});
