const mongoose = require("mongoose");
const { Schema } = mongoose;

const ReviewSchema = new Schema({
    user: { 
        type: Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    product: { 
        type: Schema.Types.ObjectId, 
        ref: "Product", 
        required: true 
    },
    // Optional: Reference the specific order to prove FR-R1
    order: { 
        type: Schema.Types.ObjectId, 
        ref: "Order" 
    }, 
    rating: { 
        type: Number, 
        min: 1, 
        max: 5, 
        required: true 
    },
    comment: {
        type: String,
        trim: true,
        maxlength: 1000 
    },
    // FR-R1 & R5: verify purchase and filter by it
    verifiedPurchase: { 
        type: Boolean, 
        default: false 
    },
    // FR-R5: Filter by Product Condition
    productCondition: {
        type: String,
        enum: ["New", "Used", "Imported"],
        required: true 
    },
    // FR-R6: Store IDs to prevent double voting
    helpfulVoters: [{ type: Schema.Types.ObjectId, ref: "User" }],
    
    // FR-R7: Cached count for sorting by "Most Helpful" efficiently
    helpfulCount: { 
        type: Number, 
        default: 0 
    }
}, { 
    timestamps: true // FR-R7: Handles "Most recent" sort
});

// FR-R8: Prevent users from reviewing the same product multiple times
// This creates a unique compound index on user + product
ReviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Index for FR-R7: Efficient sorting
ReviewSchema.index({ helpfulCount: -1 }); 
ReviewSchema.index({ rating: -1 });

module.exports = mongoose.model("Review", ReviewSchema);