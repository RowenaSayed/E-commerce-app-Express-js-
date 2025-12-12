const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderSchema = new Schema({
    // FR-O2: Order Number (Unique & Readable)
    orderNumber: { type: String, unique: true },

    // ربط الطلب بالمستخدم
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // FR-O2: Items Ordered
    items: [
        {
            product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
            name: { type: String, required: true }, // Snapshot of product name
            quantity: { type: Number, required: true, min: 1 },
            price: { type: Number, required: true }, // Snapshot of price at purchase time
            // FR-O18: Product condition (New, Used, Imported) affects return policy
            condition: { type: String, enum: ['New', 'Used', 'Imported'], required: true } 
        }
    ],

    // FR-O2: Total Amount & Payment
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['COD', 'Online'], required: true },
    paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Refunded'], default: 'Pending' },

    // FR-O2: Shipping Address
    shippingAddress: {
        address: String,
        city: String,
        postalCode: String,
        country: String,
        phone: String
    },

    // FR-O3: Order Status Stages
    orderStatus: { 
        type: String, 
        enum: [
            'Order Placed', 
            'Payment Confirmed', 
            'Shipped', 
            'Out for Delivery', 
            'Delivered', 
            'Cancelled', 
            'Returned'
        ], 
        default: 'Order Placed' 
    },

    // FR-O4 & FR-O5: Tracking & Dates
    estimatedDeliveryDate: Date,
    actualDeliveryDate: Date,
    trackingNumber: String,

    // --- Cancellation Logic (FR-O10, FR-O11) ---
    isCancelled: { type: Boolean, default: false },
    cancellationReason: { 
        type: String, 
        enum: ['Changed my mind', 'Found better price', 'Ordered by mistake', 'Shipping takes too long', 'Other'] 
    },
    cancellationDate: Date,

    // --- Return Logic (FR-O13, FR-O14, FR-O15, FR-O16) ---
    isReturnRequested: { type: Boolean, default: false },
    returnDetails: {
        reason: { 
            type: String, 
            enum: [
                'Product defective/damaged', 
                'Wrong item received', 
                'Product doesn\'t match description', 
                'Missing accessories/parts'
            ] 
        },
        comment: String,
        // FR-O15: Upload images as proof
        proofImages: [String], 
        requestDate: Date,
        // FR-O16: Return Status
        status: {
            type: String,
            enum: [
                'None',
                'Return Requested', 
                'Return Approved', 
                'Return Rejected', 
                'Item Picked Up', 
                'Item Received', 
                'Quality Check', 
                'Refund Processed'
            ],
            default: 'None'
        }
    }

}, { timestamps: true });

// Auto-generate Order Number (e.g., ORD-98231-55)
OrderSchema.pre('save', async function(next) {
    if (!this.orderNumber) {
        const prefix = "ORD";
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(1000 + Math.random() * 9000);
        this.orderNumber = `${prefix}-${timestamp}-${random}`;
    }
    
    // FR-O4: Estimate delivery date (e.g., 5 days from now) if not set
    if (!this.estimatedDeliveryDate) {
        const date = new Date();
        date.setDate(date.getDate() + 5); // Default 5 days shipping
        this.estimatedDeliveryDate = date;
    }
    next();
});

module.exports = mongoose.model('Order', OrderSchema);