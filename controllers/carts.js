// const Cart = require('../models/carts');
// const Product = require('../models/products');

// const getCart = async (req, res) => {
//     try {
//         const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
//         if (!cart) return res.json({ items: [] });
//         res.json(cart);
//     } catch (err) {
//         res.status(500).json({ message: 'Server error' });
//     }
// };

// const addToCart = async (req, res) => {
//     try {
//         const { product_id, quantity } = req.body;
//         if (!product_id) return res.status(400).json({ message: 'Product ID required' });

//         const product = await Product.findById(product_id);
//         if (!product) return res.status(404).json({ message: 'Product not found' });
//         if (product.stockQuantity < (quantity || 1)) return res.status(400).json({ message: 'Not enough stock' });

//         let cart = await Cart.findOne({ user: req.user._id });
//         if (!cart) {
//             cart = new Cart({ user: req.user._id, items: [{ product: product_id, quantity: quantity || 1 }] });
//         } else {
//             const index = cart.items.findIndex(i => i.product.toString() === product_id);
//             if (index > -1) {
//                 cart.items[index].quantity += quantity || 1;
//             } else {
//                 cart.items.push({ product: product_id, quantity: quantity || 1 });
//             }
//         }

//         await cart.save();
//         const populatedCart = await cart.populate('items.product');
//         res.json(populatedCart);
//     } catch (err) {
//         res.status(500).json({ message: 'Server error' });
//     }
// };

// const updateCartItem = async (req, res) => {
//     try {
//         const { product_id, quantity } = req.body;
//         if (!product_id || quantity === undefined) return res.status(400).json({ message: 'Product ID and quantity required' });

//         const cart = await Cart.findOne({ user: req.user._id });
//         if (!cart) return res.status(404).json({ message: 'Cart not found' });

//         const index = cart.items.findIndex(i => i.product.toString() === product_id);
//         if (index === -1) return res.status(404).json({ message: 'Product not in cart' });

//         if (quantity <= 0) {
//             cart.items.splice(index, 1);
//         } else {
//             cart.items[index].quantity = quantity;
//         }

//         await cart.save();
//         const populatedCart = await cart.populate('items.product');
//         res.json(populatedCart);
//     } catch (err) {
//         res.status(500).json({ message: 'Server error' });
//     }
// };

// const removeCartItem = async (req, res) => {
//     try {
//         const { product_id } = req.body;
//         if (!product_id) return res.status(400).json({ message: 'Product ID required' });

//         const cart = await Cart.findOne({ user: req.user._id });
//         if (!cart) return res.status(404).json({ message: 'Cart not found' });

//         cart.items = cart.items.filter(i => i.product.toString() !== product_id);
//         await cart.save();
//         const populatedCart = await cart.populate('items.product');
//         res.json(populatedCart);
//     } catch (err) {
//         res.status(500).json({ message: 'Server error' });
//     }
// };

// const clearCart = async (req, res) => {
//     try {
//         const cart = await Cart.findOne({ user: req.user._id });
//         if (!cart) return res.status(404).json({ message: 'Cart not found' });

//         cart.items = [];
//         await cart.save();
//         res.json({ message: 'Cart cleared' });
//     } catch (err) {
//         res.status(500).json({ message: 'Server error' });
//     }
// };

// module.exports = {
//     getCart,
//     addToCart,
//     updateCartItem,
//     removeCartItem,
//     clearCart
// };
