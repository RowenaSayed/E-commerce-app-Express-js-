const mongoose = require('mongoose');
const { Schema } = mongoose;

const DailyStatsSchema = new Schema({
    date: { 
        type: Date, 
        default: Date.now,
        unique: true,
        required: true
    },
    totalSales: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    newUsers: { type: Number, default: 0 },
    lowStockCount: { type: Number, default: 0 },
    // يمكن إضافة المزيد من المقاييس اليومية هنا
}, { timestamps: true });

// هذا الموديل مفيد لتجميع البيانات اليومية بسرعة في الداشبورد
module.exports = mongoose.model('DailyStats', DailyStatsSchema);