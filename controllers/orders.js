const Order = require('../models/orders');
const Promo = require('../models/promos');
const Product = require('../models/products');

const createOrder = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Authentication required" });

        const { items, shippingAddress, paymentMethod, promo } = req.body;
        if (!items || !items.length) return res.status(400).json({ message: "No items provided" });
        if (!paymentMethod) return res.status(400).json({ message: "Payment method required" });

        let subtotal = 0;
        for (const item of items) {
            const product = await Product.findById(item.product);
            if (!product) return res.status(404).json({ message: `Product ${item.product} not found` });
            if (product.stockQuantity < item.quantity) return res.status(400).json({ message: `Not enough stock for ${product.name}` });
            subtotal += item.price * item.quantity;
            product.stockQuantity -= item.quantity;
            await product.save();
        }

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

        const newOrder = new Order({
            user: user._id,
            items,
            shippingAddress,
            paymentMethod,
            totalAmount,
            VAT,
            deliveryFee,
            status: "Placed"
        });

        await newOrder.save();
        res.status(201).json({ message: "Order placed successfully", order: newOrder });

    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
};

const getOrders = async (req, res) => {
    try {
        let orders;
        if (req.user.role === "admin") {
            orders = await Order.find().populate("items.product").populate("user");
        } else {
            orders = await Order.find({ user: req.user._id }).populate("items.product");
        }
        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
};

const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate("items.product").populate("user");
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (req.user.role !== "admin" && order.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Access denied" });
        res.json(order);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
};

const updateOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (req.user.role !== "admin" && order.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Access denied" });

        const allowedUpdates = ["status", "paymentMethod", "orderNotes", "returnRequest"];
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) order[field] = req.body[field];
        });

        await order.save();
        res.json({ message: "Order updated successfully", order });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
};

const deleteOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (req.user.role !== "admin" && order.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Access denied" });

        for (const item of order.items) {
            const product = await Product.findById(item.product);
            if (product) {
                product.stockQuantity += item.quantity;
                await product.save();
            }
        }

        await order.remove();
        res.json({ message: "Order deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
};

module.exports = {
    createOrder,
    getOrders,
    getOrderById,
    updateOrder,
    deleteOrder
};
