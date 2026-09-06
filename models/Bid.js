const mongoose = require('mongoose')

// One row per accepted bid. The Auction document holds the *current* winning
// bid (that's what has to stay atomic); this collection is the history behind
// it — useful for showing bid activity and for settling "who bid what, when"
// if a sale is ever disputed.
const BidSchema = new mongoose.Schema({
    auction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Auction',
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
},
    { timestamps: true }
)

// Bid history is always read as "this auction's bids, newest first".
BidSchema.index({ auction: 1, createdAt: -1 })

module.exports = mongoose.model('Bid', BidSchema)
