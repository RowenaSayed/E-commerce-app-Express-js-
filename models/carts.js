const mongoose = require("mongoose");
const { Schema } = mongoose;

const CartSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", unique: true, sparse: true },
    sessionId: { type: String, unique: true, sparse: true },

    items: [
        {
            product: { type: Schema.Types.ObjectId, ref: "Product" },
            quantity: { type: Number, default: 1 },
        },
    ],
}, { timestamps: true });

module.exports = mongoose.model("Cart", CartSchema);
