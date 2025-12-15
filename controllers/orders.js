const Order = require('../models/orders');
const Promotion = require('../models/promos');
const Product = require('../models/products');
const Cart = require('../models/carts');
const Governates = require('../models/governates');
// تأكدي من مسار ملف الإيميل
const { sendOrderStatusEmail } = require('../utilities/email');

const calculateDeliveryDate = (governate, deliveryType = 'standard') => {
    const today = new Date();
    let deliveryDays = governate.diliveryTime || 5; 

    if (deliveryType === 'express') {
         deliveryDays = Math.max(1, deliveryDays - 1); // الشحن السريع يقلل يوم بحد أدنى يوم واحد
    }
    
    let daysAdded = 0;
    const estimatedDate = new Date(today);
    
    // يضيف عدد الأيام المحددة، متجاهلاً عطلات نهاية الأسبوع (السبت والأحد)
    while (daysAdded < deliveryDays) {
        estimatedDate.setDate(estimatedDate.getDate() + 1);
        // Skip weekends (0 = Sunday, 6 = Saturday)
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
        // item: { priceAtPurchase, quantity }
        subtotal += item.priceAtPurchase * item.quantity; 
    });

    let deliveryFee = governate?.fee || 0;
    if (deliveryMethod === 'express') {
        deliveryFee = Math.round(deliveryFee * 1.5); // زيادة 50% للشحن السريع
    }
    
    const VAT = subtotal * vatRate;
    const total = subtotal + deliveryFee + VAT;

    return { subtotal, deliveryFee, VAT, total };
};
// 1. Create Order
// 1. Create Order
const createOrder = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Authentication required" });

        const { shippingAddress, paymentMethod, promo } = req.body;

        if (!paymentMethod) return res.status(400).json({ message: "Payment method required" });

        // Get user's cart
        const cart = await Cart.findOne({ user: user._id || user.id });

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(400).json({
                message: "Your cart is empty. Add items to cart first"
            });
        }

        // Validate shipping address
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

        // Process items from cart
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

            // Deduct stock and update sold count
            product.stockQuantity -= cartItem.quantity;
            product.sold += cartItem.quantity;
            await product.save();
        }

        // Promo logic
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

                        // Check usage limits
                        if (promoDoc.totalUsageLimit && promoDoc.usedCount >= promoDoc.totalUsageLimit) {
                            return res.status(400).json({
                                message: "Promo code usage limit reached"
                            });
                        }

                        // Check user usage limit
                        const userUsage = promoDoc.usedBy.find(u => u.user.toString() === user.id);
                        if (promoDoc.usageLimitPerUser && userUsage && userUsage.count >= promoDoc.usageLimitPerUser) {
                            return res.status(400).json({
                                message: "You have reached your usage limit for this promo"
                            });
                        }

                        // Apply discount based on type
                        if (promoDoc.type === "Percentage") {
                            discount = (subtotal * promoDoc.value) / 100;
                        } else if (promoDoc.type === "Fixed") {
                            discount = Math.min(promoDoc.value, subtotal);
                        } else if (promoDoc.type === "FreeShipping") {
                            discount = 10; // delivery fee
                        }

                        // Record usage
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

        // Generate unique order number
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

        // Calculate estimated delivery date (5 business days)
        const estimatedDate = new Date();
        let daysAdded = 0;
        while (daysAdded < 5) {
            estimatedDate.setDate(estimatedDate.getDate() + 1);
            // Skip weekends (0 = Sunday, 6 = Saturday)
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
                postalCode: shippingAddress.postalCode || "00000",
                country: shippingAddress.country,
                phone: shippingAddress.phone
            },
            paymentMethod: paymentMethod,
            paymentStatus: paymentStatus,
            totalAmount: totalAmount,
            VAT: VAT,
            deliveryFee: deliveryFee,
            discount: discount,
            status: "Order Placed"
        });

        await newOrder.save();

        // Clear the cart after successful order
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
                status: newOrder.status,
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
        // 1. استخراج البيانات من جسم الطلب
        const {
            userId, // 🛑 ID العميل
            items, // [ { product: ID, quantity: N, condition: 'New' } ]
            shippingAddress, 
            paymentMethod,
            deliveryMethod = 'standard',
            internalNotes // FR-A17: ملاحظات داخلية
        } = req.body;

        // 2. التحقق من البيانات المطلوبة
        if (!userId || !items || items.length === 0 || !shippingAddress || !shippingAddress.governorate || !paymentMethod) {
            return res.status(400).json({ message: "Missing required fields (userId, items, shippingAddress.governorate, paymentMethod)." });
        }
        
        // 3. جلب معلومات المحافظة (لحساب الشحن ولحل مشكلة Governate is not defined)
        const governateInfo = await Governate.findOne({ name: shippingAddress.governorate });
        if (!governateInfo) {
            return res.status(400).json({ message: `Invalid governorate name: ${shippingAddress.governorate} or not found.` });
        }
        
        // 4. التحقق من المخزون وتجهيز بيانات الأصناف
        let itemsForCalculation = [];
        let orderItems = [];
        
        for (const item of items) {
            const productDoc = await Product.findById(item.product);
            
            // تحقق من وجود المنتج وكمية المخزون
            if (!productDoc || productDoc.stockQuantity < item.quantity) {
                 return res.status(400).json({ message: `Insufficient stock for product: ${productDoc?.name || item.product}` });
            }
            
            itemsForCalculation.push({ 
                priceAtPurchase: productDoc.price, 
                quantity: item.quantity 
            });
            
            // تجهيز العنصر للحفظ في موديل Order (باستخدام السعر الحالي)
            orderItems.push({
                product: item.product,
                quantity: item.quantity,
                priceAtPurchase: productDoc.price, 
                name: productDoc.name,
                condition: item.condition || 'New'
            });
        }

        // 5. حساب الإجماليات
        const totals = calculateAdminOrderTotals(
            itemsForCalculation,
            governateInfo, 
            deliveryMethod
        );

        // 6. إنشاء رقم الطلب وتاريخ التسليم
        // 🛑 استخدم رقم طلب مميز لطلبات الأدمن
        const generatedOrderNumber = `ADM-${Date.now()}`; 
        const estimatedDate = calculateDeliveryDate(governateInfo, deliveryMethod);

        // 7. إنشاء الطلب في قاعدة البيانات
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
            paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Processing', // إذا كان اونلاين، يجب أن يكون هناك تأكيد للدفع
            totalAmount: totals.total,
            VAT: totals.VAT,
            deliveryFee: totals.deliveryFee,
            discount: discount, 
            status: "Order Placed by Admin",
            isCreatedByAdmin: true,
            internalNotes: internalNotes // حفظ ملاحظات الأدمن
        });
        
        await newOrder.save();
        
        // 8. تخفيض المخزون
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
        // يمكنك إرجاع رسالة خطأ أكثر تفصيلاً في بيئة التطوير
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
// 2. Get Orders (FR-O1, FR-O6)
// 2. Get Orders (FR-O1: عرض الطلبات)
// 2. Get Orders (Updated for FR-A14)
const getOrders = async (req, res) => {
    try {
        const user = req.user;

        // 1. استخراج الـ ID بأمان (كما هو)
        const userId = user._id ? user._id.toString() : user.id.toString();

        let query = {}; // كائن البحث الأساسي

        // 2. تحديد الصلاحيات وبناء الاستعلام (Query Building)
        if (user.role === "admin" || user.role === "support") {
            // === منطق الأدمن (FR-A14: Filters) ===

            // استقبال الفلاتر من الرابط (Query Params)
            const { status, paymentMethod, orderNumber, dateFrom, dateTo } = req.query;

            // أ) فلتر الحالة (Pending, Shipped, etc.)
            if (status) query.status = status;

            // ب) فلتر طريقة الدفع (Cash, Card)
            if (paymentMethod) query.paymentMethod = paymentMethod;

            // ج) البحث برقم الطلب (Exact Match)
            if (orderNumber) query.orderNumber = orderNumber;

            // د) فلتر النطاق الزمني (Date Range)
            if (dateFrom || dateTo) {
                query.createdAt = {};
                if (dateFrom) query.createdAt.$gte = new Date(dateFrom); // من تاريخ
                if (dateTo) query.createdAt.$lte = new Date(dateTo);     // إلى تاريخ
            }

            // هـ) يمكن إضافة البحث باسم العميل هنا (يحتاج Aggregation متقدم، لكن الفلاتر أعلاه كافية حالياً)

        } else {
            // === منطق المشتري (Buyer Logic) ===
            // العميل يرى فقط الطلبات المرتبطة بالـ ID الخاص به
            query.user = userId;
        }

        // 3. تنفيذ البحث (Unified Execution)
        const orders = await Order.find(query)
            .populate("items.product", "name price images") // تفاصيل المنتج
            .populate("user", "name email phone")          // تفاصيل العميل (مهمة للأدمن)
            .sort({ createdAt: -1 });                      // الأحدث أولاً

        // 4. الإرجاع (أضفت الـ count لتسهيل العرض في الفرونت)
        res.json({
            count: orders.length,
            orders
        });

    } catch (err) {
        console.error("getOrders Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// 3. Get Order By ID (FR-O2: تفاصيل الطلب)
const getOrderById = async (req, res) => {
    try {
        const user = req.user;
        const userId = user._id ? user._id.toString() : user.id.toString();

        // جلب الطلب وعمل Populate لبيانات اليوزر
        const order = await Order.findById(req.params.id)
            .populate("items.product", "name price images")
            .populate("user", "name email");

        if (!order) return res.status(404).json({ message: "Order not found" });

        // 🛑 التصحيح الجوهري هنا 👇👇
        // بما أننا عملنا populate('user')، الـ order.user أصبح "Object" كامل مش مجرد ID
        // واسم الحقل في المودل هو 'user' وليس 'userId'
        const orderOwnerId = order.user._id.toString();

        // التحقق من الصلاحية: (لو مش أدمن/دعم فني) AND (الآيدي لا يطابق صاحب الطلب)
        if (user.role !== "admin" && user.role !== "support" && orderOwnerId !== userId) {
            return res.status(403).json({ message: "Access denied" });
        }

        res.json(order);
    } catch (err) {
        console.error("getOrderById Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
// 4. Cancel Order (FR-O10, FR-O11, FR-O12)
const cancelOrder = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { reason } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) return res.status(404).json({ message: "Order not found" });

        if (req.user.role !== "admin" && order.user.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Access denied" });
        }

        // FR-O10: Cancel only before shipping
        if (['Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'].includes(order.status)) {
            return res.status(400).json({ message: "Cannot cancel order at this stage." });
        }

        order.status = 'Cancelled';
        order.isCancelled = true;
        order.cancellationReason = reason || 'Other';
        order.cancellationDate = Date.now();

        // FR-O12: Refund Logic
        if (order.paymentMethod === 'Online' && order.paymentStatus === 'Paid') {
            order.paymentStatus = 'Refunded';
        }

        // Return stock
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

// 5. Request Return (FR-O13 to FR-O16)
const requestReturn = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { reason, comment, proofImages } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) return res.status(404).json({ message: "Order not found" });
        if (order.user.toString() !== userId.toString()) return res.status(403).json({ message: "Access denied" });

        if (order.status !== 'Delivered') {
            return res.status(400).json({ message: "Cannot return an item that hasn't been delivered." });
        }

        // FR-O13: 7 days check
        const deliveryDate = new Date(order.actualDeliveryDate || order.updatedAt);
        const currentDate = new Date();
        const diffDays = Math.ceil(Math.abs(currentDate - deliveryDate) / (1000 * 60 * 60 * 24));

        if (diffDays > 7) {
            return res.status(400).json({ message: "Return period (7 days) has expired." });
        }

        // FR-O15: Images required
        if (!proofImages || proofImages.length === 0) {
            return res.status(400).json({ message: "Proof images are required." });
        }

        order.isReturnRequested = true;
        order.returnDetails = {
            reason, comment, proofImages,
            requestDate: Date.now(),
            status: 'Return Requested'
        };

        await order.save();
        res.json({ message: "Return requested successfully", order });

    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// 6. Update Order Status (Admin) - FR-O3, FR-O5, FR-O9
// 3. Update Order Status (Admin/Support Only)
const updateOrderStatus = async (req, res) => {
    try {
        // 1. استقبال البيانات الجديدة (الحالة، التتبع، والملاحظات الداخلية)
        const { status, trackingNumber, internalNotes } = req.body;

        const order = await Order.findById(req.params.id)
            .populate('user', 'email name');

        if (!order) return res.status(404).json({ message: "Order not found" });

        // التحقق من الصلاحيات (Admin or Support)
        if (req.user.role !== "admin" && req.user.role !== "support") {
            return res.status(403).json({ message: "Access denied" });
        }

        // حفظ الحالة القديمة للمقارنة (مهم جداً لمنع تكرار استرجاع المخزون)
        const oldStatus = order.status;

        // تحديث الحالة
        if (status) order.status = status;

        // FR-A17: إضافة أو تحديث الملاحظات الداخلية للأدمن
        if (internalNotes) {
            order.internalNotes = internalNotes;
        }

        // FR-O5: تحديث رقم التتبع عند الشحن
        if (status === 'Shipped' && trackingNumber) {
            order.trackingNumber = trackingNumber;
        }

        // تحديث بيانات الدفع والتوصيل عند التسليم
        if (status === 'Delivered') {
            order.actualDeliveryDate = Date.now();
            order.paymentStatus = 'Paid';
        }

        // FR-A19: استرجاع المخزون (Restock) تلقائياً عند الإلغاء أو الإرجاع
        // الشرط: الحالة الجديدة "Cancelled/Returned" AND الحالة القديمة لم تكن كذلك
        if ((status === 'Cancelled' || status === 'Returned') && (oldStatus !== 'Cancelled' && oldStatus !== 'Returned')) {
            for (const item of order.items) {
                await Product.findByIdAndUpdate(item.product, {
                    $inc: {
                        stockQuantity: item.quantity, // نرجع الكمية للمخزن
                        sold: -item.quantity          // نقلل عداد المبيعات
                    }
                });
            }
        }

        await order.save();

        // FR-O9: Notification (Email) - الحفاظ على اللوجيك القديم
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

// 7. Delete Order
const deleteOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: "Order not found" });

        if (req.user.role !== "admin") return res.status(403).json({ message: "Access denied" });

        // Restock
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

module.exports = {
    createOrder,
    getOrders,
    getOrderById,
    cancelOrder,
    requestReturn,
    updateOrderStatus,
    deleteOrder,
    adminCreateOrder
};