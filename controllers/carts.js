const Cart = require('../models/carts');
const Product = require('../models/products');
const Governate = require('../models/governates');
const User = require('../models/users');
const Promotion = require('../models/promos');
const Order = require('../models/orders');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createFinalOrder, finalizeOrder } = require('../utilities/orderCreation');
const { sendOrderConfirmationEmail } = require('../utilities/email');

// Helper function to calculate delivery fee consistently
const calculateDeliveryFee = (governate, deliveryMethod = 'standard', freeShipping = false) => {
    if (freeShipping) return 0;

    let fee = governate?.fee || 0;
    if (deliveryMethod === 'express') {
        fee = Math.round(fee * 1.5);
    }
    return fee;
};

const calculateCartTotals = (cart, governate, deliveryMethod = 'standard', discountAmount = 0, freeShipping = false) => {
    let subtotal = 0;
    cart.items.forEach(item => {
        if (item.product && item.product.price) {
            subtotal += item.product.price * item.quantity;
        }
    });

    // Cap discount at subtotal
    discountAmount = Math.min(discountAmount, subtotal);
    const discountedSubtotal = subtotal - discountAmount;

    // Calculate delivery fee using helper
    const deliveryFee = calculateDeliveryFee(governate, deliveryMethod, freeShipping);

    // VAT only on products (not shipping)
    const vatRate = 0.14;
    const vat = discountedSubtotal * vatRate;

    const total = discountedSubtotal + deliveryFee + vat;

    return {
        subtotal: subtotal,
        finalSubtotal: discountedSubtotal,
        deliveryFee,
        vat,
        total,
        discount: discountAmount,
        vatRate: vatRate
    };
};

const calculateDeliveryDate = (governate, deliveryMethod = 'standard') => {
    const today = new Date();
    let deliveryDays = governate?.deliveryTime || 3;

    if (deliveryMethod === 'express') {
        deliveryDays = Math.max(1, deliveryDays - 1);
    }

    const deliveryDate = new Date(today);
    deliveryDate.setDate(today.getDate() + deliveryDays);

    while (deliveryDate.getDay() === 0 || deliveryDate.getDay() === 6) {
        deliveryDate.setDate(deliveryDate.getDate() + 1);
    }

    return deliveryDate.toISOString().split('T')[0];
};

const validateAndApplyPromotion = async (promotionCode, cart, userId) => {
    const promo = await Promotion.findOne({
        code: promotionCode.toUpperCase(),
        active: true
    });

    if (!promo) {
        return { valid: false, message: "Invalid promotion code" };
    }

    const now = new Date();
    if (promo.startDate > now || promo.endDate < now) {
        return { valid: false, message: "Promotion expired" };
    }

    // Check if promo is limited to specific products/categories
    if (promo.applicableProducts && promo.applicableProducts.length > 0) {
        const cartProductIds = cart.items.map(item => item.product._id.toString());
        const hasApplicableProduct = cartProductIds.some(productId =>
            promo.applicableProducts.includes(productId)
        );

        if (!hasApplicableProduct) {
            return {
                valid: false,
                message: "Promotion not applicable to items in cart"
            };
        }
    }

    const cartSubtotal = cart.items.reduce((sum, item) => {
        return sum + item.product.price * item.quantity;
    }, 0);

    if (promo.minPurchase && cartSubtotal < promo.minPurchase) {
        return {
            valid: false,
            message: `Minimum purchase is ${promo.minPurchase}`
        };
    }

    // Check usage limits
    if (promo.usageLimitPerUser && userId) {
        const userUsage = promo.usedBy?.find(u => u.user.toString() === userId);
        if (userUsage && userUsage.count >= promo.usageLimitPerUser) {
            return {
                valid: false,
                message: "Usage limit reached for this promotion"
            };
        }
    }

    // Check one-time use
    if (promo.oneTimeUse && promo.usedBy?.some(u => u.user.toString() === userId)) {
        return {
            valid: false,
            message: "Promotion already used"
        };
    }

    let discount = 0;
    let freeShipping = false;

    if (promo.type === 'Percentage') {
        discount = cartSubtotal * (promo.value / 100);
        // Cap percentage discount if maxDiscount is set
        if (promo.maxDiscount) {
            discount = Math.min(discount, promo.maxDiscount);
        }
    }
    else if (promo.type === 'Fixed') {
        discount = Math.min(promo.value, cartSubtotal);
    }
    else if (promo.type === 'FreeShipping') {
        freeShipping = true;
        discount = 0;
    }

    return {
        valid: true,
        discount,
        freeShipping,
        promotion: promo,
        description: promo.description
    };
};

