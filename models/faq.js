const mongoose = require("mongoose");
const { Schema } = mongoose;

const FAQSchema = new Schema({
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { 
        type: String, 
        enum: [
            "Ordering Process", 
            "Payment Methods", 
            "Shipping and Delivery", 
            "Returns and Refunds", 
            "Product Warranty", 
            "Account Management"
        ],
        required: true 
    },
    isActive: { type: Boolean, default: true } 
}, { timestamps: true });

module.exports = mongoose.model("FAQ", FAQSchema);