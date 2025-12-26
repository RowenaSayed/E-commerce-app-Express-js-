const Order = require('../models/orders');
const Promotion = require('../models/promos');
const Product = require('../models/products');
const Cart = require('../models/carts');
const Governates = require('../models/governates');
const { sendOrderStatusEmail } = require('../utilities/email');

const calculateDeliveryDate = (governate, deliveryType = 'standard') => {
    const today = new Date();
    let deliveryDays = governate.deliveryTime || 5;
    if (deliveryType === 'express') {
        deliveryDays = Math.max(1, deliveryDays - 1);
    }
    let daysAdded = 0;
    const estimatedDate = new Date(today);
    while (daysAdded < deliveryDays) {
        estimatedDate.setDate(estimatedDate.getDate() + 1);
        if (estimatedDate.getDay() !== 0 && estimatedDate.getDay() !== 6) {
            daysAdded++;
        }
    }
    return estimatedDate;
};

const calculateAdminOrderTotals = (itemsWithPrice, governate, deliveryMethod = 'standard') => {
    let subtotal = 0;
    const vatRate = 0.14;
    itemsWithPrice.forEach(item => {
        subtotal += item.priceAtPurchase * item.quantity;
    });
    let deliveryFee = governate?.fee || 0;
    if (deliveryMethod === 'express') {
        deliveryFee = Math.round(deliveryFee * 1.5);
    }
    const VAT = subtotal * vatRate;
    const total = subtotal + deliveryFee + VAT;
    return { subtotal, deliveryFee, VAT, total };
};

