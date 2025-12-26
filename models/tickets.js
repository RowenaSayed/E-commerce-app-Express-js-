const mongoose = require("mongoose");
const { Schema } = mongoose;

const TicketSchema = new Schema({
    ticketNumber: { 
        type: String, 
        required: true, 
        unique: true ,
        index: true
    },

    user: { type: Schema.Types.ObjectId, ref: "User", required: true },

    contactDetails: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true }
    },

    subject: { type: String, required: true },
    message: { type: String, required: true },
    
    orderNumber: { type: String, required: false }, 

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

    status: { 
        type: String, 
        enum: [
            "Open", "In Progress", "Waiting for Customer Response", 
            "Resolved", "Closed"
        ], 
        default: "Open" ,
        index: true
    },

    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },

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