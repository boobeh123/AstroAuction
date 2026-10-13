const mongoose = require('mongoose')

// A private message between an ended auction's seller and its winner, sent
// from the listing page. Only those two can read or send them.
const MessageSchema = new mongoose.Schema({
    body: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000,
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    auction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Auction',
        required: true,
    },
    // Set when the recipient opens the listing. Until then the message is
    // unread, and further messages don't send another alert email.
    readAt: {
        type: Date,
        default: null,
    },
},
    { timestamps: true }
)

// A conversation is read as "this listing's messages, oldest first", and
// deleted with the listing. Deleting an account removes every message it
// sent or received.
MessageSchema.index({ auction: 1, createdAt: 1 })
MessageSchema.index({ sender: 1 })
MessageSchema.index({ recipient: 1 })

module.exports = mongoose.model('Message', MessageSchema)
