const mongoose = require('mongoose')

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
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: CATEGORIES,
    }
},
    { timestamps: true }
)

module.exports = mongoose.model('Auction', AuctionSchema)
