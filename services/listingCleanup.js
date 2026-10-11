const mongoose = require('mongoose');
const Auction = require('../model/Auction');
const Comment = require('../model/Comment');
const Bid = require('../model/Bid');
const cloudinary = require('../config/cloudinary');
const { clearHighlightCache } = require('./highlightCache');

/**
 * Deletes listings along with everything that belongs to them: their photos
 * in Cloudinary, their comments and their bid history.
 *
 * Takes the listings themselves (each needs _id and cloudinaryIds), so the
 * caller decides which ones: deleting a listing passes one, deleting an
 * account passes all of that user's.
 *
 * A photo that fails to delete is logged rather than stopping the rest, the
 * same as before: a leftover file in Cloudinary is better than a listing
 * nobody can remove. The listings themselves go last, so if a step fails
 * part-way, they're still there to try again.
 */
async function deleteListings(listings) {
    if (listings.length === 0) return;

    const photoIds = listings.flatMap((listing) => listing.cloudinaryIds || []);
    await Promise.all(
        photoIds.map((id) =>
            cloudinary.uploader.destroy(id).catch((destroyErr) => {
                console.error('Failed to remove Cloudinary asset:', destroyErr.message);
            })
        )
    );

    // trusted(): this $in is the app's own, so the sanitizeFilter guard in
    // config/database.js lets it through
    const listingIds = listings.map((listing) => listing._id);
    await Comment.deleteMany({ auction: mongoose.trusted({ $in: listingIds }) });
    await Bid.deleteMany({ auction: mongoose.trusted({ $in: listingIds }) });
    await Auction.deleteMany({ _id: mongoose.trusted({ $in: listingIds }) });

    // One of them may have been in the spotlight banner
    clearHighlightCache();
}

module.exports = { deleteListings };
