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

module.exports = mongoose.model('Comment', CommentSchema)
