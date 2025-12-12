const mongoose = require("mongoose"); // <-- ده السطر اللي كان ناقص
const { Schema } = mongoose;

const FAQSchema = new Schema({
    question: { type: String, required: true },
    answer: { type: String, required: true },
    // FR-CS7: Categorization specific to FAQs
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
    isActive: { type: Boolean, default: true } // Helper to hide/show FAQs
}, { timestamps: true });

// يفضل دايما اسم المودل يكون بحرف كابيتال "FAQ"
module.exports = mongoose.model("FAQ", FAQSchema);