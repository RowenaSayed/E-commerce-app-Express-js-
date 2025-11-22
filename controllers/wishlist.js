const Wishlist = require('../models/wishlist');

const getWishlist = async (req, res) => {
    try {
        const wishlist = await Wishlist.findOne({ user_id: req.user.id }).populate('product_ids');
        res.json(wishlist || { product_ids: [] });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

const addToWishlist = async (req, res) => {
    try {
        const { product_id } = req.body;
        if (!product_id) return res.status(400).json({ message: 'Product ID required' });

        let wishlist = await Wishlist.findOne({ user_id: req.user.id });
        if (!wishlist) {
            wishlist = new Wishlist({ user_id: req.user.id, product_ids: [product_id] });
        } else if (!wishlist.product_ids.includes(product_id)) {
            wishlist.product_ids.push(product_id);
        }

        await wishlist.save();
        res.json(wishlist);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        const { product_id } = req.body;
        const wishlist = await Wishlist.findOne({ user_id: req.user.id });
        if (!wishlist) return res.status(404).json({ message: 'Wishlist not found' });

        wishlist.product_ids = wishlist.product_ids.filter(id => id.toString() !== product_id);
        await wishlist.save();
        res.json(wishlist);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

const clearWishlist = async (req, res) => {
    try {
        const wishlist = await Wishlist.findOne({ user_id: req.user.id });
        if (!wishlist) return res.status(404).json({ message: 'Wishlist not found' });

        wishlist.product_ids = [];
        await wishlist.save();
        res.json({ message: 'Wishlist cleared' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    clearWishlist
};
