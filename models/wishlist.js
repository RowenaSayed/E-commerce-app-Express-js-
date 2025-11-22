const mongoose = require('mongoose');
const {Schema} = mongoose

const WishlistSchema = new Schema({
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    product_ids: [{ type: Schema.Types.ObjectId, ref: 'Product' }]
}, { timestamps: true });

module.exports = mongoose.model('Wishlist', WishlistSchema);

