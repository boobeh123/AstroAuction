const mongoose = require('mongoose')

const CommentSchema = new mongoose.Schema({
    body: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    auction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Auction',
        required: true,
    },
},
    { timestamps: true }
)

// A listing's comments are always read as "this listing's comments, oldest
// first", and deleted together with the listing.
CommentSchema.index({ auction: 1, createdAt: 1 })

module.exports = mongoose.model('Comment', CommentSchema)
