const multer = require('multer');
const path = require('path');

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // الصور هتتحفظ في فولدر uploads
    },
    filename: function (req, file, cb) {
        // [cite: 346] NFR-P4: Optimization implies handling files properly
        cb(null, Date.now() + '-' + file.originalname);
    }
});

// File filter (Images only)
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload an image.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // Limit 5MB
    fileFilter: fileFilter
});

module.exports = upload;