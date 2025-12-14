// utilities/orderCreation.js

const Order = require('../models/orders'); // ⚠️ تأكدي أن المسار صحيح نسبةً للملف الجديد
const Product = require('../models/products');
// يمكن أن نحتاج لـ require لمودل Governate هنا إذا كانت هناك حاجة لجلب بياناته
const Governate = require('../models/governates'); 

// Helper function to calculate delivery date (يجب أن يتم نقلها هنا أو استدعاؤها من مكان آخر)
const calculateDeliveryDate = (governate) => {
    // هذه الدالة يفترض أنها موجودة لحساب estimatedDeliveryDate
    const estimatedDate = new Date(); 
    estimatedDate.setDate(estimatedDate.getDate() + 5); 
    return estimatedDate;
};


// 1. دالة إنشاء الطلب النهائي (FR-C18 & FR-C20)
const createFinalOrder = async (userId, userDoc, shippingAddress, totals, paymentMethod, paymentStatus, cart) => {
    
    // ⚠️ يجب إجراء التحقق من المخزون مرة أخرى هنا لضمان عدم وجود تنافس (Race Condition)
    // لتجنب الازدواجية، يمكن أن نفترض أن هذا تم تنفيذه في initiatePayment قبل الاستدعاء.
    
    const orderItems = cart.items.map(item => ({
        product: item.product._id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price, 
        condition: item.product.condition || 'New'
    }));
    
    // ⚠️ ملاحظة: يجب تمرير Governate Doc هنا لحساب التاريخ بدقة إذا لم يكن في totals
    const estimatedDate = calculateDeliveryDate(null); // استخدام قيمة مؤقتة أو استدعاء دقيق
    
    // توليد رقم طلب فريد
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
            governorate: shippingAddress.governorate ,
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

// 2. دالة تخفيض المخزون وتفريغ السلة
const finalizeOrder = async (cart) => {
    // تخفيض المخزون
    for (const item of cart.items) {
        const product = await Product.findById(item.product._id);
        if (product) {
            product.stockQuantity -= item.quantity;
            await product.save();
        }
    }
    
    // تفريغ السلة
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