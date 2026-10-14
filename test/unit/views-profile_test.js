const path = require('path');
const ejs = require('ejs');
const { formatDate } = require('../../utils/dates');

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

function renderProfile(user = USER) {
    return ejs.renderFile(VIEW, {
        user,
        formatDate,
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

test('without a profile photo, the page shows the local placeholder avatar', async () => {
    const html = await renderProfile();

    expect(html).toMatch(/id="profile-picture" src="\/images\/avatarPlaceholder\.svg"/);
});

// The same two types the server accepts (middleware/multer.js)
test('the photo picker only offers JPG and PNG files', async () => {
    const html = await renderProfile();

    expect(html).toMatch(/id="profile-file"[^>]*accept="image\/jpeg,image\/png"/);
});

// Railway runs the server in UTC, where 3 AM on Jan 1 would already be 2026.
// In Hawaii it's still the evening of Dec 31.
test('"Member since" shows the Hawaii date', async () => {
    const html = await renderProfile({ ...USER, createdAt: new Date('2026-01-01T03:00:00Z') });

    expect(html).toContain('December 31, 2025');
});
