const mongoose = require('mongoose')
const { AMOUNT_LIMITS, INCREMENT_LIMITS } = require('../utils/bidding')

const CATEGORIES = [
    'Art',
    'Antiques',
    'Coins & Collectibles',
    'Jewelry & Watches',
    'Fashion',
    'Home Decor & Goods',
    'Lawn & Garden',
    'Furniture',
    'Sports Goods',
    'Toys',
    'Electronics',
    'Cars',
    'Construction',
    'Services',
]

const SALE_TYPES = ['fixed', 'auction']
const AUCTION_STATUSES = ['open', 'ended', 'cancelled']

const AuctionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000,
    },
    images: {
        type: [String],
    },
    cloudinaryIds: {
        type: [String],
    },
    video: {
        type: String,
    },
    highlightedAt: {
        type: Date,
        default: null,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: CATEGORIES,
    },

    // Defaults to 'fixed' so every listing that existed before bidding was
    // added stays a plain listing. Nothing already in the database silently
    // becomes an auction with no end date.
    saleType: {
        type: String,
        enum: SALE_TYPES,
        default: 'fixed',
        required: true,
    },

    // The money limits live in utils/bidding.js. The form validators check
    // them first; these copies are a backstop for anything that skips them.

    // --- Fixed-price listings ---
    price: {
        type: Number,
        min: AMOUNT_LIMITS.min,
        max: AMOUNT_LIMITS.max,
        default: null,
    },

    // --- Auction listings ---
    startingPrice: {
        type: Number,
        min: AMOUNT_LIMITS.min,
        max: AMOUNT_LIMITS.max,
        default: null,
    },
    // Per-listing rather than global: a $5 item shouldn't require the same
    // jump between bids as a $500 one.
    minIncrement: {
        type: Number,
        min: INCREMENT_LIMITS.min,
        max: INCREMENT_LIMITS.max,
        default: 1,
    },
    // null until the first bid lands. The bid filter relies on this being
    // null (not 0) to tell "no bids yet" apart from a real bid.
    currentBid: {
        type: Number,
        default: null,
    },
    currentBidder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    bidCount: {
        type: Number,
        default: 0,
    },
    endsAt: {
        type: Date,
        default: null,
    },
    status: {
        type: String,
        enum: AUCTION_STATUSES,
        default: 'open',
    },
    closedAt: {
        type: Date,
        default: null,
    },
},
    { timestamps: true }
)

// Matches the sweeper's query shape exactly, so finding due auctions stays an
// index scan instead of a collection scan as listings accumulate.
AuctionSchema.index({ saleType: 1, status: 1, endsAt: 1 })

// The auction page lists newest first, with _id breaking ties, one page at a time.
AuctionSchema.index({ createdAt: -1, _id: -1 })

// Deleting an account looks up its listings, and the auctions it's winning.
AuctionSchema.index({ user: 1 })
AuctionSchema.index({ currentBidder: 1 })

const Auction = mongoose.model('Auction', AuctionSchema)

Auction.CATEGORIES = CATEGORIES
Auction.SALE_TYPES = SALE_TYPES
Auction.AUCTION_STATUSES = AUCTION_STATUSES

module.exports = Auction
