const Order = require('../models/orders');
const User = require('../models/users');
const Product = require('../models/products');
const DailyStats = require('../models/dailyStats'); // الموديل الجديد
const mongoose = require('mongoose');
const json2csv = require('json2csv').parse; // 🚨 تتطلب تثبيت مكتبة: npm install json2csv
const pdfkit = require('pdfkit'); // 🚨 تتطلب تثبيت مكتبة: npm install pdfkit
// ----------------------------------------------------
// FR-A33: جلب مقاييس الداشبورد الرئيسية
// ----------------------------------------------------
const drawTable = (doc, data, headers, startY) => {
    const tableTop = startY;
    const itemHeight = 25;
    const sideMargin = 50;
    const columnWidths = [100, 100, 100, 80, 80]; // Order#, Date, Total, Method, Status
    let currentY = tableTop;

    // دالة لرسم الصف
    const drawRow = (row, isHeader = false) => {
        let currentX = sideMargin;
        
        // رسم خلفية للصفوف الفردية/الرؤوس
        if (isHeader || row.index % 2 === 0) {
            doc.fillColor(isHeader ? '#4f46e5' : '#f3f4f6') // خلفية بنفسجية للرأس، رمادية للصفوف الزوجية
               .rect(sideMargin, currentY, 510, itemHeight)
               .fill();
        }
        
        doc.fillColor(isHeader ? '#ffffff' : '#333333') // لون النص أبيض للرأس، أسود للبيانات

        // محتوى الرؤوس/الصفوف
        headers.forEach((header, i) => {
            const text = row.data[i];
            const width = columnWidths[i];
            
            // إضافة النص مع محاذاة عمودية بسيطة
            doc.text(text, currentX, currentY + 8, { width: width, align: 'left' });
            currentX += width;
        });
        
        currentY += itemHeight;
        doc.lineWidth(0.5).strokeColor('#e5e7eb').moveTo(sideMargin, currentY).lineTo(560, currentY).stroke(); // خط فاصل

        return currentY;
    };

    // 1. رسم الرؤوس
    doc.font('Helvetica-Bold').fontSize(10);
    drawRow({ data: headers }, true);

    // 2. رسم البيانات
    doc.font('Helvetica').fontSize(9);
    data.forEach((item, index) => {
        const rowData = [
            item.OrderNumber,
            new Date(item.Date).toLocaleDateString('en-US'),
            `${item.TotalAmount.toFixed(2)} EGP`,
            item.PaymentMethod,
            item.Status
        ];
        currentY = drawRow({ data: rowData, index: index }, false);
        
        // إدارة صفحات الـ PDF
        if (currentY > 750) { 
            doc.addPage();
            currentY = 50;
            drawRow({ data: headers }, true); // إعادة رسم الرؤوس في الصفحة الجديدة
            currentY = doc.y;
        }
    });
    
    return currentY;
};
const getDashboardMetrics = async (req, res) => {
    try {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - 7);
        const startOfMonth = new Date(now);
        startOfMonth.setMonth(now.getMonth() - 1);

        const pipeline = await Order.aggregate([
            { $match: { createdAt: { $gte: startOfMonth } } },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalSales: { $sum: "$totalAmount" },
                    avgOrderValue: { $avg: "$totalAmount" },
                    pendingOrders: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } },
                    // تجميع يومي/أسبوعي/شهري للمبيعات
                    salesDaily: { $sum: { $cond: [{ $gte: ["$createdAt", startOfWeek] }, "$totalAmount", 0] } },
                    salesWeekly: { $sum: { $cond: [{ $gte: ["$createdAt", startOfWeek] }, "$totalAmount", 0] } },
                    salesMonthly: { $sum: "$totalAmount" }
                }
            }
        ]);

        const [ordersStats] = pipeline;
        
        // جلب مقاييس أخرى
        const newCustomers = await User.countDocuments({ 
            createdAt: { $gte: startOfMonth },
            role: 'user' 
        });

        const lowStockAlerts = await Product.countDocuments({
            $expr: { $lte: ["$stockQuantity", "$lowStockThreshold"] },
            isDeleted: false
        });

        res.json({
            success: true,
            dashboard: {
                totalSales: ordersStats?.totalSales || 0,
                totalOrders: ordersStats?.totalOrders || 0,
                averageOrderValue: ordersStats?.avgOrderValue || 0,
                pendingOrdersCount: ordersStats?.pendingOrders || 0,
                newCustomerRegistrations: newCustomers,
                lowStockAlerts: lowStockAlerts,
                // يمكن جلب Revenue Trends من DailyStats
                revenueTrends: {
                    daily: ordersStats?.salesDaily || 0,
                    weekly: ordersStats?.salesWeekly || 0,
                    monthly: ordersStats?.salesMonthly || 0
                }
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Server error fetching dashboard metrics", error: error.message });
    }
};

// ----------------------------------------------------
// FR-A34 & FR-A35: إنشاء تقارير المبيعات والتصدير
// ----------------------------------------------------
const generateSalesReports = async (req, res) => {
    try {
        const { dateFrom, dateTo, exportFormat } = req.query;
        let query = {};
        
        // ... (منطق بناء query هنا) ...
        if (dateFrom || dateTo) {
             query.createdAt = {};
             if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
             if (dateTo) query.createdAt.$lte = new Date(dateTo);
        }
        
        // 1. جلب بيانات التقرير (الطلبات)
        const reportOrders = await Order.aggregate([
            { $match: query },
            {
                $project: {
                    _id: 0,
                    OrderNumber: "$orderNumber",
                    Date: "$createdAt",
                    TotalAmount: "$totalAmount",
                    DeliveryFee: "$deliveryFee",
                    Discount: "$discount",
                    PaymentMethod: "$paymentMethod",
                    Status: "$status"
                }
            }
        ]);
        
        // 2. حساب الملخصات المطلوبة لـ FR-A33/FR-A34
        const totalSales = reportOrders.reduce((sum, order) => sum + order.TotalAmount, 0);
        const totalOrders = reportOrders.length;
        const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;


        // 3. التصدير إلى CSV
        if (exportFormat === 'csv') {
            const csv = json2csv(reportOrders);
            res.header('Content-Type', 'text/csv');
            res.attachment('sales_report.csv');
            return res.send(csv);
        }
        
        // 🚀 4. التصدير إلى PDF (الكود العظمة)
        if (exportFormat === 'pdf') {
            const doc = new pdfkit({ size: 'A4', margin: 50 });
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');

            doc.pipe(res);

            // --- Header & Title ---
            
            // Placeholder للشعار
            doc.fontSize(10).text('E-COMMERCE SYSTEM', 50, 50).moveDown(0.5); 
            doc.fontSize(18).font('Helvetica-Bold').text('Comprehensive Sales Report', { align: 'center' });
            
            const dateRangeText = `From ${dateFrom || 'Start'} to ${dateTo || 'Today'}`;
            doc.fontSize(10).font('Helvetica').text(dateRangeText, { align: 'center' }).moveDown(1.5);
            
            // --- Summary Section ---
            doc.fontSize(12).font('Helvetica-Bold').text('Summary Metrics:', 50, doc.y).moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            
            const summaryY = doc.y;
            doc.text(`Total Sales: ${totalSales.toFixed(2)} EGP`, 70, summaryY);
            doc.text(`Total Orders: ${totalOrders}`, 250, summaryY);
            doc.text(`Avg. Order Value: ${avgOrderValue.toFixed(2)} EGP`, 420, summaryY);
            doc.moveDown(1.5);

            // --- Detail Section ---
            doc.fontSize(12).font('Helvetica-Bold').text('Detailed Order Breakdown:', 50, doc.y).moveDown(0.5);
            
            const headers = ['Order #', 'Date', 'Total', 'Method', 'Status'];
            drawTable(doc, reportOrders, headers, doc.y);

            // 5. إنهاء الـ PDF وإرساله
            doc.end();
            return;
        }
        
        // 6. الاستجابة الافتراضية
        res.json({
            success: true,
            report: reportOrders
        });
        
    } catch (error) {
        console.error("PDF/Report Generation Error:", error);
        res.status(500).json({ message: "Server error generating report", error: error.message });
    }
};

// ----------------------------------------------------
// FR-A36: تقارير أداء المنتج (يتطلب تتبع خارجي مثل Google Analytics)
// ----------------------------------------------------
const getProductPerformance = async (req, res) => {
    try {
        // ⚠️ ملاحظة: Views Count و Add to Cart Rate عادةً ما يتم تتبعها عبر Redis/Analytics Logs.
        // هنا، سنقدم تقريرًا مبسطًا يعتمد على بيانات المبيعات الفعلية.

        const performanceReport = await Order.aggregate([
            // 1. تفكيك مصفوفة الأصناف
            { $unwind: "$items" },
            // 2. تجميع البيانات حسب المنتج
            {
                $group: {
                    _id: "$items.product",
                    totalRevenue: { $sum: { $multiply: ["$items.priceAtPurchase", "$items.quantity"] } },
                    totalPurchases: { $sum: "$items.quantity" },
                }
            },
            // 3. دمج بيانات المنتج (الاسم)
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: "$productDetails" },
            // 4. الإخراج
            {
                $project: {
                    _id: 1,
                    ProductName: "$productDetails.name",
                    TotalRevenue: "$totalRevenue",
                    TotalPurchases: "$totalPurchases",
                    // Views Count و Add to Cart Rate تتطلب بيانات Analytics
                    ViewsCount: { $literal: "N/A" }, 
                    PurchaseConversionRate: { $literal: "N/A (Requires Views Data)" },
                }
            },
            { $sort: { TotalRevenue: -1 } }
        ]);

        res.json({ success: true, report: performanceReport });
    } catch (error) {
        res.status(500).json({ message: "Server error fetching product performance", error: error.message });
    }
};

