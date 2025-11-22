const mongoose = require("mongoose");
const { Schema } = mongoose;
const OrderSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: [
        {
            product: { type: Schema.Types.ObjectId, ref: "Product" },
            quantity: Number,
            price: Number,
        },
    ],
    shippingAddress: {
        street: String,
        city: String,
        governorate: String,
        zipCode: String,
    },
    deliveryMethod: { type: String, enum: ["Standard", "Express"], default: "Standard" },
    paymentMethod: { type: String, enum: ["COD", "CreditCard", "Fawry", "DigitalWallet", "BankInstallment"], required: true },
    totalAmount: Number,
    VAT: Number,
    deliveryFee: Number,
    status: { type: String, enum: ["Placed", "PaymentConfirmed", "Processing", "Packed", "Shipped", "OutForDelivery", "Delivered", "Cancelled", "Refunded"], default: "Placed" },
    orderNumber: { type: String, unique: true },
    orderNotes: String,
    returnRequest: {
        reason: String,
        images: [String],
        status: { type: String, enum: ["Requested", "Approved", "Rejected", "PickedUp", "Received", "QualityCheck", "Refunded"] },
    },
}, { timestamps: true });

module.exports = mongoose.model("Order", OrderSchema);
