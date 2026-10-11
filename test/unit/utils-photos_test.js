const { photoUrl, PHOTO_SIZES } = require('../../utils/photos');

/**
 * Listing photos are stored at full size, often 12 megapixels straight off a
 * phone. photoUrl asks Cloudinary for a copy sized for where the photo is
 * shown, so a 400×180 card doesn't download a 3 MB original.
 */
const PHOTO = 'https://res.cloudinary.com/dvzx6pt8h/image/upload/v1770578503/8e809005409b08f232583a0a935c0641.jpg';

test('asks Cloudinary for a card-sized copy', () => {
    expect(photoUrl(PHOTO, 'card')).toBe(
        'https://res.cloudinary.com/dvzx6pt8h/image/upload/c_limit,w_800,f_auto,q_auto/v1770578503/8e809005409b08f232583a0a935c0641.jpg'
    );
});

test.each(Object.entries(PHOTO_SIZES))('puts the %s size right after /upload/', (size, transformation) => {
    expect(photoUrl(PHOTO, size)).toBe(PHOTO.replace('/upload/', `/upload/${transformation}/`));
});

// Only Cloudinary understands these transformations
test('leaves other addresses alone', () => {
    expect(photoUrl('/images/avatarPlaceholder.svg', 'card')).toBe('/images/avatarPlaceholder.svg');
    expect(photoUrl('https://example.com/image/upload/photo.jpg', 'card')).toBe('https://example.com/image/upload/photo.jpg');
});

test('copes with a missing photo', () => {
    expect(photoUrl(undefined, 'card')).toBe('');
    expect(photoUrl('', 'card')).toBe('');
});

// A typo in a template should fail loudly in the tests, not ship a full-size photo
test('refuses a size it does not know', () => {
    expect(() => photoUrl(PHOTO, 'huge')).toThrow('Unknown photo size: huge');
});
