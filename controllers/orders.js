const Order = require('../models/orders');
const Promo = require('../models/promos');
const Product = require('../models/products');
// تأكدي من مسار ملف الإيميل
const { sendOrderStatusEmail } = require('../utilities/email');

// 1. Create Order
const createOrder = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Authentication required" });

        const { items: rawItems, shippingAddress, paymentMethod, promo } = req.body;
        
        if (!rawItems || !rawItems.length) return res.status(400).json({ message: "No items provided" });
        if (!paymentMethod) return res.status(400).json({ message: "Payment method required" });

        let subtotal = 0;
        const orderItems = [];

        // 1. معالجة المنتجات والمخزون
        for (const rawItem of rawItems) {
            const product = await Product.findById(rawItem.product);
            if (!product) return res.status(404).json({ message: `Product ${rawItem.product} not found` });
            if (product.stockQuantity < rawItem.quantity) return res.status(400).json({ message: `Not enough stock for ${product.name}` });

            const itemPrice = product.price; 
            subtotal += itemPrice * rawItem.quantity;
            
            orderItems.push({
                product: rawItem.product,
                name: product.name,
                quantity: rawItem.quantity,
                price: itemPrice, 
                condition: rawItem.condition || 'New'
            });

            // خصم المخزون
            product.stockQuantity -= rawItem.quantity;
            await product.save();
        }

        // 2. منطق الخصم (Promo)
        let discount = 0;
        if (promo) {
             const promoDoc = await Promo.findOne({ code: promo, active: true });
             if (promoDoc) {
                const now = new Date();
                if (promoDoc.startDate <= now && promoDoc.endDate >= now) {
                    if (!promoDoc.minPurchase || subtotal >= promoDoc.minPurchase) {
                        if (promoDoc.type === "Percentage") {
                            discount = (subtotal * promoDoc.value) / 100;
                            if (promoDoc.maxDiscount) discount = Math.min(discount, promoDoc.maxDiscount);
                        } else if (promoDoc.type === "Fixed") {
                            discount = promoDoc.value;
                        }
                    }
                }
             }
        }

        const VAT = subtotal * 0.14;
        const deliveryFee = 10;
        const totalAmount = subtotal + VAT + deliveryFee - discount;
        const paymentStatus = paymentMethod === 'Online' ? 'Paid' : 'Pending';

        // ==========================================================
        // 👇👇 الهاندلة اليدوية هنا بدلاً من المودل (New Logic) 👇👇
        // ==========================================================
        
        // أ) توليد رقم طلب عشوائي (Unique)
        const prefix = "ORD";
        const random = Math.floor(1000 + Math.random() * 9000);
        const timestamp = Date.now().toString().slice(-6); // آخر 6 أرقام من الوقت
        const generatedOrderNumber = `${prefix}-${timestamp}-${random}`;

        // ب) حساب تاريخ التوصيل المتوقع (بعد 5 أيام)
        const estimatedDate = new Date();
        estimatedDate.setDate(estimatedDate.getDate() + 5);
        // ==========================================================

        const newOrder = new Order({
            user: user._id||user.id, 
            orderNumber: generatedOrderNumber, // 👈 بنبعته هنا
            estimatedDeliveryDate: estimatedDate, // 👈 وبنبعت التاريخ هنا
            items: orderItems,
            shippingAddress,
            paymentMethod,
            paymentStatus,
            totalAmount,
            VAT,
            deliveryFee,
            discount,
            status: "Order Placed"
        });

        await newOrder.save(); 
        res.status(201).json({ message: "Order placed successfully", order: newOrder });

    } catch (err) {
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
        const userId= req.user._id||req.user.id;
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
        const userId= req.user._id||req.user.id;
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
    deleteOrder
};