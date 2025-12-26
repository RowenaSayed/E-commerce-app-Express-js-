const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderSchema = new Schema({
    orderNumber: { 
        type: String, 
        unique: true,
        index:true, 
        sparse: true,
        required: true
    },

    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    iscrearedByAdmin: { type: Boolean, default: false },
    
    items: [
        {
            product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
            name: { type: String, required: true }, 
            quantity: { type: Number, required: true, min: 1 },
            price: { type: Number, required: true }, 
            condition: { type: String, enum: ['New', 'Used', 'Imported'], default: 'New' } 
        }
    ],

    totalAmount: { type: Number, required: true },
    VAT: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },

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
        default: 'Order Placed' ,index:true
    },

    estimatedDeliveryDate: Date,
    actualDeliveryDate: Date,
    trackingNumber: String,

    isCancelled: { type: Boolean, default: false },
    cancellationReason: { 
        type: String, 
        enum: ['Changed my mind', 'Found better price', 'Ordered by mistake', 'Shipping takes too long', 'Other'] 
    },
    cancellationDate: Date,
    
    internalNotes: { type: String },

    isReturnRequested: { type: Boolean, default: false },
    returnDetails: {
        reason: { 
            type: String, 
            enum: ['Product defective/damaged', 'Wrong item received', 'Product doesn\'t match description', 'Missing accessories/parts'] 
        },
        comment: String,
        proofImages: [String],
        requestDate: Date,
        status: { 
            type: String, 
            enum: ['None', 'Return Requested', 'Return Approved', 'Return Rejected', 'Refund Processed'], 
            default: 'None'  
        }
    }
}, { timestamps: true });


module.exports = mongoose.model('Order', OrderSchema);