const Promotion = require("../models/promos");

const createPromo = async (req, res) => {
    try {
        let {
            code,
            type,
            value,
            minPurchase,
            startDate,
            endDate,
            usageLimitPerUser,
            totalUsageLimit
        } = req.body;

        if (!code || !type || value === undefined || !startDate || !endDate) {
            return res.status(400).json({ message: "Required fields are missing" });
        }

        code = code.toUpperCase();

        if (type === "Percentage" && (value <= 0 || value > 100)) {
            return res.status(400).json({ message: "Percentage must be between 1 and 100" });
        }

        if (type === "Fixed" && value <= 0) {
            return res.status(400).json({ message: "Fixed discount must be greater than 0" });
        }

        if (type === "FreeShipping" && value !== 0) {
            return res.status(400).json({ message: "FreeShipping value must be 0" });
        }

        if (type === "BuyXGetY" && value <= 0) {
            return res.status(400).json({ message: "BuyXGetY value must be greater than 0" });
        }

        if (new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({ message: "startDate must be before endDate" });
        }

        const existingPromo = await Promotion.findOne({ code });
        if (existingPromo) {
            return res.status(400).json({ message: "Promo code already exists" });
        }

        const promo = await Promotion.create({
            code,
            type,
            value,
            minPurchase: minPurchase ?? 0,
            startDate,
            endDate,
            usageLimitPerUser: usageLimitPerUser ?? null,
            totalUsageLimit: totalUsageLimit ?? null,
            createdBy: req.user.id
        });

        res.status(201).json({
            message: "Promo created successfully",
            promo
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};

const getPublicPromos = async (req, res) => {
    try {
        const now = new Date();

        const promos = await Promotion.find({
            active: true,
            startDate: { $lte: now },
            endDate: { $gte: now }
        }).select("code type value minPurchase endDate");

        res.status(200).json({ promos });

    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};

const getAdminPromos = async (req, res) => {
    try {
        const promos = await Promotion.find({
            createdBy: req.user.id
        }).sort({ createdAt: -1 });

        res.status(200).json({ promos });

    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};

const updatePromo = async (req, res) => {
    try {
        const promo = await Promotion.findById(req.params.id);
        if (!promo) {
            return res.status(404).json({ message: "Promo not found" });
        }

        const allowedFields = [
            "type",
            "value",
            "minPurchase",
            "startDate",
            "endDate",
            "usageLimitPerUser",
            "totalUsageLimit",
            "active"
        ];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                promo[field] = req.body[field];
            }
        });

        if (promo.type === "Percentage" && (promo.value <= 0 || promo.value > 100)) {
            return res.status(400).json({ message: "Percentage must be between 1 and 100" });
        }

        if (promo.type === "Fixed" && promo.value <= 0) {
            return res.status(400).json({ message: "Fixed discount must be greater than 0" });
        }

        if (promo.type === "FreeShipping" && promo.value !== 0) {
            return res.status(400).json({ message: "FreeShipping value must be 0" });
        }

        if (promo.type === "BuyXGetY" && promo.value <= 0) {
            return res.status(400).json({ message: "BuyXGetY value must be greater than 0" });
        }

        if (new Date(promo.startDate) >= new Date(promo.endDate)) {
            return res.status(400).json({ message: "startDate must be before endDate" });
        }

        await promo.save();

        res.status(200).json({
            message: "Promo updated successfully",
            promo
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};

const deletePromo = async (req, res) => {
    try {
        const promo = await Promotion.findByIdAndDelete(req.params.id);
        if (!promo) {
            return res.status(404).json({ message: "Promo not found" });
        }

        res.status(200).json({ message: "Promo deleted successfully" });

    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};

const applyPromo = async (req, res) => {
    try {
        const { code, totalAmount } = req.body;
        const userId = req.user ? req.user.id : null;
        if (!code  || totalAmount === undefined) {
            return res.status(400).json({ message: "Required fields are missing (code, totalAmount)" });
        }

        const promo = await Promotion.findOne({ code: code.toUpperCase() });
        if (!promo) {
            return res.status(404).json({ message: "Promo code not found" });
        }

        const now = new Date();
        if (now < promo.startDate || now > promo.endDate) {
            return res.status(400).json({ message: "Promo code is expired or not yet active" });
        }

        if (!promo.active) {
            return res.status(400).json({ message: "Promo code is inactive" });
        }

        if (totalAmount < promo.minPurchase) {
            return res.status(400).json({
                message: `Minimum purchase amount of ${promo.minPurchase} required`
            });
        }

        if (promo.totalUsageLimit !== null && promo.usedCount >= promo.totalUsageLimit) {
            return res.status(400).json({ message: "Promo code usage limit reached" });
        }

        const userUsage = promo.usedBy.find(u => u.user.toString() === userId);
        if (promo.usageLimitPerUser !== null && userUsage && userUsage.count >= promo.usageLimitPerUser) {
            return res.status(400).json({ message: "User usage limit reached" });
        }

        let discount = 0;
        let freeShipping = false;
        let buyXGetY = false;

        switch (promo.type) {
            case "Percentage":
                discount = totalAmount * (promo.value / 100);
                break;
            case "Fixed":
                discount = promo.value;
                break;
            case "FreeShipping":
                freeShipping = true;
                break;
            case "BuyXGetY":
                buyXGetY = true;
                break;
        }

        const finalAmount = totalAmount - discount;

        if (!userUsage) {
            promo.usedBy.push({ user: userId, count: 1 });
        } else {
            userUsage.count += 1;
        }

        promo.usedCount += 1;
        await promo.save();

        res.status(200).json({
            message: "Promo applied successfully",
            discount,
            finalAmount,
            freeShipping,
            buyXGetY
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};

const getPromoStats = async (req, res) => {
    try {
        const promos = await Promotion.find({ createdBy: req.user.id })
            .select("code type usedCount totalUsageLimit startDate endDate active usedBy")
            .populate("usedBy.user", "name email");

        const stats = promos.map(promo => {
            const usageRate = promo.totalUsageLimit ?
                ((promo.usedCount / promo.totalUsageLimit) * 100).toFixed(2) :
                null;

            const uniqueUsers = promo.usedBy.length;
            const avgUsesPerUser = uniqueUsers > 0 ?
                (promo.usedCount / uniqueUsers).toFixed(2) :
                0;

            const now = new Date();
            let status = "Active";
            if (!promo.active) status = "Inactive";
            else if (now < promo.startDate) status = "Scheduled";
            else if (now > promo.endDate) status = "Expired";

            return {
                code: promo.code,
                type: promo.type,
                usedCount: promo.usedCount,
                totalUsageLimit: promo.totalUsageLimit,
                usageRate: usageRate ? `${usageRate}%` : "No limit",
                uniqueUsers,
                avgUsesPerUser,
                status,
                startDate: promo.startDate,
                endDate: promo.endDate,
                usageDetails: promo.usedBy.map(usage => ({
                    userId: usage.user?._id,
                    userName: usage.user?.name,
                    userEmail: usage.user?.email,
                    usageCount: usage.count
                }))
            };
        });

        const summary = {
            totalPromos: promos.length,
            totalUses: promos.reduce((sum, promo) => sum + promo.usedCount, 0),
            activePromos: promos.filter(p => p.active && new Date() >= p.startDate && new Date() <= p.endDate).length,
            expiredPromos: promos.filter(p => new Date() > p.endDate).length,
            avgUsagePerPromo: promos.length > 0 ?
                (promos.reduce((sum, promo) => sum + promo.usedCount, 0) / promos.length).toFixed(2) :
                0
        };

        res.status(200).json({
            summary,
            detailedStats: stats
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};

module.exports = {
    createPromo,
    getPublicPromos,
    getAdminPromos,
    updatePromo,
    deletePromo,
    applyPromo,
    getPromoStats
};