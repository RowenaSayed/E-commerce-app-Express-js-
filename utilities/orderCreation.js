const Order = require('../models/orders');
const Product = require('../models/products');
const Governate = require('../models/governates');

const calculateDeliveryDate = (governate) => {
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + 5);
    return estimatedDate;
};

const createFinalOrder = async (userId, userDoc, shippingAddress, totals, paymentMethod, paymentStatus, cart) => {
    const orderItems = cart.items.map(item => ({
        product: item.product._id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
        condition: item.product.condition || 'New'
    }));

    const estimatedDate = calculateDeliveryDate(null);
    const orderNumber = 'ORD-' + Date.now();

    const newOrder = new Order({
        user: userId,
        orderNumber: orderNumber,
        estimatedDeliveryDate: estimatedDate,
        items: orderItems,
        shippingAddress: {
            address: shippingAddress.street,
            city: shippingAddress.city,
            postalCode: shippingAddress.zipCode,
            phone: userDoc.phone,
            governorate: shippingAddress.governorate,
            country: 'Egypt'
        },
        paymentMethod,
        paymentStatus,
        totalAmount: totals.total,
        VAT: totals.vat,
        deliveryFee: totals.deliveryFee,
        discount: totals.discount,
        orderStatus: "Order Placed"
    });

    await newOrder.save();
    return newOrder;
};

const finalizeOrder = async (cart) => {
    for (const item of cart.items) {
        const product = await Product.findById(item.product._id);
        if (product) {
            product.stockQuantity -= item.quantity;
            await product.save();
        }
    }

    cart.items = [];
    cart.discountCode = undefined;
    cart.discountAmount = undefined;
    cart.freeShipping = undefined;
    cart.promotionType = undefined;
    await cart.save();
};

module.exports = {
    createFinalOrder,
    finalizeOrder
};