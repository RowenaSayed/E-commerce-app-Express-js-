const mongoose = require("mongoose");
const { Schema } = mongoose;

const TicketSchema = new Schema({
    // FR-CS4: Unique Ticket Number (سيتم تمريره من الكنترولر)
    ticketNumber: { 
        type: String, 
        required: true, 
        unique: true ,
        index: true
    },

    // FR-CS2: ربط التذكرة بالمستخدم
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // FR-CS1: تفاصيل الاتصال
    contactDetails: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true }
    },

    subject: { type: String, required: true },
    message: { type: String, required: true },
    
    // FR-CS1: رقم الطلب (اختياري)
    orderNumber: { type: String, required: false }, 

    // FR-CS3: التصنيفات
    category: { 
        type: String, 
        enum: [
            "Order Inquiry", "Product Inquiry", "Payment Issue", 
            "Technical Issue", "Return/Refund Request", "Other"
        ],
        required: true,
        default: "Other",
        index: true
    },

    // FR-CS5: حالة التذكرة
    status: { 
        type: String, 
        enum: [
            "Open", "In Progress", "Waiting for Customer Response", 
            "Resolved", "Closed"
        ], 
        default: "Open" ,
        index: true
    },

    // الموظف المسؤول
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },

    // الردود
    responses: [
        {
            sender: { type: Schema.Types.ObjectId, ref: "User" }, 
            role: { type: String, enum: ["buyer", "support", "admin", "seller"], required: true }, 
            message: String,
            date: { type: Date, default: Date.now },
        },
    ],
}, { timestamps: true });

module.exports = mongoose.model("Ticket", TicketSchema);