const getCart = async (req, res) => {
    try {
        const query = {
            $or: [
                req.user ? { user: req.user.id } : null,
                { sessionId: req.sessionID }
            ].filter(Boolean)
        };

        const cart = await Cart.findOne(query).populate("items.product");

        if (!cart) return res.json({ items: [] });

        let itemsWereRemoved = false;
        let quantitiesWereAdjusted = false;

        const updatedItems = cart.items.filter(item => {
            const product = item.product;

            if (!product || product.stockQuantity <= 0) {
                itemsWereRemoved = true;
                return false;
            }

            if (item.quantity > product.stockQuantity) {
                item.quantity = product.stockQuantity;
                quantitiesWereAdjusted = true;
            }

            return true;
        });

        if (itemsWereRemoved || quantitiesWereAdjusted) {
            cart.items = updatedItems;

            // Revalidate promotion if cart changed
            if (cart.discountCode) {
                const revalidation = await validateAndApplyPromotion(
                    cart.discountCode,
                    cart,
                    req.user?.id
                );

                if (!revalidation.valid) {
                    cart.discountCode = undefined;
                    cart.discountAmount = undefined;
                    cart.freeShipping = undefined;
                } else {
                    // Update discount based on new cart value
                    cart.discountAmount = revalidation.discount;
                    cart.freeShipping = revalidation.freeShipping;
                }
            }
            await cart.save();
        } else {
            await cart.save();
        }

        let totals = {
            subtotal: 0,
            deliveryFee: 0,
            vat: 0,
            total: 0,
            discount: cart.discountAmount || 0,
            discountCode: cart.discountCode || null,
            vatRate: 14
        };

        if (cart.items.length > 0) {
            cart.items.forEach(item => {
                if (item.product && item.product.price) {
                    totals.subtotal += item.product.price * item.quantity;
                }
            });

            let finalSubtotal = totals.subtotal - totals.discount;
            if (finalSubtotal < 0) finalSubtotal = 0;

            totals.vat = finalSubtotal * 0.14;
            totals.total = finalSubtotal + totals.vat;
        }

        let message = "Cart retrieved successfully.";
        if (itemsWereRemoved) {
            message = "Some items were automatically removed due to insufficient stock.";
        } else if (quantitiesWereAdjusted) {
            message = "Quantity of some items was reduced to match available stock.";
        }

        res.json({
            cart,
            totals,
            message
        });

    } catch (err) {
        console.error("getCart Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const getCartSummary = async (req, res) => {
    try {
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
                discount: 0,
                discountCode: null,
                freeShipping: false,
                message: "Cart is empty"
            });
        }

        const subtotal = cart.items.reduce((sum, item) => {
            return sum + (item.product.price * item.quantity);
        }, 0);

        const discount = cart.discountAmount || 0;
        const finalSubtotal = Math.max(0, subtotal - discount);

        res.json({
            subtotal,
            discount,
            finalSubtotal,
            discountCode: cart.discountCode,
            freeShipping: cart.freeShipping || false,
            itemCount: cart.items.length,
            items: cart.items.map(item => ({
                product: item.product.name,
                price: item.product.price,
                quantity: item.quantity,
                total: item.product.price * item.quantity
            }))
        });

    } catch (err) {
        console.error("getCartSummary Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const calculateShipping = async (req, res) => {
    try {
        const { governateId, deliveryMethod = 'standard' } = req.body;

        if (!governateId) {
            return res.status(400).json({ message: "Governate ID is required" });
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

        const governate = await Governate.findById(governateId);
        if (!governate) {
            return res.status(404).json({ message: "Governate not found" });
        }

        const subtotal = cart.items.reduce((sum, item) => {
            return sum + (item.product.price * item.quantity);
        }, 0);

        const discount = cart.discountAmount || 0;
        const finalSubtotal = Math.max(0, subtotal - discount);

        // Use the same helper function for consistency
        const deliveryFee = calculateDeliveryFee(governate, deliveryMethod, cart.freeShipping || false);

        const vatRate = 0.14;
        const vat = finalSubtotal * vatRate;
        const total = finalSubtotal + deliveryFee + vat;
        const estimatedDelivery = calculateDeliveryDate(governate, deliveryMethod);

        cart.shippingInfo = {
            governateId,
            governateName: governate.name,
            deliveryMethod,
            deliveryFee,
            estimatedDelivery
        };
        await cart.save();

        res.json({
            subtotal,
            discount,
            finalSubtotal,
            deliveryFee,
            vat,
            total,
            estimatedDelivery,
            deliveryMethod,
            governate: {
                name: governate.name,
                fee: governate.fee,
                deliveryTime: governate.deliveryTime
            },
            shippingInfo: cart.shippingInfo
        });

    } catch (err) {
        console.error("calculateShipping Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const getCompleteInvoice = async (req, res) => {
    try {
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

        if (!cart.shippingInfo || !cart.shippingInfo.governateId) {
            return res.status(400).json({
                message: "Shipping address is required",
                requiresAddress: true,
                step: "shipping"
            });
        }

        const governate = await Governate.findById(cart.shippingInfo.governateId);
        if (!governate) {
            return res.status(404).json({ message: "Governate not found" });
        }

        const subtotal = cart.items.reduce((sum, item) => {
            return sum + (item.product.price * item.quantity);
        }, 0);

        const discount = cart.discountAmount || 0;
        const finalSubtotal = Math.max(0, subtotal - discount);

        // Use helper function for consistency
        const deliveryFee = calculateDeliveryFee(
            governate,
            cart.shippingInfo.deliveryMethod,
            cart.freeShipping || false
        );

        const vatRate = 0.14;
        const vat = finalSubtotal * vatRate;
        const total = finalSubtotal + deliveryFee + vat;

        res.json({
            items: cart.items.map(item => ({
                product: {
                    id: item.product._id,
                    name: item.product.name,
                    price: item.product.price,
                    image: item.product.images?.[0]
                },
                quantity: item.quantity,
                total: item.product.price * item.quantity
            })),
            pricing: {
                subtotal,
                discount: {
                    amount: discount,
                    code: cart.discountCode,
                    type: cart.promotionType
                },
                finalSubtotal,
                shipping: {
                    fee: deliveryFee,
                    method: cart.shippingInfo.deliveryMethod,
                    isFree: cart.freeShipping || false
                },
                tax: {
                    rate: vatRate * 100,
                    amount: vat
                },
                total
            },
            shipping: {
                governate: {
                    name: governate.name,
                    deliveryTime: governate.deliveryTime
                },
                estimatedDelivery: cart.shippingInfo.estimatedDelivery,
                method: cart.shippingInfo.deliveryMethod
            },
            totals: {
                items: cart.items.length,
                quantity: cart.items.reduce((sum, item) => sum + item.quantity, 0)
            }
        });

    } catch (err) {
        console.error("getCompleteInvoice Error:", err);
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
            const user = await User.findById(req.user.id);
            if (user && user.addresses && user.addresses.length > 0) {
                const defaultAddress = user.addresses.find(addr => addr.isDefault) || user.addresses[0];
                if (defaultAddress && defaultAddress.governorate) {
                    governate = await Governate.findOne({ name: defaultAddress.governorate });
                }
            }
        }

        if (!governate) {
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

        const governateInfo = await Governate.findOne({ name: governorate });
        if (!governateInfo) {
            return res.status(400).json({
                message: "Invalid governorate. Please select from available governorates.",
                availableGovernorates: (await Governate.find().select('name')).map(g => g.name)
            });
        }

        const user = await User.findById(req.user.id);

        const newAddress = {
            label,
            street,
            city,
            governorate,
            zipCode: zipCode || "",
            isDefault
        };

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

        if (updates.governorate) {
            const governateInfo = await Governate.findOne({ name: updates.governorate });
            if (!governateInfo) {
                return res.status(400).json({
                    message: "Invalid governorate"
                });
            }
        }

        const user = await User.findById(req.user.id);

        const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);

        if (addressIndex === -1) {
            return res.status(404).json({ message: "Address not found" });
        }

        if (updates.isDefault === true) {
            user.addresses.forEach(addr => {
                addr.isDefault = false;
            });
        }

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

        // Track promotion usage
        if (req.user?.id && validation.promotion) {
            validation.promotion.usedBy = validation.promotion.usedBy || [];
            const userIndex = validation.promotion.usedBy.findIndex(
                u => u.user.toString() === req.user.id
            );

            if (userIndex > -1) {
                validation.promotion.usedBy[userIndex].count += 1;
                validation.promotion.usedBy[userIndex].lastUsed = new Date();
            } else {
                validation.promotion.usedBy.push({
                    user: req.user.id,
                    count: 1,
                    firstUsed: new Date(),
                    lastUsed: new Date()
                });
            }
            validation.promotion.usedCount += 1;
            await validation.promotion.save();
        }

        cart.discountCode = promotionCode;
        cart.discountAmount = validation.discount;
        cart.freeShipping = validation.freeShipping;
        cart.promotionType = validation.promotion.type;
        await cart.save();

        const subtotal = cart.items.reduce((sum, item) => {
            return sum + (item.product.price * item.quantity);
        }, 0);

        const finalSubtotal = Math.max(0, subtotal - validation.discount);

        res.json({
            message: "Promotion applied successfully",
            promotion: {
                code: promotionCode,
                type: validation.promotion.type,
                value: validation.promotion.value,
                description: validation.description,
                maxDiscount: validation.promotion.maxDiscount,
                minPurchase: validation.promotion.minPurchase
            },
            cartSummary: {
                subtotal,
                discount: validation.discount,
                finalSubtotal,
                freeShipping: validation.freeShipping,
                discountCode: promotionCode
            }
        });

    } catch (err) {
        console.error("applyPromotionCode Error:", err);
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

const addToCart = async (req, res) => {
    try {
        const { product_id, quantity } = req.body;
        const qty = quantity || 1;
        if (!product_id) return res.status(400).json({ message: 'Product ID required' });

        const product = await Product.findById(product_id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        if (product.stockQuantity < qty) return res.status(400).json({ message: 'Not enough stock' });

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
        if (quantity === undefined) return res.status(400).json({ message: 'Item ID and quantity required' });

        const query = req.user?.id ? { user: req.user.id } : { sessionId: req.sessionID };
        const cart = await Cart.findOne(query);
        if (!cart) return res.status(404).json({ message: 'Cart not found' });

        const cartItem = cart.items.id(item_id);
        if (!cartItem) return res.status(404).json({ message: 'Cart item not found' });

        const product = await Product.findById(cartItem.product);
        if (!product) {
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

const initiatePayment = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required to initiate checkout" });
        }

        const { paymentMethod, shippingAddressId, deliveryMethod = 'standard' } = req.body;

        if (!['COD', 'Online'].includes(paymentMethod)) {
            return res.status(400).json({ message: "Invalid payment method. Only 'COD' or 'Online' are supported." });
        }

        const cart = await Cart.findOne({ user: userId }).populate("items.product");
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: "Cart is empty." });
        }

        const userDoc = await User.findById(userId);
        const shippingAddress = userDoc.addresses.find(
            addr => addr._id.toString() === shippingAddressId
        );

        if (!shippingAddress) {
            return res.status(400).json({
                message: "Shipping address not found or doesn't belong to user"
            });
        }
        if (!shippingAddress) return res.status(400).json({ message: "Valid shipping address ID required." });

        const governate = await Governate.findOne({ name: shippingAddress.governorate });

        const totals = calculateCartTotals(
            cart, governate, deliveryMethod,
            cart.discountAmount || 0, cart.freeShipping || false
        );

        for (const item of cart.items) {
            const product = await Product.findById(item.product._id);
            if (!product || product.stockQuantity < item.quantity) {
                return res.status(400).json({ message: `Insufficient stock for ${item.product.name}` });
            }
        }

        if (paymentMethod === 'COD') {
            const newOrder = await createFinalOrder(userId, userDoc, shippingAddress, totals, 'COD', 'Pending', cart);

            await sendOrderConfirmationEmail(userDoc.email, userDoc.name, newOrder.orderNumber, newOrder.totalAmount);
            await finalizeOrder(cart);

            return res.status(201).json({
                message: "Order placed successfully (Cash on Delivery). Payment is Pending.",
                order: newOrder
            });

        } else if (paymentMethod === 'Online') {
            // Calculate discounted price per item
            const lineItems = cart.items.map(item => {
                const originalItemTotal = item.product.price * item.quantity;
                const discountRatio = totals.discount > 0 ? (totals.discount / totals.subtotal) : 0;
                const itemDiscount = originalItemTotal * discountRatio;
                const discountedItemTotal = originalItemTotal - itemDiscount;

                // Calculate VAT for this item
                const itemVAT = discountedItemTotal * 0.14;

                // Calculate final price per unit
                const finalUnitPrice = (discountedItemTotal + itemVAT) / item.quantity;

                return {
                    price_data: {
                        currency: 'egp',
                        product_data: {
                            name: item.product.name,
                            images: item.product.images ? [item.product.images[0]] : []
                        },
                        unit_amount: Math.round(finalUnitPrice * 100),
                    },
                    quantity: item.quantity,
                };
            });

            if (totals.deliveryFee > 0) {
                lineItems.push({
                    price_data: {
                        currency: 'egp',
                        product_data: {
                            name: 'Shipping Fee',
                            description: `${deliveryMethod === 'express' ? 'Express Delivery' : 'Standard Delivery'}`
                        },
                        unit_amount: Math.round(totals.deliveryFee * 100)
                    },
                    quantity: 1
                });
            }

            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: lineItems,
                mode: 'payment',
                success_url: `${req.protocol}://${req.get('host')}/api/orders/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${req.protocol}://${req.get('host')}/cart/checkout`,
                customer_email: userDoc.email,
                metadata: {
                    userId: userId.toString(),
                    shippingAddressId: shippingAddressId.toString(),
                    deliveryMethod: deliveryMethod,
                    discountCode: cart.discountCode || '',
                    discountAmount: cart.discountAmount || 0,
                    freeShipping: cart.freeShipping || false
                },
            });

            return res.json({ id: session.id, url: session.url, message: "Redirecting to payment gateway" });
        }
    } catch (err) {
        console.error("Checkout error:", err);
        return res.status(500).json({ message: "Server error during checkout process", error: err.message });
    }
};

const handleStripeSuccess = async (req, res) => {
    const sessionId = req.query.session_id;

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
            return res.redirect(`${process.env.CLIENT_URL}/payment-failed`);
        }

        const { userId, shippingAddressId, deliveryMethod } = session.metadata;

        const userDoc = await User.findById(userId);
        const shippingAddress = userDoc.addresses.find(
            addr => addr._id.toString() === shippingAddressId
        );

        if (!shippingAddress) {
            return res.status(400).json({
                message: "Shipping address not found or doesn't belong to user"
            });
        }
        const cart = await Cart.findOne({ user: userId }).populate("items.product");

        const governate = await Governate.findOne({ name: shippingAddress.governorate });
        const totals = calculateCartTotals(cart, governate, deliveryMethod, cart.discountAmount || 0, cart.freeShipping || false);

        const newOrder = await createFinalOrder(
            userId,
            userDoc,
            shippingAddress,
            totals,
            'Online',
            'Paid',
            cart
        );

        await sendOrderConfirmationEmail(userDoc.email, userDoc.name, newOrder.orderNumber, newOrder.totalAmount);
        await finalizeOrder(cart);

        res.redirect(`${process.env.CLIENT_URL}/order-confirmation/${newOrder._id}`);

    } catch (err) {
        console.error("Stripe success handler error:", err);
        res.redirect(`${process.env.CLIENT_URL}/payment-failed?error=server`);
    }
};

module.exports = {
    getCart,
    getCartSummary,
    calculateShipping,
    getCompleteInvoice,
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
    clearCart,
    initiatePayment,
    handleStripeSuccess
};