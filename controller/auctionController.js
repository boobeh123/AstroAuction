const mongoose = require('mongoose')
const { matchedData } = require('express-validator')
const Auction = require('../model/Auction')
const Comment = require('../model/Comment')
const Bid = require('../model/Bid')
const User = require('../model/User')
const Message = require('../model/Message')
const cloudinary = require("../config/cloudinary");
const fs = require('fs/promises');
const { closeAuctionIfDue } = require('../services/auctionCloser');
const { deleteListings } = require('../services/listingCleanup');
const { clearHighlightCache } = require('../services/highlightCache');
const { sendOutbidEmail, sendNewMessageEmail } = require('../config/mailer');
const {
    round2,
    parseMoney,
    minimumNextBid,
    isAuctionLive,
    formatMoney,
    DURATION_CHOICES,
    AMOUNT_LIMITS,
    INCREMENT_LIMITS,
} = require('../utils/bidding');
const { isHighlighted } = require('../utils/highlight');
const { photoUrl } = require('../utils/photos');
const { formErrors } = require('../middleware/validators');

// How many listings the auction page shows at a time
const LISTINGS_PER_PAGE = 24;

// Handles youtube.com/watch?v=, youtu.be/, and youtube.com/embed/ links,
// with or without extra query params (timestamps, playlists, etc).
// Returns null if the URL doesn't contain a recognizable video ID, so the
// template can cleanly skip rendering an embed for anything malformed.
function extractYouTubeId(url) {
    if (typeof url !== 'string') return null;
    const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
    return match ? match[1] : null;
}

// Once an auction has ended, its seller and its winner each see the other's
// name and email address on the listing page, so they can arrange payment
// and pickup. Anyone else, and any auction still open, gets null.
async function findAuctionContact(listing, viewer) {
    if (!viewer || listing.saleType !== 'auction' || listing.status !== 'ended' || !listing.currentBidder) {
        return null;
    }

    const sellerId = listing.user ? listing.user._id.toString() : null;
    const winnerId = listing.currentBidder.toString();
    let role;
    let otherId;

    if (viewer.id === sellerId) {
        role = 'winner';
        otherId = winnerId;
    } else if (viewer.id === winnerId) {
        role = 'seller';
        otherId = sellerId;
    } else {
        return null;
    }

    const person = otherId ? await User.findById(otherId).select('displayName email').lean() : null;
    return { role, person };
}

// Which side of a conversation the viewer is on. Only an auction that ended
// with a winner has one, between its seller and that winner. Returns the
// other person's id and role, or null for everyone else. Takes the seller's
// id as a string, since the listing's user may or may not be populated.
function findConversationSide(listing, sellerId, viewerId) {
    if (!viewerId || listing.saleType !== 'auction' || listing.status !== 'ended' || !listing.currentBidder) {
        return null;
    }

    const winnerId = listing.currentBidder.toString();
    if (viewerId === sellerId) return { otherId: winnerId, otherRole: 'winner' };
    if (viewerId === winnerId) return { otherId: sellerId, otherRole: 'seller' };
    return null;
}