// ----------------------------------------------------
// FR-A37: رؤى العملاء (Customer Insights)
// ----------------------------------------------------
const getCustomerInsights = async (req, res) => {
    try {
        // 1. Top Customers by Purchase Value
        const topCustomers = await Order.aggregate([
            { $group: {
                _id: "$user",
                totalSpent: { $sum: "$totalAmount" },
                totalOrders: { $sum: 1 }
            }},
            { $sort: { totalSpent: -1 } },
            { $limit: 10 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'customerDetails' } },
            { $unwind: "$customerDetails" },
            { $project: {
                CustomerName: "$customerDetails.name",
                CustomerEmail: "$customerDetails.email",
                TotalSpent: "$totalSpent",
                TotalOrders: "$totalOrders",
            }}
        ]);

        // 2. Customer Retention Rate and Lifetime Value (CLV)
        // ⚠️ يتطلب هذا حسابات معقدة تعتمد على تاريخ الشراء الأول، لكن سنقدم مقاييس مبسطة:
        
        const insights = {
            topCustomers,
            retentionRate: "N/A (Requires complex cohort analysis)",
            averageCLV: "N/A (Requires historical data analysis)"
        };

        res.json({ success: true, insights });
    } catch (error) {
        res.status(500).json({ message: "Server error fetching customer insights", error: error.message });
    }
};

module.exports = {
    getDashboardMetrics,
    generateSalesReports,
    getProductPerformance,
    getCustomerInsights,
    // دالة مساعدة للتصدير
    exportReport: generateSalesReports 
};