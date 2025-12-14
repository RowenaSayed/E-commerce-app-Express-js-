const Cart = require('../models/carts');
const Product = require('../models/products');
const Governate = require('../models/governates');
const User = require('../models/users');
const Promotion = require('../models/promos'); 

// Helper function to calculate cart totals
const calculateCartTotals = (cart, governate, deliveryMethod = 'standard') => {
    let subtotal = 0;

    // Calculate subtotal
    cart.items.forEach(item => {
        if (item.product && item.product.price) {
            subtotal += item.product.price * item.quantity;
        }
    });

    // Get delivery fee based on governate
    let deliveryFee = governate?.fee || 0;

    // Apply express delivery fee (50% extra)
    if (deliveryMethod === 'express') {
        deliveryFee = Math.round(deliveryFee * 1.5);
    }

    // Calculate VAT (14% for Egypt)
    const vatRate = 0.14;
    const vat = subtotal * vatRate;

    // Calculate total
    const total = subtotal + deliveryFee + vat;

    return {
        subtotal,
        deliveryFee,
        vat,
        total,
        vatRate: vatRate * 100 // Return as percentage for display
    };
};

// Helper to calculate estimated delivery date
const calculateDeliveryDate = (governate, deliveryMethod = 'standard') => {
    const today = new Date();
    let deliveryDays = governate?.deliveryTime || 3;

    // Express delivery reduces time by 1 day (minimum 1 day)
    if (deliveryMethod === 'express') {
        deliveryDays = Math.max(1, deliveryDays - 1);
    }

    const deliveryDate = new Date(today);
    deliveryDate.setDate(today.getDate() + deliveryDays);

    // Skip weekends (optional)
    while (deliveryDate.getDay() === 0 || deliveryDate.getDay() === 6) {
        deliveryDate.setDate(deliveryDate.getDate() + 1);
    }

    return deliveryDate.toISOString().split('T')[0]; // Return as YYYY-MM-DD
};

// Helper to validate and apply promotion
const validateAndApplyPromotion = async (promotionCode, cart, userId) => {
    const now = new Date();

    // Find active promotion
    const promotion = await Promotion.findOne({
        code: promotionCode,
        active: true,
        startDate: { $lte: now },
        endDate: { $gte: now }
    });

    if (!promotion) {
        return { valid: false, message: "Invalid or expired promotion code" };
    }

    // Calculate cart subtotal
    let subtotal = 0;
    cart.items.forEach(item => {
        if (item.product && item.product.price) {
            subtotal += item.product.price * item.quantity;
        }
    });

    // Check minimum purchase
    if (promotion.minPurchase && subtotal < promotion.minPurchase) {
        return {
            valid: false,
            message: `Minimum purchase of ${promotion.minPurchase} EGP required`
        };
    }

    // Check total usage limit
    if (promotion.totalUsageLimit) {
        // In a real app, you'd track promotion usage in order collection
        // For now, we'll implement a basic counter on the promotion document
        if (promotion.usageCount >= promotion.totalUsageLimit) {
            return { valid: false, message: "Promotion usage limit reached" };
        }
    }

    // Check per user usage limit
    if (promotion.usageLimitPerUser && userId) {
        // In a real app, you'd track user-specific usage
        // This would require adding a usage tracking system
    }

    // Calculate discount based on promotion type
    let discount = 0;
    let freeShipping = false;
    let description = '';

    switch (promotion.type) {
        case 'Percentage':
            discount = subtotal * (promotion.value / 100);
            description = `${promotion.value}% off`;
            break;

        case 'Fixed':
            discount = promotion.value;
            description = `${promotion.value} EGP off`;
            break;

        case 'FreeShipping':
            freeShipping = true;
            description = 'Free shipping';
            break;
    }

    // Cap discount to subtotal
    if (discount > subtotal) {
        discount = subtotal;
    }

    return {
        valid: true,
        promotion,
        discount,
        freeShipping,
        description,
        maxDiscount: promotion.maxDiscount || null
    };
};

