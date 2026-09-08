const upload = require('../../middleware/multer');

/**
 * multer() returns its configuration on the instance, so these tests exercise
 * the real fileFilter and the real limits rather than a copy. If someone edits
 * middleware/multer.js, these fail — which is the point.
 */
function runFilter(originalname, mimetype) {
    return new Promise((resolve) => {
        upload.fileFilter(
            {},
            { originalname, mimetype },
            (err, accepted) => resolve({ err, accepted })
        );
    });
}

describe('upload limits', () => {
    test('a per-file size cap is configured', () => {
        expect(upload.limits).toBeDefined();
        expect(typeof upload.limits.fileSize).toBe('number');
        expect(upload.limits.fileSize).toBeGreaterThan(0);
    });

    // Not asserting an exact byte count — that's a tuning decision, not a
    // correctness one, and hard-coding it means this test fails every time
    // the limit is legitimately adjusted. What matters is that a cap exists
    // and is in a sane range for phone photos.
    test('the cap is large enough for a phone photo and small enough to bound abuse', () => {
        const mb = upload.limits.fileSize / (1024 * 1024);
        expect(mb).toBeGreaterThanOrEqual(5);
        expect(mb).toBeLessThanOrEqual(50);
    });
});

describe('fileFilter', () => {
    test('accepts jpg, jpeg and png', async () => {
        for (const name of ['photo.jpg', 'photo.jpeg']) {
            const { err, accepted } = await runFilter(name, 'image/jpeg');
            expect(err).toBeNull();
            expect(accepted).toBe(true);
        }

        const png = await runFilter('photo.png', 'image/png');
        expect(png.err).toBeNull();
        expect(png.accepted).toBe(true);
    });

    test('accepts uppercase extensions', async () => {
        // Phones and cameras frequently produce .JPG. Before the extension
        // check was lowercased, these were rejected outright.
        const { err, accepted } = await runFilter('IMG_0421.JPG', 'image/jpeg');
        expect(err).toBeNull();
        expect(accepted).toBe(true);
    });

    test('rejects a disallowed extension', async () => {
        const { err, accepted } = await runFilter('notes.pdf', 'application/pdf');
        expect(err).toBeInstanceOf(Error);
        expect(accepted).toBe(false);
    });

    // The two-part check matters: extension alone is trivially renameable.
    // A .exe renamed to .jpg passes the extension test but carries the wrong
    // mimetype, and a real image renamed to .txt has the right mimetype but
    // the wrong extension. Both must be refused.
    test('rejects an executable renamed to look like an image', async () => {
        const { err, accepted } = await runFilter('payload.jpg', 'application/x-msdownload');
        expect(err).toBeInstanceOf(Error);
        expect(accepted).toBe(false);
    });

    test('rejects an image mimetype with a disallowed extension', async () => {
        const { err, accepted } = await runFilter('sneaky.txt', 'image/jpeg');
        expect(err).toBeInstanceOf(Error);
        expect(accepted).toBe(false);
    });

    test('rejects gif and webp, which Cloudinary handling does not expect', async () => {
        const gif = await runFilter('animation.gif', 'image/gif');
        expect(gif.accepted).toBe(false);

        const webp = await runFilter('photo.webp', 'image/webp');
        expect(webp.accepted).toBe(false);
    });

    test('rejects a file with no extension', async () => {
        const { err, accepted } = await runFilter('README', 'image/jpeg');
        expect(err).toBeInstanceOf(Error);
        expect(accepted).toBe(false);
    });

    // A double extension is a classic bypass attempt: some servers key off
    // the first extension they see. path.extname reads the last one, so this
    // is correctly treated as .jpg — but only the mimetype check stops it
    // being an actual executable.
    test('reads the final extension on a double-extension filename', async () => {
        const asImage = await runFilter('photo.php.jpg', 'image/jpeg');
        expect(asImage.accepted).toBe(true);

        const asScript = await runFilter('photo.jpg.php', 'application/x-php');
        expect(asScript.accepted).toBe(false);
    });
});