// The conversation the listing page shows its seller or its winner: the
// other person's name (never their email) and the messages, oldest first.
// Opening it marks the messages sent to the viewer as read, which lets the
// next message send an alert email again. Anyone else gets null.
async function openConversation(listing, viewer) {
    const sellerId = listing.user ? listing.user._id.toString() : null;
    const side = findConversationSide(listing, sellerId, viewer && viewer.id);
    if (!side) return null;

    const other = side.otherId ? await User.findById(side.otherId).select('displayName').lean() : null;
    const messages = await Message.find({ auction: listing._id }).sort({ createdAt: 1 }).lean();

    await Message.updateMany(
        { auction: listing._id, recipient: viewer.id, readAt: null },
        { $set: { readAt: new Date() } }
    );

    return {
        otherRole: side.otherRole,
        other: other ? { displayName: other.displayName } : null,
        messages,
    };
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

// Unexpected errors aren't caught here: Express 5 passes anything thrown in
// these handlers to middleware/errorHandler.js, which logs it and shows the
// 500 page.
module.exports = {

    getAuction: async (req, res) => {
        // A page number that isn't a whole number from 1 up goes back to page 1
        if (!formErrors(req).isEmpty()) {
            return res.redirect('/auction');
        }

        const totalListings = await Auction.countDocuments({});
        const pageCount = Math.max(1, Math.ceil(totalListings / LISTINGS_PER_PAGE));
        // A page past the end shows the last page
        const currentPage = Math.min(matchedData(req).page || 1, pageCount);

        // Newest first. _id breaks ties between listings created in the same
        // millisecond, so one listing can't show up on two pages.
        const listings = await Auction.find({})
            .sort({ createdAt: -1, _id: -1 })
            .skip((currentPage - 1) * LISTINGS_PER_PAGE)
            .limit(LISTINGS_PER_PAGE)
            .populate('user', 'image displayName')
            .lean();

        res.render('auction.ejs', {
            listings: listings,
            totalListings: totalListings,
            currentPage: currentPage,
            pageCount: pageCount,
            formatMoney: formatMoney,
            photoUrl: photoUrl,
            isAuctionLive: isAuctionLive,
            isHighlighted: isHighlighted,
            durationChoices: DURATION_CHOICES,
            categories: Auction.CATEGORIES,
            amountLimits: AMOUNT_LIMITS,
            incrementLimits: INCREMENT_LIMITS,
        });
    },

    postAuction: async (req, res) => {

        try {
            // Validation runs before the Cloudinary upload, not after.
            // Uploading first and validating second means a rejected listing
            // leaves its images sitting in Cloudinary with no database row
            // pointing at them — orphaned files nothing will ever clean up.
            // The finally block below still deletes multer's temp files.
            const errors = formErrors(req);
            if (!errors.isEmpty()) {
                req.flash('errors', errors.array());
                return res.redirect('/auction');
            }

            // matchedData also returns the other sale type's price fields,
            // unchecked (validateListing skips them), so only the fields for
            // this listing's sale type are read below.
            const input = matchedData(req);
            const saleFields = {};

            if (input.saleType === 'auction') {
                const durationDays = Number(input.durationDays);
                const endsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

                saleFields.saleType = 'auction';
                saleFields.startingPrice = parseMoney(input.startingPrice);
                // An empty increment means $1.00
                saleFields.minIncrement = parseMoney(input.minIncrement) || 1;
                saleFields.endsAt = endsAt;
                saleFields.status = 'open';
                saleFields.currentBid = null;
                saleFields.currentBidder = null;
                saleFields.bidCount = 0;
            } else {
                saleFields.saleType = 'fixed';
                saleFields.price = parseMoney(input.price);
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
                title: input.title,
                description: input.description,
                images: images,
                video: input.video,
                user: req.user.id,
                cloudinaryIds: cloudinaryIds,
                category: input.category,
                ...saleFields,
            })

            console.log('Listing has been added!')
            res.redirect('/auction')
        } finally {
            await cleanupTempUploads(req.files);
        }
    },

    deleteAuction: async (req, res) => {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).render('errors/404.ejs');
        }

        const listing = await Auction.findById(req.params.id).select('user cloudinaryIds saleType status bidCount').lean();

        if (!listing) {
            return res.status(404).render('errors/404.ejs');
        }

        if (listing.user.toString() !== req.user.id) {
            return res.status(403).render('errors/403.ejs');
        }

        // Bidders on an open auction are waiting to see who wins. Once the
        // auction has ended, and the closer has sent the winner and the seller
        // their emails, it can be deleted.
        if (listing.saleType === 'auction' && listing.status === 'open' && listing.bidCount > 0) {
            req.flash('errors', { msg: "This auction already has bids, so it can't be deleted until it ends." });
            return res.redirect('/auction');
        }

        // Its photos, comments and bid history go with it
        await deleteListings([listing]);
        console.log('Deleted listing')
        res.redirect('/auction')
    },

    getDetailedAuction: async (req, res) => {
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
            contact: await findAuctionContact(listing, req.user),
            conversation: await openConversation(listing, req.user),
            formatMoney: formatMoney,
            photoUrl: photoUrl,
            amountLimits: AMOUNT_LIMITS,
        });
    },

    postComment: async (req, res) => {
        // A listing id that can't exist is a 404, whatever the form says
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).render('errors/404.ejs');
        }

        const errors = formErrors(req);
        if (!errors.isEmpty()) {
            req.flash('errors', errors.array());
            return res.redirect(`/auction/viewAuction/${req.params.id}`);
        }

        const auctionExists = await Auction.exists({ _id: req.params.id });
        if (!auctionExists) {
            return res.status(404).render('errors/404.ejs');
        }

        const { body } = matchedData(req);

        await Comment.create({
            body,
            user: req.user.id,
            auction: req.params.id,
        });

        res.redirect(`/auction/viewAuction/${req.params.id}`);
    },

    postMessage: async (req, res) => {
        // A listing id that can't exist is a 404, whatever the form says
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).render('errors/404.ejs');
        }

        const listingPage = `/auction/viewAuction/${req.params.id}`;
        const errors = formErrors(req);
        if (!errors.isEmpty()) {
            req.flash('errors', errors.array());
            return res.redirect(listingPage);
        }

        const listing = await Auction.findById(req.params.id).select('title user saleType status currentBidder').lean();
        if (!listing) {
            return res.status(404).render('errors/404.ejs');
        }

        // Only the seller and the winner of an ended auction have a
        // conversation. The form is only on their page, so anyone else
        // posting here gets the 403 page.
        const sellerId = listing.user ? listing.user.toString() : null;
        const side = findConversationSide(listing, sellerId, req.user.id);
        if (!side) {
            return res.status(403).render('errors/403.ejs');
        }

        const recipient = side.otherId ? await User.findById(side.otherId).select('email').lean() : null;
        if (!recipient) {
            req.flash('errors', { msg: `The ${side.otherRole}'s account no longer exists, so you can't message them.` });
            return res.redirect(listingPage);
        }

        // One alert email per batch of messages: if the recipient still has
        // an unread one here, they've already been told and will see this
        // one too when they open the listing
        const hadUnread = await Message.exists({ auction: req.params.id, recipient: side.otherId, readAt: null });

        const { body } = matchedData(req);

        await Message.create({
            body,
            sender: req.user.id,
            recipient: side.otherId,
            auction: req.params.id,
        });

        if (!hadUnread) {
            const senderName = req.user.displayName || `The ${side.otherRole === 'seller' ? 'winner' : 'seller'}`;
            // A failed email shouldn't lose the message, which is already saved
            await sendNewMessageEmail(recipient, listing, senderName).catch((mailErr) => {
                console.error('Failed to send new message email:', mailErr.message);
            });
        }

        res.redirect(`${listingPage}#messages`);
    },

    postBid: async (req, res) => {
        const listingId = req.params.id;
        const redirectBack = `/auction/viewAuction/${listingId}`;

        // A listing id that can't exist is a 404, whatever the form says
        if (!mongoose.Types.ObjectId.isValid(listingId)) {
            return res.status(404).render('errors/404.ejs');
        }

        const errors = formErrors(req);
        if (!errors.isEmpty()) {
            req.flash('errors', errors.array());
            return res.redirect(redirectBack);
        }

        const amount = parseMoney(matchedData(req).amount);

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
        //
        // mongoose.trusted() marks these operators as the app's own, so
        // the sanitizeFilter guard in config/database.js leaves them alone.
        // Without it, this filter would quietly match nothing and every
        // bid would be rejected.
        const previousState = await Auction.findOneAndUpdate(
            {
                _id: listingId,
                saleType: 'auction',
                status: 'open',
                endsAt: mongoose.trusted({ $gt: new Date() }),
                $or: [
                    // First bid: has to meet the starting price.
                    { currentBid: null, startingPrice: mongoose.trusted({ $lte: amount }) },
                    // Later bids: have to clear the current bid by the increment.
                    { currentBid: mongoose.trusted({ $ne: null, $lte: threshold }) },
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
    },

    postToggleHighlight: async (req, res) => {
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
            // trusted(): see the note in postBid
            await Auction.updateMany(
                {
                    _id: mongoose.trusted({ $ne: req.params.id }),
                    highlightedAt: mongoose.trusted({ $ne: null }),
                },
                { $set: { highlightedAt: null } }
            );
            await Auction.findByIdAndUpdate(req.params.id, { highlightedAt: new Date() });
        }

        // The banner caches its listing for a few seconds; show the change now
        clearHighlightCache();
        res.redirect('/auction');
    },

}
