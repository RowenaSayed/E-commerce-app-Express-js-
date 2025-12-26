const mongoose = require("mongoose");
const { Schema } = mongoose;

const CartSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        unique: true,
        sparse: true
    },

    sessionId: {
        type: String,
        unique: true,
        sparse: true
    },

    items: [
        {
            product: {
                type: Schema.Types.ObjectId,
                ref: "Product"
            },
            quantity: {
                type: Number,
                default: 1,
                min: 1
            },
        },
    ],

    discountCode: {
        type: String,
        default: null
    },

    discountAmount: {
        type: Number,
        default: 0,
        min: 0
    },

    freeShipping: {
        type: Boolean,
        default: false
    },

    promotionType: {
        type: String,
        enum: ['Percentage', 'Fixed', 'FreeShipping', null],
        default: null
    },

    discountAppliedAt: {
        type: Date,
        default: null
    }

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

CartSchema.virtual('subtotal').get(function () {
    return this.items.reduce((total, item) => {
        if (item.product && item.product.price) {
            return total + (item.product.price * item.quantity);
        }
        return total;
    }, 0);
});

CartSchema.virtual('finalTotal').get(function () {
    const subtotal = this.subtotal || 0;
    const discount = this.discountAmount || 0;
    return Math.max(0, subtotal - discount);
});

module.exports = mongoose.model("Cart", CartSchema);