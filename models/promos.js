const mongoose = require("mongoose");
const { Schema } = mongoose;

const PromotionSchema = new Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    type: {
        type: String,
        enum: ["Percentage", "Fixed", "FreeShipping", "BuyXGetY"],
        required: true
    },
    value: {
        type: Number,
        required: true
    },
    minPurchase: {
        type: Number,
        default: 0
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    usageLimitPerUser: {
        type: Number,
        default: null
    },
    totalUsageLimit: {
        type: Number,
        default: null
    },
    active: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model("Promotion", PromotionSchema);
