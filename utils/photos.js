// Listing photos are stored at full size, often 12 megapixels straight off a
// phone. Cloudinary can resize on the fly: a transformation added to the
// address right after /upload/ returns a copy sized for where it's shown,
// made once and then cached. f_auto sends AVIF or WebP to browsers that
// support them, and q_auto picks a quality that looks the same as the
// original. The CSS still does any cropping, so photos look as they did.
const PHOTO_SIZES = {
    card: 'c_limit,w_800,f_auto,q_auto', //       listing cards, 180px tall
    main: 'c_limit,w_1600,f_auto,q_auto', //      the main photo on a listing page
    thumb: 'c_fill,w_160,h_160,f_auto,q_auto', // the small square thumbnails
    full: 'c_limit,w_2000,f_auto,q_auto', //      the photo viewer
};

const CLOUDINARY = 'https://res.cloudinary.com/';
const UPLOAD_PATH = '/image/upload/';

// The address of a copy of this photo sized for one of PHOTO_SIZES. Anything
// that isn't a Cloudinary upload is returned as it is.
function photoUrl(url, size) {
    const transformation = PHOTO_SIZES[size];
    if (!transformation) {
        throw new Error(`Unknown photo size: ${size}`);
    }
    if (!url) return '';
    if (!url.startsWith(CLOUDINARY) || !url.includes(UPLOAD_PATH)) return url;

    return url.replace(UPLOAD_PATH, `${UPLOAD_PATH}${transformation}/`);
}

module.exports = { photoUrl, PHOTO_SIZES };
