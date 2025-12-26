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
}, { timestamps: true });

module.exports = mongoose.model('DailyStats', DailyStatsSchema);