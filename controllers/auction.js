const mongoose = require('mongoose')
const Auction = require('../models/Auction')
const Comment = require('../models/Comment')
const Bid = require('../models/Bid')
const cloudinary = require("../middleware/cloudinary");
const fs = require('fs/promises');
const { closeAuctionIfDue } = require('../services/auctionCloser');
const { sendOutbidEmail } = require('../config/mailer');
const {
    round2,
    parseMoney,
    minimumNextBid,
    isAuctionLive,
    formatMoney,
    DURATION_CHOICES,
} = require('../utils/bidding');
const { isHighlighted, HIGHLIGHT_DURATION_MS } = require('../utils/highlight');

// Handles youtube.com/watch?v=, youtu.be/, and youtube.com/embed/ links,
// with or without extra query params (timestamps, playlists, etc).
// Returns null if the URL doesn't contain a recognizable video ID, so the
// template can cleanly skip rendering an embed for anything malformed.
function extractYouTubeId(url) {
    if (typeof url !== 'string') return null;
    const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
    return match ? match[1] : null;
}

// Removes the temp files multer wrote to disk. Called from a finally block so
// it runs whether the request succeeded, failed validation, or threw.
async function cleanupTempUploads(files) {
    if (!files || files.length === 0) return;
    await Promise.all(
        files.map((file) =>
            fs.unlink(file.path).catch((unlinkErr) => {
                console.error('Failed to remove temp upload:', unlinkErr.message);
            })
        )
    );
}

