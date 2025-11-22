const mongoose = require("mongoose");
const { Schema } = mongoose;
const PromotionSchema = new Schema({
    code: String,
    type: { type: String, enum: ["Percentage", "Fixed", "FreeShipping", "BuyXGetY"] },
    value: Number,
    minPurchase: Number,
    startDate: Date,
    endDate: Date,
    usageLimitPerUser: Number,
    totalUsageLimit: Number,
    active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("Promotion", PromotionSchema);
