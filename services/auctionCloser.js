const Auction = require('../models/Auction');
const {
    sendAuctionWonEmail,
    sendAuctionEndedSellerEmail,
} = require('../config/mailer');

const SWEEP_INTERVAL_MS = 60_000;

let sweepTimer = null;

/**
 * Closes one auction, if and only if it is currently open and its clock has
 * run out.
 *
 * The status transition lives in the query filter, not in application code.
 * That matters because two things can try to close the same auction at the
 * same moment — the interval sweeper and a page view both call this. Since
 * MongoDB applies a single-document update atomically, exactly one caller
 * matches `status: 'open'` and flips it; every other caller matches nothing
 * and gets null back. So the "winner" of that race is also the only one that
 * sends the emails, and nobody gets notified twice.
 *
 * Returns the closed listing, or null if there was nothing to close.
 */
async function closeAuctionIfDue(auctionId) {
    const now = new Date();

    const closed = await Auction.findOneAndUpdate(
        {
            _id: auctionId,
            saleType: 'auction',
            status: 'open',
            endsAt: { $lte: now },
        },
        {
            $set: { status: 'ended', closedAt: now },
        },
        { returnDocument: 'after' }
    )
        .populate('user', 'email displayName')
        .populate('currentBidder', 'email displayName')
        .lean();

    if (!closed) return null;

    await notifyAuctionClosed(closed);

    return closed;
}

/**
 * Sends the end-of-auction emails. Each send is caught individually so one
 * bad address doesn't stop the other notification from going out, and so a
 * mail failure never propagates back up and stalls the sweep.
 */
async function notifyAuctionClosed(closed) {
    const winner = closed.currentBidder;
    const seller = closed.user;

    if (winner && winner.email) {
        await sendAuctionWonEmail(winner, closed).catch((err) => {
            console.error('Failed to send auction-won email:', err.message);
        });
    }

    if (seller && seller.email) {
        await sendAuctionEndedSellerEmail(
            seller,
            closed,
            winner ? winner.displayName : null
        ).catch((err) => {
            console.error('Failed to send auction-ended email:', err.message);
        });
    }
}

/**
 * Finds every auction whose time is up and closes each one.
 *
 * Only _id is selected here — closeAuctionIfDue re-reads the document as part
 * of its atomic claim anyway, so pulling full documents twice would be wasted
 * work. Closes run sequentially rather than through Promise.all so a large
 * backlog (say, after the app was down for a while) doesn't fire hundreds of
 * simultaneous database writes and SMTP connections.
 */
async function closeExpiredAuctions() {
    const due = await Auction.find({
        saleType: 'auction',
        status: 'open',
        endsAt: { $lte: new Date() },
    })
        .select('_id')
        .lean();

    if (due.length === 0) return 0;

    let closedCount = 0;

    for (const { _id } of due) {
        try {
            const closed = await closeAuctionIfDue(_id);
            if (closed) closedCount += 1;
        } catch (err) {
            console.error(`Failed to close auction ${_id}:`, err.message);
        }
    }

    console.log(`Closed ${closedCount} expired auction(s).`);
    return closedCount;
}

/**
 * Starts the recurring sweep.
 *
 * The immediate first run matters: if the app was restarted or asleep, some
 * auctions have already passed their end time with nobody to notice. Booting
 * catches those up rather than waiting a full interval.
 */
function startAuctionCloser() {
    if (sweepTimer) return;

    closeExpiredAuctions().catch((err) => {
        console.error('Initial auction sweep failed:', err.message);
    });

    sweepTimer = setInterval(() => {
        closeExpiredAuctions().catch((err) => {
            console.error('Auction sweep failed:', err.message);
        });
    }, SWEEP_INTERVAL_MS);
}

// Exported so a Jest suite can shut the interval down — an un-cleared
// setInterval keeps the Node process alive and hangs the test runner.
function stopAuctionCloser() {
    if (!sweepTimer) return;
    clearInterval(sweepTimer);
    sweepTimer = null;
}

module.exports = {
    closeAuctionIfDue,
    closeExpiredAuctions,
    startAuctionCloser,
    stopAuctionCloser,
    SWEEP_INTERVAL_MS,
};