module.exports = {

    getAuction: async (req, res) => {
        try {
            const listings = await Auction.find({}).sort({ createdAt: -1 }).populate('user', 'image displayName').lean();
            res.render('auction.ejs', {
                listings: listings,
                formatMoney: formatMoney,
                isAuctionLive: isAuctionLive,
                isHighlighted: isHighlighted,
                durationChoices: DURATION_CHOICES,
            });
        } catch(err) {
            console.error(err)
            res.status(500).render('errors/500.ejs');
        }
    },

    postAuction: async (req, res) => {

        try {
            // Validation runs before the Cloudinary upload, not after.
            // Uploading first and validating second means a rejected listing
            // leaves its images sitting in Cloudinary with no database row
            // pointing at them — orphaned files nothing will ever clean up.
            const saleType = req.body.saleType === 'auction' ? 'auction' : 'fixed';
            const saleFields = {};

            if (saleType === 'auction') {
                const startingPrice = parseMoney(req.body.startingPrice);
                const minIncrement = parseMoney(req.body.minIncrement) || 1;
                const durationDays = Number.parseInt(req.body.durationDays, 10);

                if (startingPrice === null) {
                    req.flash('errors', { msg: 'Enter a valid starting price for your auction.' });
                    return res.redirect('/auction');
                }

                if (!DURATION_CHOICES.includes(durationDays)) {
                    req.flash('errors', { msg: 'Choose a valid auction duration.' });
                    return res.redirect('/auction');
                }

                const endsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

                saleFields.saleType = 'auction';
                saleFields.startingPrice = startingPrice;
                saleFields.minIncrement = minIncrement;
                saleFields.endsAt = endsAt;
                saleFields.status = 'open';
                saleFields.currentBid = null;
                saleFields.currentBidder = null;
                saleFields.bidCount = 0;
            } else {
                const price = parseMoney(req.body.price);

                if (price === null) {
                    req.flash('errors', { msg: 'Enter a valid price for your listing.' });
                    return res.redirect('/auction');
                }

                saleFields.saleType = 'fixed';
                saleFields.price = price;
            }

            let images = [];
            let cloudinaryIds = [];

            if (req.files && req.files.length > 0) {
                const uploadResults = await Promise.all(
                    req.files.map((file) =>
                        cloudinary.uploader.upload(file.path, {
                            use_filename: true,
                            unique_filename: false,
                            overwrite: true
                        })
                    )
                );

                images = uploadResults.map((result) => result.secure_url);
                cloudinaryIds = uploadResults.map((result) => result.public_id);
            }

            await Auction.create({
                    title: req.body.title,
                    description: req.body.description,
                    images: images,
                    video: req.body.video,
                    user: req.user.id,
                    cloudinaryIds: cloudinaryIds,
                    category: req.body.category,
                    ...saleFields,
                })

                console.log('Listing has been added!')
                res.redirect('/auction')
            } catch(err) {
                console.error(err)
                res.status(500).render('errors/500.ejs');
            } finally {
                await cleanupTempUploads(req.files);
            }
        },

        deleteAuction: async (req, res) => {

            try {
                if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                    return res.status(404).render('errors/404.ejs');
                }

                const listing = await Auction.findById(req.params.id);

                if (!listing) {
                    return res.status(404).render('errors/404.ejs');
                }
                
                if (listing.user.toString() !== req.user.id) {
                    req.flash('error', 'You can only delete your own listings');
                    return res.status(403).render('errors/403.ejs');
                }

                if (listing.cloudinaryIds && listing.cloudinaryIds.length > 0) {
                    await Promise.all(
                        listing.cloudinaryIds.map((id) =>
                            cloudinary.uploader.destroy(id).catch((destroyErr) => {
                                console.error('Failed to remove Cloudinary asset:', destroyErr.message);
                            })
                        )
                    );
                }

                await Auction.findByIdAndDelete(req.params.id)
                await Comment.deleteMany({ auction: req.params.id })
                await Bid.deleteMany({ auction: req.params.id })
                console.log('Deleted listing')
                res.redirect('/auction')
                
            } catch(err) {
                console.error(err)
                res.status(500).render('errors/500.ejs');
            }

        },

        getDetailedAuction: async (req, res) => {
            try {
                if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                    return res.status(404).render('errors/404.ejs');
                }

                let listing = await Auction.findById(req.params.id).populate('user', 'image displayName createdAt').lean();

                if (!listing) {
                    return res.status(404).render('errors/404.ejs');
                }

                // Second closing layer, behind the interval sweeper. If the
                // sweeper is dead, mid-restart, or simply hasn't come round
                // yet, this guarantees the page never shows an expired auction
                // as still open and still taking bids. The condition means the
                // extra write only happens on the rare view of an auction that
                // has just run out — every other page view skips it entirely.
                if (listing.saleType === 'auction'
                    && listing.status === 'open'
                    && listing.endsAt
                    && new Date(listing.endsAt) <= new Date()) {

                    const closed = await closeAuctionIfDue(req.params.id).catch((err) => {
                        console.error('Lazy auction close failed:', err.message);
                        return null;
                    });

                    if (closed) {
                        listing = await Auction.findById(req.params.id).populate('user', 'image displayName createdAt').lean();
                        if (!listing) {
                            return res.status(404).render('errors/404.ejs');
                        }
                    }
                }

                const youtubeId = extractYouTubeId(listing.video);
                const videoEmbedUrl = youtubeId ? `https://www.youtube-nocookie.com/embed/${youtubeId}` : null;

                const comments = await Comment.find({ auction: req.params.id })
                    .sort({ createdAt: 1 })
                    .populate('user', 'displayName image')
                    .lean();

                // Bid history is only meaningful for auctions, so the query is
                // skipped entirely for fixed-price listings.
                const bids = listing.saleType === 'auction'
                    ? await Bid.find({ auction: req.params.id })
                        .sort({ createdAt: -1 })
                        .limit(10)
                        .populate('user', 'displayName image')
                        .lean()
                    : [];

                res.render('detailedAuction.ejs', {
                    listing: listing,
                    videoEmbedUrl: videoEmbedUrl,
                    comments: comments,
                    bids: bids,
                    auctionLive: isAuctionLive(listing),
                    minNextBid: minimumNextBid(listing),
                    formatMoney: formatMoney,
                });

            } catch(err) {
                console.error(err)
                res.status(500).render('errors/500.ejs');
            }
        },

    postComment: async (req, res) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                return res.status(404).render('errors/404.ejs');
            }

            const auctionExists = await Auction.exists({ _id: req.params.id });
            if (!auctionExists) {
                return res.status(404).render('errors/404.ejs');
            }

            const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';

            if (!body) {
                req.flash('errors', { msg: 'Please enter a comment.' });
                return res.redirect(`/auction/viewAuction/${req.params.id}`);
            }

            if (body.length > 1000) {
                req.flash('errors', { msg: 'Comments cannot be longer than 1000 characters.' });
                return res.redirect(`/auction/viewAuction/${req.params.id}`);
            }

            await Comment.create({
                body,
                user: req.user.id,
                auction: req.params.id,
            });

            res.redirect(`/auction/viewAuction/${req.params.id}`);
        } catch (err) {
            console.error(err);
            res.status(500).render('errors/500.ejs');
        }
    },

    postBid: async (req, res) => {
        const listingId = req.params.id;
        const redirectBack = `/auction/viewAuction/${listingId}`;

        try {
            if (!mongoose.Types.ObjectId.isValid(listingId)) {
                return res.status(404).render('errors/404.ejs');
            }

            const listing = await Auction.findById(listingId).lean();

            if (!listing) {
                return res.status(404).render('errors/404.ejs');
            }

            if (listing.saleType !== 'auction') {
                req.flash('errors', { msg: 'This listing is not an auction.' });
                return res.redirect(redirectBack);
            }

            // Shill bidding — a seller driving up the price on their own item —
            // is one of the most damaging things to trust on a marketplace.
            if (listing.user.toString() === req.user.id) {
                req.flash('errors', { msg: 'You cannot bid on your own listing.' });
                return res.redirect(redirectBack);
            }

            if (!isAuctionLive(listing)) {
                req.flash('errors', { msg: 'This auction has ended.' });
                return res.redirect(redirectBack);
            }

            const amount = parseMoney(req.body.amount);

            if (amount === null) {
                req.flash('errors', { msg: 'Enter a valid bid amount.' });
                return res.redirect(redirectBack);
            }

            const minimum = minimumNextBid(listing);

            // This check exists so the user gets a specific, useful error
            // message. It is NOT what makes bidding correct — the atomic
            // filter below is. Between this read and that write another
            // bidder can land, which is exactly why the same condition is
            // repeated inside the update.
            if (amount < minimum) {
                req.flash('errors', { msg: `Your bid must be at least ${formatMoney(minimum)}.` });
                return res.redirect(redirectBack);
            }

            const threshold = round2(amount - listing.minIncrement);

            // The compare-and-set. Every condition that has to hold for this
            // bid to be legal lives in the filter, so MongoDB evaluates them
            // and applies the write as one indivisible operation. Two bidders
            // arriving in the same millisecond both run this; the database
            // serialises them, the first flips currentBid, and the second no
            // longer matches its own filter and is rejected. No bid is lost,
            // and nobody is told they won when they didn't.
            //
            // returnDocument: 'before' does two jobs at once — a non-null
            // result proves this bid won the race, and the document returned
            // is the pre-bid state, which is where the outbid user's identity
            // lives. Reading that separately afterwards would be a race of
            // its own: by then currentBidder has already been overwritten.
            const previousState = await Auction.findOneAndUpdate(
                {
                    _id: listingId,
                    saleType: 'auction',
                    status: 'open',
                    endsAt: { $gt: new Date() },
                    $or: [
                        // First bid: has to meet the starting price.
                        { currentBid: null, startingPrice: { $lte: amount } },
                        // Later bids: have to clear the current bid by the increment.
                        { currentBid: { $ne: null, $lte: threshold } },
                    ],
                },
                {
                    $set: {
                        currentBid: amount,
                        currentBidder: req.user.id,
                    },
                    $inc: { bidCount: 1 },
                },
                { returnDocument: 'before' }
            )
                .populate('currentBidder', 'email displayName')
                .lean();

            if (!previousState) {
                req.flash('errors', {
                    msg: 'Your bid was not accepted — someone else may have bid just before you, or the auction closed. Refresh to see the current bid.',
                });
                return res.redirect(redirectBack);
            }

            await Bid.create({
                auction: listingId,
                user: req.user.id,
                amount: amount,
            });

            // Fire-and-forget, matching the pattern already used in
            // postForgetPassword: a slow or unreachable SMTP server should
            // never hold up the response confirming a bid.
            //
            // The id comparison stops you emailing yourself when you raise
            // your own already-winning bid.
            const outbidUser = previousState.currentBidder;

            if (outbidUser && outbidUser.email && outbidUser._id.toString() !== req.user.id) {
                sendOutbidEmail(outbidUser, { _id: listingId, title: listing.title }, amount)
                    .catch((mailErr) => {
                        console.error('Failed to send outbid email:', mailErr.message);
                    });
            }

            req.flash('success', `Your bid of ${formatMoney(amount)} has been placed.`);
            res.redirect(redirectBack);

        } catch (err) {
            console.error(err);
            res.status(500).render('errors/500.ejs');
        }
    },

    postToggleHighlight: async (req, res) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                return res.status(404).render('errors/404.ejs');
            }

            const listing = await Auction.findById(req.params.id).lean();

            if (!listing) {
                return res.status(404).render('errors/404.ejs');
            }

            if (isHighlighted(listing)) {
                await Auction.findByIdAndUpdate(req.params.id, { highlightedAt: null });
            } else {
                await Auction.updateMany(
                    { _id: { $ne: req.params.id }, highlightedAt: { $ne: null } },
                    { $set: { highlightedAt: null } }
                );
                await Auction.findByIdAndUpdate(req.params.id, { highlightedAt: new Date() });
            }

            res.redirect('/auction');
        } catch (err) {
            console.error(err);
            res.status(500).render('errors/500.ejs');
        }
    },
    
}
