const Order = require('../models/orders');
const Promo = require('../models/promos');
const Product = require('../models/products');
// استدعاء دالة الإيميل (تأكدي أن المسار صحيح)
const { sendOrderStatusEmail } = require('../utilities/email');

// 1. Create Order (مع منطق الخصم والمخزون)
const createOrder = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Authentication required" });

        const { items: rawItems, shippingAddress, paymentMethod, promo } = req.body; // تغيير اسم items إلى rawItems
        if (!rawItems || !rawItems.length) return res.status(400).json({ message: "No items provided" });
        if (!paymentMethod) return res.status(400).json({ message: "Payment method required" });

        let subtotal = 0;
        const orderItems = []; // مصفوفة جديدة للعناصر بعد التحقق من السعر والمخزون

        // التحقق من المنتجات والمخزون وحساب المجموع
        for (const rawItem of rawItems) {
            const product = await Product.findById(rawItem.product);

            if (!product) return res.status(404).json({ message: `Product ${rawItem.product} not found` });
            if (product.stockQuantity < rawItem.quantity) return res.status(400).json({ message: `Not enough stock for ${product.name}` });

            // 🛑 1. جلب السعر من المنتج (السيرفر) بدلاً من الـ body
            const itemPrice = product.price;

            // 2. حساب المجموع الفرعي
            subtotal += itemPrice * rawItem.quantity;

            // 3. بناء كائن العنصر لـ OrderSchema (Snapshot)
            orderItems.push({
                product: rawItem.product,
                name: product.name, // جلب الاسم من المنتج
                quantity: rawItem.quantity,
                price: itemPrice, // 🚀 السعر مأخوذ من قاعدة البيانات
                // يجب أن يتم جلب condition من مودل المنتج إذا كان موجوداً
                condition: rawItem.condition || 'New'
            });

            // 4. خصم الكمية من المخزون
            product.stockQuantity -= rawItem.quantity;
            await product.save();
        }

        // منطق الخصم (Promo Code) - كما هو
        let discount = 0;
        if (promo) {
            const promoDoc = await Promo.findOne({ code: promo, active: true });
            if (!promoDoc) return res.status(400).json({ message: "Invalid promo code" });
            const now = new Date();
            if (promoDoc.startDate > now || promoDoc.endDate < now) return res.status(400).json({ message: "Promo code not valid at this time" });
            if (promoDoc.minPurchase && subtotal < promoDoc.minPurchase) return res.status(400).json({ message: `Order must be at least ${promoDoc.minPurchase} for this promo` });

            if (promoDoc.type === "Percentage") {
                discount = (subtotal * promoDoc.value) / 100;
                if (promoDoc.maxDiscount) discount = Math.min(discount, promoDoc.maxDiscount);
            } else if (promoDoc.type === "Fixed") {
                discount = promoDoc.value;
            }
        }

        const VAT = subtotal * 0.14;
        const deliveryFee = 10;
        const totalAmount = subtotal + VAT + deliveryFee - discount;

        // تحديد حالة الدفع المبدئية
        const paymentStatus = paymentMethod === 'Online' ? 'Paid' : 'Pending';

        const newOrder = new Order({
            user: user.id,
            items: orderItems, // 🚀 استخدام مصفوفة العناصر الجديدة
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
        // ... (معالجة الأخطاء)
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// 2. Get Orders
const getOrders = async (req, res) => {
    try {
        let orders;
        if (req.user.role === "admin" || req.user.role === "support") {
            orders = await Order.find()
                .populate("items.product", "name price images")
                .populate("user", "name email")
                .sort({ createdAt: -1 });
        } else {
            // ✅ توحيد استخدام req.user.id
            orders = await Order.find({ user: req.user.id })
                .populate("items.product", "name price images")
                .populate("user", "name email")
                .sort({ createdAt: -1 });
        }
        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// 3. Get Order By ID
const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate("items.product", "name price images")
            .populate("user", "name email");

        if (!order) return res.status(404).json({ message: "Order not found" });

        // ✅ توحيد استخدام req.user.id
        if (req.user.role !== "admin" && req.user.role !== "support" && order.user._id.toString() !== req.user.id.toString()) {
            return res.status(403).json({ message: "Access denied" });
        }
        res.json(order);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// 4. Cancel Order (User Logic)
const cancelOrder = async (req, res) => {
    try {
        const { reason } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) return res.status(404).json({ message: "Order not found" });

        // ✅ توحيد استخدام req.user.id
        if (req.user.role !== "admin" && order.user.toString() !== req.user.id.toString()) {
            return res.status(403).json({ message: "Access denied" });
        }

        // ... (منطق الإلغاء كما هو) ...
        if (['Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'].includes(order.status)) {
            return res.status(400).json({ message: "Cannot cancel order at this stage." });
        }

        order.status = 'Cancelled';
        order.isCancelled = true;
        order.cancellationReason = reason || 'Changed my mind';
        order.cancellationDate = Date.now();

        if (order.paymentMethod === 'Online' && order.paymentStatus === 'Paid') {
            order.paymentStatus = 'Refunded';
        }

        // إعادة المنتجات للمخزون
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

// 5. Request Return (User Logic)
const requestReturn = async (req, res) => {
    try {
        const { reason, comment, proofImages } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) return res.status(404).json({ message: "Order not found" });
        // ✅ توحيد استخدام req.user.id
        if (order.user.toString() !== req.user.id.toString()) return res.status(403).json({ message: "Access denied" });

        // ... (منطق الإرجاع كما هو) ...
        if (order.status !== 'Delivered') {
            return res.status(400).json({ message: "Cannot return an item that hasn't been delivered." });
        }

        // التحقق من فترة الـ 7 أيام
        const deliveryDate = new Date(order.actualDeliveryDate || order.updatedAt);
        const currentDate = new Date();
        const diffDays = Math.ceil(Math.abs(currentDate - deliveryDate) / (1000 * 60 * 60 * 24));

        if (diffDays > 7) {
            return res.status(400).json({ message: "Return period (7 days) has expired." });
        }

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

// 6. Update Order Status (Admin Logic)
const updateOrderStatus = async (req, res) => {
    try {
        const { status, trackingNumber } = req.body;
        const order = await Order.findById(req.params.id).populate('user', 'email name');

        if (!order) return res.status(404).json({ message: "Order not found" });

        // الحماية: أدمن فقط
        if (req.user.role !== "admin" && req.user.role !== "support") {
            return res.status(403).json({ message: "Access denied" });
        }
        // ... (بقية منطق تحديث الحالة كما هو) ...

        order.status = status;

        if (status === 'Shipped' && trackingNumber) {
            order.trackingNumber = trackingNumber;
        }

        if (status === 'Delivered') {
            order.actualDeliveryDate = Date.now();
            order.paymentStatus = 'Paid';
        }

        await order.save();

        // إرسال الإشعار
        if (status === 'Out for Delivery') {
            await sendOrderStatusEmail(
                order.user.email,
                order.user.name,
                order.orderNumber || order._id, // نستخدم رقم الطلب أو الآيدي
                status
            );
        }

        res.json({ message: "Order status updated", order });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// 7. Delete Order (Admin Only)
const deleteOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: "Order not found" });

        if (req.user.role !== "admin") return res.status(403).json({ message: "Access denied" });

        // إعادة المخزون قبل الحذف
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