const getCart = async (req, res) => {
    try {
        console.log(req.sessionID);
        const query = {
            $or: [
                req.user ? { user: req.user.id } : null,
                { sessionId: req.sessionID }
            ].filter(Boolean)
        };

        const cart = await Cart.findOne(query).populate("items.product");

        if (!cart) return res.json({ items: [] });

        // Filter out out-of-stock items
        cart.items = cart.items.filter(item => item.product?.stockQuantity > 0);

        // Calculate totals
        let totals = {
            subtotal: 0,
            deliveryFee: 0,
            vat: 0,
            total: 0,
            discount: 0,
            discountCode: null,
            vatRate: 14
        };

        if (cart.items.length > 0) {
            // Basic subtotal calculation
            cart.items.forEach(item => {
                if (item.product && item.product.price) {
                    totals.subtotal += item.product.price * item.quantity;
                }
            });

            // Apply discount if exists
            if (cart.discountCode && cart.discountAmount) {
                totals.discount = cart.discountAmount;
                totals.discountCode = cart.discountCode;
                totals.subtotal -= cart.discountAmount;
                if (totals.subtotal < 0) totals.subtotal = 0;
            }

            // Calculate VAT (14%)
            totals.vat = totals.subtotal * 0.14;
            totals.total = totals.subtotal + totals.vat;
        }

        await cart.save();
        res.json({ cart, totals });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

const getCartSummary = async (req, res) => {
    try {
        const { governateId, deliveryMethod = 'standard', discountCode } = req.query;

        const query = {
            $or: [
                req.user ? { user: req.user.id } : null,
                { sessionId: req.sessionID }
            ].filter(Boolean)
        };

        const cart = await Cart.findOne(query).populate("items.product");

        if (!cart || cart.items.length === 0) {
            return res.json({
                subtotal: 0,
                deliveryFee: 0,
                vat: 0,
                total: 0,
                estimatedDelivery: null,
                discount: 0,
                discountCode: null,
                freeShipping: false
            });
        }

        let governate = null;
        if (governateId) {
            governate = await Governate.findById(governateId);
        } else if (req.user) {
            const user = await User.findById(req.user.id);
            if (user && user.addresses && user.addresses.length > 0) {
                const defaultAddress = user.addresses.find(addr => addr.isDefault) || user.addresses[0];
                if (defaultAddress && defaultAddress.governorate) {
                    governate = await Governate.findOne({ name: defaultAddress.governorate });
                }
            }
        }

        let discount = cart.discountAmount || 0;
        let appliedPromotionCode = cart.discountCode;
        let freeShipping = false;

        if (discountCode && (!appliedPromotionCode || appliedPromotionCode !== discountCode)) {
            const validation = await validateAndApplyPromotion(
                discountCode,
                cart,
                req.user?.id
            );

            if (validation.valid) {
                discount = validation.discount;
                freeShipping = validation.freeShipping;
                appliedPromotionCode = discountCode;

                cart.discountCode = discountCode;
                cart.discountAmount = discount;
                cart.freeShipping = freeShipping;
                await cart.save();
            }
        }

        const totals = calculateCartTotals(cart, governate, deliveryMethod);

        let estimatedDelivery = null;
        if (governate) {
            estimatedDelivery = calculateDeliveryDate(governate, deliveryMethod);
        }

        if (discount > 0) {
            totals.subtotal -= discount;
            if (totals.subtotal < 0) totals.subtotal = 0;
            totals.vat = totals.subtotal * 0.14;
            totals.total = totals.subtotal + totals.deliveryFee + totals.vat;
            totals.discount = discount;
            totals.discountCode = appliedPromotionCode;
        }

        // Apply free shipping
        if (freeShipping) {
            totals.deliveryFee = 0;
            totals.total = totals.subtotal + totals.vat;
        }

        res.json({
            ...totals,
            estimatedDelivery,
            deliveryMethod,
            freeShipping,
            governate: governate ? {
                name: governate.name,
                fee: governate.fee,
                deliveryTime: governate.deliveryTime
            } : null
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

const getShippingOptions = async (req, res) => {
    try {
        const { governateId } = req.query;

        let governate = null;
        if (governateId) {
            governate = await Governate.findById(governateId);
        } else if (req.user) {
            // Check user's addresses for governorate
            const user = await User.findById(req.user.id);
            if (user && user.addresses && user.addresses.length > 0) {
                const defaultAddress = user.addresses.find(addr => addr.isDefault) || user.addresses[0];
                if (defaultAddress && defaultAddress.governorate) {
                    governate = await Governate.findOne({ name: defaultAddress.governorate });
                }
            }
        }

        if (!governate) {
            // Return default options if no governate
            return res.json({
                standard: {
                    name: 'Standard Delivery',
                    fee: 50,
                    estimatedDays: 3,
                    description: 'Regular delivery service'
                },
                express: {
                    name: 'Express Delivery',
                    fee: 75,
                    estimatedDays: 1,
                    description: 'Priority delivery service'
                }
            });
        }

        const standardFee = governate.fee;
        const expressFee = Math.round(governate.fee * 1.5);

        res.json({
            standard: {
                name: 'Standard Delivery',
                fee: standardFee,
                estimatedDays: governate.deliveryTime,
                description: `Delivery within ${governate.deliveryTime} business days`
            },
            express: {
                name: 'Express Delivery',
                fee: expressFee,
                estimatedDays: Math.max(1, governate.deliveryTime - 1),
                description: `Priority delivery within ${Math.max(1, governate.deliveryTime - 1)} business day(s)`,
                extraFee: expressFee - standardFee
            }
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

const getSavedAddresses = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const user = await User.findById(req.user.id).select('addresses');

        if (!user || !user.addresses || user.addresses.length === 0) {
            return res.json({
                addresses: [],
                message: "No saved addresses found"
            });
        }

        // Find default address
        const defaultAddress = user.addresses.find(addr => addr.isDefault);

        res.json({
            addresses: user.addresses,
            defaultAddress: defaultAddress || null,
            count: user.addresses.length
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

const addNewAddress = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const {
            label,
            street,
            city,
            governorate,
            zipCode,
            isDefault = false
        } = req.body;

        // Validate required fields based on your AddressSchema
        if (!label || !['Home', 'Work', 'Other'].includes(label)) {
            return res.status(400).json({
                message: "Valid label is required (Home, Work, or Other)"
            });
        }

        if (!street || !city || !governorate) {
            return res.status(400).json({
                message: "Street, city, and governorate are required"
            });
        }

        // Verify governate exists in database
        const governateInfo = await Governate.findOne({ name: governorate });
        if (!governateInfo) {
            return res.status(400).json({
                message: "Invalid governorate. Please select from available governorates.",
                availableGovernorates: (await Governate.find().select('name')).map(g => g.name)
            });
        }

        const user = await User.findById(req.user.id);

        // Create new address object matching your schema
        const newAddress = {
            label,
            street,
            city,
            governorate,
            zipCode: zipCode || "",
            isDefault
        };

        // If this is default, unset other defaults
        if (isDefault && user.addresses.length > 0) {
            user.addresses.forEach(addr => {
                addr.isDefault = false;
            });
        }

        user.addresses.push(newAddress);
        await user.save();

        res.status(201).json({
            message: "Address added successfully",
            address: newAddress,
            totalAddresses: user.addresses.length
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

const updateAddress = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const { addressId } = req.params;
        const updates = req.body;

        if (!addressId) {
            return res.status(400).json({ message: "Address ID is required" });
        }

        // Validate governorate if being updated
        if (updates.governorate) {
            const governateInfo = await Governate.findOne({ name: updates.governorate });
            if (!governateInfo) {
                return res.status(400).json({
                    message: "Invalid governorate"
                });
            }
        }

        const user = await User.findById(req.user.id);

        // Find the address index
        const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);

        if (addressIndex === -1) {
            return res.status(404).json({ message: "Address not found" });
        }

        // If setting as default, unset other defaults
        if (updates.isDefault === true) {
            user.addresses.forEach(addr => {
                addr.isDefault = false;
            });
        }

        // Update the address
        user.addresses[addressIndex] = {
            ...user.addresses[addressIndex].toObject(),
            ...updates
        };

        await user.save();

        res.json({
            message: "Address updated successfully",
            address: user.addresses[addressIndex]
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

const deleteAddress = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const { addressId } = req.params;

        if (!addressId) {
            return res.status(400).json({ message: "Address ID is required" });
        }

        const user = await User.findById(req.user.id);

        // Filter out the address to delete
        const initialLength = user.addresses.length;
        user.addresses = user.addresses.filter(addr => addr._id.toString() !== addressId);

        if (user.addresses.length === initialLength) {
            return res.status(404).json({ message: "Address not found" });
        }

        await user.save();

        res.json({
            message: "Address deleted successfully",
            remainingAddresses: user.addresses.length
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

const applyPromotionCode = async (req, res) => {
    try {
        const { promotionCode } = req.body;

        if (!promotionCode) {
            return res.status(400).json({ message: "Promotion code is required" });
        }

        const query = {
            $or: [
                req.user ? { user: req.user.id } : null,
                { sessionId: req.sessionID }
            ].filter(Boolean)
        };

        const cart = await Cart.findOne(query).populate("items.product");

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        // Validate promotion
        const validation = await validateAndApplyPromotion(
            promotionCode,
            cart,
            req.user?.id
        );

        if (!validation.valid) {
            return res.status(400).json({
                message: validation.message
            });
        }

        // Save promotion to cart
        cart.discountCode = promotionCode;
        cart.discountAmount = validation.discount;
        cart.freeShipping = validation.freeShipping;
        cart.promotionType = validation.promotion.type;
        await cart.save();

      
        // Get governate for calculation (if available)
        let governate = null;
        if (req.query.governateId) {
            governate = await Governate.findById(req.query.governateId);
        }

        const deliveryMethod = req.query.deliveryMethod || 'standard';

        // Recalculate totals
        const totals = calculateCartTotals(cart, governate, deliveryMethod);

        // Apply promotion
        totals.subtotal -= validation.discount;
        if (totals.subtotal < 0) totals.subtotal = 0;
        totals.vat = totals.subtotal * 0.14;

        // Apply free shipping if applicable
        if (validation.freeShipping) {
            totals.deliveryFee = 0;
        }

        totals.total = totals.subtotal + totals.deliveryFee + totals.vat;
        totals.discount = validation.discount;
        totals.discountCode = promotionCode;
        totals.freeShipping = validation.freeShipping;
        totals.promotionType = validation.promotion.type;
        totals.promotionDescription = validation.description;

        res.json({
            message: "Promotion applied successfully",
            promotion: {
                code: promotionCode,
                type: validation.promotion.type,
                value: validation.promotion.value,
                description: validation.description
            },
            ...totals
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

const removePromotionCode = async (req, res) => {
    try {
        const query = {
            $or: [
                req.user ? { user: req.user.id } : null,
                { sessionId: req.sessionID }
            ].filter(Boolean)
        };

        const cart = await Cart.findOne(query);

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        const removedCode = cart.discountCode;
        const removedAmount = cart.discountAmount;
        const removedType = cart.promotionType;

        cart.discountCode = undefined;
        cart.discountAmount = undefined;
        cart.freeShipping = undefined;
        cart.promotionType = undefined;
        await cart.save();

        res.json({
            message: "Promotion code removed successfully",
            removedCode,
            removedAmount,
            removedType
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// Existing cart operations (unchanged)
const addToCart = async (req, res) => {
    try {
        const { product_id, quantity } = req.body;
        const qty = quantity || 1;
        if (!product_id) return res.status(400).json({ message: 'Product ID required' });

        const product = await Product.findById(product_id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        if (product.stockQuantity < qty) return res.status(400).json({ message: 'Not enough stock' });
        console.log(req.sessionID);
        const query = req.user?.id ? { user: req.user.id } : { sessionId: req.sessionID };
        let cart = await Cart.findOne(query);

        if (!cart) {
            cart = await Cart.create({
                ...query,
                items: [{ product: product_id, quantity: qty }]
            });
        } else {
            const index = cart.items.findIndex(i => i.product.toString() === product_id);
            if (index > -1) {
                if (product.stockQuantity < cart.items[index].quantity + qty)
                    return res.status(400).json({ message: 'Not enough stock' });
                cart.items[index].quantity += qty;
            } else {
                cart.items.push({ product: product_id, quantity: qty });
            }
        }

        await cart.save();
        const populated = await cart.populate('items.product');
        res.json(populated);

    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

const updateCartItem = async (req, res) => {
    try {
        const { quantity } = req.body;
        const { item_id } = req.params;
        if ( quantity === undefined) return res.status(400).json({ message: 'Item ID and quantity required' });

        const query = req.user?.id ? { user: req.user.id } : { sessionId: req.sessionID };
        const cart = await Cart.findOne(query);
        if (!cart) return res.status(404).json({ message: 'Cart not found' });

        const cartItem = cart.items.id(item_id);
        if (!cartItem) return res.status(404).json({ message: 'Cart item not found' });

        const product = await Product.findById(cartItem.product);
        if (!product) {
            // Remove item if product no longer exists
            cartItem.remove();
            await cart.save();
            return res.status(404).json({ message: 'Product no longer available, removed from cart' });
        }

        if (quantity > product.stockQuantity) return res.status(400).json({ message: 'Not enough stock' });

        if (quantity <= 0) {
            cartItem.remove();
        } else {
            cartItem.quantity = quantity;
        }

        await cart.save();
        const populated = await cart.populate('items.product');
        res.json(populated);

    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

const removeCartItem = async (req, res) => {
    try {
        const { product_id } = req.body;
        if (!product_id) return res.status(400).json({ message: 'Product ID required' });

        const query = req.user?.id ? { user: req.user.id } : { sessionId: req.sessionID };
        const cart = await Cart.findOne(query);
        if (!cart) return res.status(404).json({ message: 'Cart not found' });

        cart.items = cart.items.filter(i => i.product.toString() !== product_id);
        await cart.save();

        const populated = await cart.populate('items.product');
        res.json(populated);

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

const clearCart = async (req, res) => {
    try {
        const query = req.user?.id ? { user: req.user.id } : { sessionId: req.sessionID };
        const cart = await Cart.findOne(query);
        if (!cart) return res.status(404).json({ message: 'Cart not found' });

        cart.items = [];
        cart.discountCode = undefined;
        cart.discountAmount = undefined;
        cart.freeShipping = undefined;
        cart.promotionType = undefined;
        await cart.save();
        res.json({ message: 'Cart cleared' });

    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getCart,
    getCartSummary,
    getShippingOptions,
    getSavedAddresses,
    addNewAddress,
    updateAddress,
    deleteAddress,
    applyPromotionCode,
    removePromotionCode,
    addToCart,
    updateCartItem,
    removeCartItem,
    clearCart
};