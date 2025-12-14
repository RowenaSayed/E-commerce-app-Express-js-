const Product = require('../models/products');

// 1. Create Product (FR-A3, FR-A6)
// الأدمن أو البائع فقط من يمكنهم إضافة منتجات
const createProduct = async (req, res) => {
    try {
        const user = req.user;
        
        // التحقق من الصلاحيات (Admin or Seller)
        if (!user || (user.role !== 'admin' && user.role !== 'seller')) {
            return res.status(403).json({ message: "Access denied: Only admin or seller can add products" });
        }

        // معالجة الصور المرفوعة (FR-A6)
        // نفترض أن Middleware الرفع يضع الملفات في req.files
        let imagePaths = [];
        if (req.files && req.files.length > 0) {
            imagePaths = req.files.map(file => file.path || file.location); 
        }

        const {
            name, nameAr, 
            description, descriptionAr,
            category, subCategory, 
            brand, sku,
            condition, 
            price, discount, 
            stockQuantity, lowStockThreshold,
            usedDetails, importedDetails, 
            technicalSpecs,
            dimensions, weight, 
            warranty,
            isFeatured, visibility
        } = req.body;

        // التحقق من الحقول الإجبارية الأساسية
        if (!name || !category || !condition || !price) {
            return res.status(400).json({ message: "Missing required fields: name, category, condition, price" });
        }

        const newProduct = await Product.create({
            seller: user.id, // ربط المنتج بالمستخدم الحالي
            name, nameAr,
            description, descriptionAr,
            category, subCategory,
            brand, sku,
            condition,
            price, discount,
            stockQuantity: stockQuantity || 0,
            lowStockThreshold: lowStockThreshold || 5, // FR-A8: حد التنبيه الافتراضي
            usedDetails, importedDetails, 
            technicalSpecs,
            dimensions, weight, // FR-A3: الأبعاد والوزن
            warranty,
            images: imagePaths, // حفظ روابط الصور
            isFeatured: isFeatured || false, // FR-A9
            visibility: visibility || "Published" // FR-A7
        });

        res.status(201).json({ message: "Product added successfully", product: newProduct });

    } catch (error) {
        // معالجة خطأ تكرار الـ SKU لو موجود
        if (error.code === 11000) {
            return res.status(400).json({ message: "Duplicate field value entered (e.g., SKU must be unique)" });
        }
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// 2. Update Product (FR-A4)
// تعديل المنتج (يدعم تحديث الصور والبيانات)
const updateProduct = async (req, res) => {
    try {
        const user = req.user;
        const product = await Product.findById(req.params.id);

        if (!product) return res.status(404).json({ message: "Product not found" });

        // التحقق من الملكية: الأدمن يعدل أي حاجة، البائع يعدل منتجاته فقط
        if (product.seller.toString() !== user.id.toString() && user.role !== 'admin') {
            return res.status(403).json({ message: "Access denied: You can only update your own products" });
        }

        // FR-A6: معالجة الصور الجديدة (إضافتها للصور القديمة)
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => file.path || file.location);
            product.images = [...product.images, ...newImages];
        }

        // تحديث باقي الحقول القادمة في الـ Body
        const updates = req.body;
        Object.keys(updates).forEach(key => {
            // نمنع تحديث الصور هنا (تمت معالجتها فوق) ونمنع تغيير البائع
            if (key !== 'images' && key !== 'seller' && updates[key] !== undefined) {
                product[key] = updates[key];
            }
        });

        await product.save();
        res.status(200).json({ message: "Product updated successfully", product });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// 3. Soft Delete Product (FR-A5)
// الحذف المؤقت (الأرشفة) بدلاً من الحذف النهائي
const deleteProduct = async (req, res) => {
    try {
        const user = req.user;
        const product = await Product.findById(req.params.id);

        if (!product) return res.status(404).json({ message: "Product not found" });

        // التحقق من الملكية
        if (product.seller.toString() !== user.id.toString() && user.role !== 'admin') {
            return res.status(403).json({ message: "Access denied" });
        }

        // تنفيذ الحذف المؤقت
        product.isDeleted = true;
        product.deletedAt = new Date();
        product.visibility = 'Hidden'; // إخفاء المنتج فوراً

        await product.save();

        res.status(200).json({ message: "Product archived successfully (Soft Deleted)" });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// 4. Get Products (Advanced Filtering for Admin & Users)
const getProducts = async (req, res) => {
    try {
        const { 
            category, condition, minPrice, maxPrice, brand, 
            search, lowStock, showArchived, sort 
        } = req.query;

        let filter = {};

        // 1. التعامل مع الأرشيف (FR-A5)
        // إذا طلب الأدمن رؤية الأرشيف (showArchived=true) نتجاهل فلتر isDeleted
        // وإلا، الوضع الافتراضي هو إخفاء المحذوف
        if (showArchived !== 'true') {
             filter.isDeleted = false;
        }

        // 2. الفلاتر الأساسية
        if (category) filter.category = category;
        if (condition) filter.condition = condition;
        if (brand) filter.brand = brand;
        
        // 3. فلتر نطاق السعر
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }

        // 4. البحث النصي (بالاسم، الوصف، البراند، SKU)
        if (search) {
            filter.$text = { $search: search };
        }

        // 5. فلتر نقص المخزون (FR-A8 - للأدمن)
        // يعرض المنتجات التي وصل مخزونها للحد الأدنى أو أقل
        if (lowStock === 'true') {
            filter.$expr = { $lte: ["$stockQuantity", "$lowStockThreshold"] };
        }

        // 6. التحكم في الظهور (FR-A7)
        // المستخدم العادي يرى فقط "Published"، الأدمن يرى الكل
        // (يمكنك تفعيل هذا الشرط بناءً على التوكن لو متاح، هنا جعلته عاماً للتسهيل حالياً)
        // if (!req.user || req.user.role !== 'admin') {
        //     filter.visibility = "Published";
        // }

        // 7. الترتيب (Sorting)
        let sortOption = { isFeatured: -1, createdAt: -1 }; // الافتراضي: المميز ثم الأحدث
        if (sort === 'price_asc') sortOption = { price: 1 };
        if (sort === 'price_desc') sortOption = { price: -1 };
        if (sort === 'sold') sortOption = { sold: -1 }; // الأكثر مبيعاً

        const products = await Product.find(filter)
            .populate('seller', 'name profilePicture')
            .sort(sortOption);

        res.status(200).json({ count: products.length, products });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// 5. Get Single Product By ID
const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('seller', 'name email profilePicture');

        // لا نعرض المنتج إذا كان محذوفاً (إلا لو أردنا ذلك للأدمن لاحقاً)
        if (!product || product.isDeleted) {
            return res.status(404).json({ message: "Product not found" });
        }

        // جلب منتجات مشابهة (للعرض في صفحة التفاصيل)
        const similarProducts = await Product.find({
            _id: { $ne: product._id }, // استثناء المنتج الحالي
            category: product.category,
            isDeleted: false,
            visibility: "Published"
        })
        .limit(4)
        .select('name price condition images ratingsAverage');

        res.status(200).json({ product, similar: similarProducts });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// 6. Get Products By Category
const getProductByCategory = async (req, res) => {
    try {
        const products = await Product.find({ 
            category: req.params.category, 
            visibility: "Published",
            isDeleted: false 
        })
        .populate('seller', 'name profilePicture')
        .sort({ isFeatured: -1, createdAt: -1 });

        res.status(200).json({ count: products.length, products });
    } catch (error) { 
        res.status(500).json({ message: "Server Error", error: error.message }); 
    }
};

// 7. Get Products By Seller
const getProductsBySeller = async (req, res) => {
    try {
        // لو مبعتش ID في الرابط، هات منتجاتي أنا (من التوكن)
        const sellerId = req.params.sellerId || (req.user ? req.user.id : null);

        if (!sellerId) {
            return res.status(400).json({ message: "Seller ID is required" });
        }

        const products = await Product.find({ 
            seller: sellerId,
            isDeleted: false 
        })
        .populate('seller', 'name profilePicture')
        .sort({ createdAt: -1 });

        res.status(200).json({ count: products.length, products });
    } catch (error) { 
        res.status(500).json({ message: "Server Error", error: error.message }); 
    }
};

module.exports = {
    createProduct,
    updateProduct,
    deleteProduct,
    getProducts,
    getProductById,
    getProductByCategory,
    getProductsBySeller
};