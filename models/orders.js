const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderSchema = new Schema({
    // FR-O2: Order Number
    orderNumber: { 
        type: String, 
        unique: true, 
        sparse: true,
        required: true // خليتها required لأننا هنبعتها من الكنترولر أكيد
    },

    // Link to User
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    iscrearedByAdmin: { type: Boolean, default: false }, // FR-A16: Created by Admin flag
    // Items
    items: [
        {
            product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
            name: { type: String, required: true }, 
            quantity: { type: Number, required: true, min: 1 },
            price: { type: Number, required: true }, 
            condition: { type: String, enum: ['New', 'Used', 'Imported'], default: 'New' } 
        }
    ],

    // Financials
    totalAmount: { type: Number, required: true },
    VAT: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },

    // Payment & Status
    paymentMethod: { type: String, enum: ['COD', 'Online'], required: true },
    paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Refunded'], default: 'Pending' },

    shippingAddress: {
        address: { type: String, required: true },
        city: { type: String, required: true },
        governorate: { type: String, required: true },
        postalCode: String,
        country: { type: String, required: true },
        phone: { type: String, required: true }
    },

    orderStatus: { 
        type: String, 
        enum: ['Order Placed', 'Payment Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned'], 
        default: 'Order Placed' 
    },

    // Tracking & Dates
    estimatedDeliveryDate: Date,
    actualDeliveryDate: Date,
    trackingNumber: String,

    // Cancellation & Return Logic
    isCancelled: { type: Boolean, default: false },
    cancellationReason: { type: String, enum: ['Changed my mind', 'Found better price', 'Ordered by mistake', 'Shipping takes too long', 'Other'] },
    cancellationDate: Date,
    // أضيفي هذا الحقل داخل OrderSchema
internalNotes: { type: String }, // FR-A17: ملاحظات للأدمن فقط
    isReturnRequested: { type: Boolean, default: false },
    returnDetails: {
        reason: { type: String, enum: ['Product defective/damaged', 'Wrong item received', 'Product doesn\'t match description', 'Missing accessories/parts'] },
        comment: String,
        proofImages: [String],
        requestDate: Date,
        status: { type: String, enum: ['None', 'Return Requested', 'Return Approved', 'Return Rejected', 'Item Picked Up', 'Item Received', 'Quality Check', 'Refund Processed'], default: 'None' }
    }
}, { timestamps: true });


module.exports = mongoose.model('Order', OrderSchema);