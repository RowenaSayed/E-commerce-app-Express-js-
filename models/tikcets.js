const mongoose = require("mongoose");
const { Schema } = mongoose;
const TicketSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User" },
    subject: String,
    message: String,
    orderNumber: String,
    category: { type: String, enum: ["Order", "Product", "Payment", "Technical", "Return", "Other"] },
    status: { type: String, enum: ["Open", "InProgress", "WaitingCustomer", "Resolved", "Closed"], default: "Open" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },//support role??
    responses: [
        {
            support: { type: Schema.Types.ObjectId, ref: "User" },
            message: String,
            date: { type: Date, default: Date.now },
        },
    ],
}, { timestamps: true });

module.exports = mongoose.model("Ticket", TicketSchema);
