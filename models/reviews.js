const mongoose = require("mongoose");
const { Schema } = mongoose;
const ReviewSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: String,
    verifiedPurchase: { type: Boolean, default: false },
    helpfulCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("Review", ReviewSchema);