const createOrder = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Authentication required" });
        const { shippingAddress, paymentMethod, promo } = req.body;
        if (!paymentMethod) return res.status(400).json({ message: "Payment method required" });
        const cart = await Cart.findOne({ user: user._id || user.id });
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(400).json({
                message: "Your cart is empty. Add items to cart first"
            });
        }
        if (!shippingAddress) return res.status(400).json({ message: "Shipping address required" });
        const requiredAddressFields = ['phone', 'address', 'city', 'country'];
        for (const field of requiredAddressFields) {
            if (!shippingAddress[field]) {
                return res.status(400).json({
                    message: `Shipping address ${field} is required`
                });
            }
        }
        let subtotal = 0;
        const orderItems = [];
        for (const cartItem of cart.items) {
            const product = await Product.findById(cartItem.product);
            if (!product) {
                return res.status(404).json({
                    message: `Product ${cartItem.product} not found or has been removed`
                });
            }
            if (product.stockQuantity < cartItem.quantity) {
                return res.status(400).json({
                    message: `Not enough stock for ${product.name}. Available: ${product.stockQuantity}, Requested: ${cartItem.quantity}`
                });
            }
            if (product.visibility !== "Published" || product.isDeleted) {
                return res.status(400).json({
                    message: `Product ${product.name} is not available for purchase`
                });
            }
            const itemPrice = product.price;
            subtotal += itemPrice * cartItem.quantity;
            orderItems.push({
                product: cartItem.product,
                name: product.name,
                quantity: cartItem.quantity,
                price: itemPrice,
                condition: product.condition || 'New'
            });
            product.stockQuantity -= cartItem.quantity;
            product.sold += cartItem.quantity;
            await product.save();
        }
        let discount = 0;
        let promoApplied = null;
        if (promo) {
            const promoDoc = await Promotion.findOne({
                code: promo.toUpperCase(),
                active: true
            });
            if (promoDoc) {
                const now = new Date();
                if (promoDoc.startDate <= now && promoDoc.endDate >= now) {
                    if (!promoDoc.minPurchase || subtotal >= promoDoc.minPurchase) {
                        if (promoDoc.totalUsageLimit && promoDoc.usedCount >= promoDoc.totalUsageLimit) {
                            return res.status(400).json({
                                message: "Promo code usage limit reached"
                            });
                        }
                        const userUsage = promoDoc.usedBy.find(u => u.user.toString() === user.id);
                        if (promoDoc.usageLimitPerUser && userUsage && userUsage.count >= promoDoc.usageLimitPerUser) {
                            return res.status(400).json({
                                message: "You have reached your usage limit for this promo"
                            });
                        }
                        if (promoDoc.type === "Percentage") {
                            discount = (subtotal * promoDoc.value) / 100;
                        } else if (promoDoc.type === "Fixed") {
                            discount = Math.min(promoDoc.value, subtotal);
                        } else if (promoDoc.type === "FreeShipping") {
                            discount = 10;
                        }
                        if (!userUsage) {
                            promoDoc.usedBy.push({ user: user.id, count: 1 });
                        } else {
                            userUsage.count += 1;
                        }
                        promoDoc.usedCount += 1;
                        await promoDoc.save();
                        promoApplied = promoDoc.code;
                    }
                }
            }
        }
        const VAT = subtotal * 0.14;
        const deliveryFee = 10;
        const totalAmount = subtotal + VAT + deliveryFee - discount;
        const paymentStatus = paymentMethod === 'Online' ? 'Paid' : 'Pending';
        let generatedOrderNumber;
        let isUnique = false;
        while (!isUnique) {
            const prefix = "ORD";
            const random = Math.floor(1000 + Math.random() * 9000);
            const timestamp = Date.now().toString().slice(-6);
            generatedOrderNumber = `${prefix}-${timestamp}-${random}`;
            const existingOrder = await Order.findOne({ orderNumber: generatedOrderNumber });
            if (!existingOrder) isUnique = true;
        }
        const estimatedDate = new Date();
        let daysAdded = 0;
        while (daysAdded < 5) {
            estimatedDate.setDate(estimatedDate.getDate() + 1);
            if (estimatedDate.getDay() !== 0 && estimatedDate.getDay() !== 6) {
                daysAdded++;
            }
        }
        const newOrder = new Order({
            user: user._id || user.id,
            orderNumber: generatedOrderNumber,
            estimatedDeliveryDate: estimatedDate,
            items: orderItems,
            shippingAddress: {
                address: shippingAddress.address,
                city: shippingAddress.city,
                governorate: shippingAddress.governorate,
                postalCode: shippingAddress.postalCode || "00000",
                country: shippingAddress.country,
                phone: shippingAddress.phone
            },
            paymentMethod: paymentMethod,
            paymentStatus: paymentMethod === 'Online' ? 'Paid' : 'Pending',
            totalAmount: totalAmount,
            VAT: VAT,
            deliveryFee: deliveryFee,
            discount: discount,
            orderStatus: 'Order Placed'
        });
        await newOrder.save();
        cart.items = [];
        await cart.save();
        res.status(201).json({
            success: true,
            message: "Order placed successfully",
            order: {
                orderNumber: newOrder.orderNumber,
                totalAmount: newOrder.totalAmount,
                estimatedDeliveryDate: newOrder.estimatedDeliveryDate,
                paymentStatus: newOrder.paymentStatus,
                status: newOrder.orderStatus,
                discountApplied: discount > 0 ? discount : 0,
                promoCode: promoApplied,
                cartCleared: true
            }
        });
    } catch (err) {
        console.error("Order creation error:", err);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

const adminCreateOrder = async (req, res) => {
    try {
        const {
            userId,
            items,
            shippingAddress,
            paymentMethod,
            deliveryMethod = 'standard',
            internalNotes
        } = req.body;
        if (!userId || !items || items.length === 0 || !shippingAddress || !shippingAddress.governorate || !paymentMethod) {
            return res.status(400).json({ message: "Missing required fields (userId, items, shippingAddress.governorate, paymentMethod)." });
        }
        const governateInfo = await Governate.findOne({ name: shippingAddress.governorate });
        if (!governateInfo) {
            return res.status(400).json({ message: `Invalid governorate name: ${shippingAddress.governorate} or not found.` });
        }
        let itemsForCalculation = [];
        let orderItems = [];
        for (const item of items) {
            const productDoc = await Product.findById(item.product);
            if (!productDoc || productDoc.stockQuantity < item.quantity) {
                return res.status(400).json({ message: `Insufficient stock for product: ${productDoc?.name || item.product}` });
            }
            itemsForCalculation.push({
                priceAtPurchase: productDoc.price,
                quantity: item.quantity
            });
            orderItems.push({
                product: item.product,
                quantity: item.quantity,
                priceAtPurchase: productDoc.price,
                name: productDoc.name,
                condition: item.condition || 'New'
            });
        }
        const totals = calculateAdminOrderTotals(
            itemsForCalculation,
            governateInfo,
            deliveryMethod
        );
        const generatedOrderNumber = `ADM-${Date.now()}`;
        const estimatedDate = calculateDeliveryDate(governateInfo, deliveryMethod);
        const newOrder = new Order({
            user: userId,
            orderNumber: generatedOrderNumber,
            estimatedDeliveryDate: estimatedDate,
            deliveryMethod: deliveryMethod,
            items: orderItems,
            shippingAddress: {
                address: shippingAddress.address,
                governorate: shippingAddress.governorate,
                city: shippingAddress.city,
                postalCode: shippingAddress.postalCode || "00000",
                country: shippingAddress.country,
                phone: shippingAddress.phone
            },
            paymentMethod: paymentMethod,
            paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Processing',
            totalAmount: totals.total,
            VAT: totals.VAT,
            deliveryFee: totals.deliveryFee,
            discount: discount,
            status: "Order Placed by Admin",
            isCreatedByAdmin: true,
            internalNotes: internalNotes
        });
        await newOrder.save();
        for (const item of orderItems) {
            await Product.findByIdAndUpdate(item.product, {
                $inc: { stockQuantity: -item.quantity }
            });
        }
        res.status(201).json({
            success: true,
            message: "Order created successfully by Admin.",
            order: newOrder
        });
    } catch (err) {
        console.error("Admin Order Creation Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const getOrders = async (req, res) => {
    try {
        const user = req.user;
        const userId = user._id ? user._id.toString() : user.id.toString();
        let query = {};
        if (user.role === "admin" || user.role === "support") {
            const { status, paymentMethod, orderNumber, dateFrom, dateTo } = req.query;
            if (status) query.status = status;
            if (paymentMethod) query.paymentMethod = paymentMethod;
            if (orderNumber) query.orderNumber = orderNumber;
            if (dateFrom || dateTo) {
                query.createdAt = {};
                if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
                if (dateTo) query.createdAt.$lte = new Date(dateTo);
            }
        } else {
            query.user = userId;
        }
        const orders = await Order.find(query)
            .populate("items.product", "name price images")
            .populate("user", "name email phone")
            .sort({ createdAt: -1 });
        res.json({
            count: orders.length,
            orders
        });
    } catch (err) {
        console.error("getOrders Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const getOrderById = async (req, res) => {
    try {
        const user = req.user;
        const userId = user._id ? user._id.toString() : user.id.toString();
        const order = await Order.findById(req.params.id)
            .populate("items.product", "name price images")
            .populate("user", "name email");
        if (!order) return res.status(404).json({ message: "Order not found" });
        const orderOwnerId = order.user._id.toString();
        if (user.role !== "admin" && user.role !== "support" && orderOwnerId !== userId) {
            return res.status(403).json({ message: "Access denied" });
        }
        res.json(order);
    } catch (err) {
        console.error("getOrderById Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const cancelOrder = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { reason } = req.body;
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (req.user.role !== "admin" && order.user.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Access denied" });
        }
        if (['Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'].includes(order.orderStatus)) {
            return res.status(400).json({ message: "Cannot cancel order at this stage." });
        }
        order.orderStatus = 'Cancelled';
        order.isCancelled = true;
        order.cancellationReason = reason || 'Other';
        order.cancellationDate = Date.now();
        if (order.paymentMethod === 'Online' && order.paymentStatus === 'Paid') {
            order.paymentStatus = 'Refunded';
        }
        for (const item of order.items) {
            const product = await Product.findById(item.product);
            if (product) {
                product.stockQuantity += item.quantity;
                await product.save();
            }
        }
        await order.save();
        res.json({ message: "Order cancelled successfully", order });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const requestReturn = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { reason, comment } = req.body;
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (order.user.toString() !== userId.toString())
            return res.status(403).json({ message: "Access denied" });
        if (order.orderStatus !== 'Delivered')
            return res.status(400).json({ message: "Order not delivered yet" });
        const proofImages = req.files?.map(file => file.path) || [];
        order.isReturnRequested = true;
        order.returnDetails = {
            reason,
            comment,
            proofImages,
            requestDate: Date.now(),
            status: 'Return Requested'
        };
        await order.save();
        res.json({ message: "Return requested successfully", order });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { status, trackingNumber, internalNotes } = req.body;
        const order = await Order.findById(req.params.id)
            .populate('user', 'email name');
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (req.user.role !== "admin" && req.user.role !== "support") {
            return res.status(403).json({ message: "Access denied" });
        }
        const oldStatus = order.orderStatus;
        if (status) order.orderStatus = status;
        if (internalNotes) {
            order.internalNotes = internalNotes;
        }
        if (status === 'Shipped' && trackingNumber) {
            order.trackingNumber = trackingNumber;
        }
        if (status === 'Delivered') {
            order.actualDeliveryDate = Date.now();
            order.paymentStatus = 'Paid';
            if (typeof sendOrderStatusEmail === 'function') {
                await sendOrderStatusEmail(
                    order.user.email, order.user.name, order.orderNumber, status
                );
            }
        }
        if ((status === 'Cancelled' || status === 'Returned') && (oldStatus !== 'Cancelled' && oldStatus !== 'Returned')) {
            for (const item of order.items) {
                await Product.findByIdAndUpdate(item.product, {
                    $inc: {
                        stockQuantity: item.quantity,
                        sold: -item.quantity
                    }
                });
            }
            if (typeof sendOrderStatusEmail === 'function') {
                await sendOrderStatusEmail(
                    order.user.email, order.user.name, order.orderNumber, status
                );
            }
        }
        await order.save();
        if (status === 'Out for Delivery') {
            if (typeof sendOrderStatusEmail === 'function') {
                await sendOrderStatusEmail(
                    order.user.email,
                    order.user.name,
                    order.orderNumber,
                    status
                );
            }
        }
        res.json({ message: "Order status updated successfully", order });
    } catch (err) {
        console.error("Update Status Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const deleteOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (req.user.role !== "admin") return res.status(403).json({ message: "Access denied" });
        for (const item of order.items) {
            const product = await Product.findById(item.product);
            if (product) {
                product.stockQuantity += item.quantity;
                await product.save();
            }
        }
        await order.deleteOne();
        res.json({ message: "Order deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const getUserReturnRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });
        const ordersWithReturn = await Order.find({
            user: userId,
            isReturnRequested: true
        })
            .select('orderNumber returnDetails items')
            .populate('items.product', 'name images price');
        res.status(200).json({ count: ordersWithReturn.length, orders: ordersWithReturn });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const getOrdersByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const orders = await Order.find({ user: userId })
            .populate("items.product", "name price images");
        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    createOrder,
    getOrders,
    getOrderById,
    cancelOrder,
    requestReturn,
    updateOrderStatus,
    deleteOrder,
    adminCreateOrder,
    getUserReturnRequests,
    getOrdersByUserId
};