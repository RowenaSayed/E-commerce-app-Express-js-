const express = require('express');
const router = express.Router();
const { createPromo,getAdminPromos,getPublicPromos,updatePromo,deletePromo } = require('../controllers/promos');
const { auth, authorize } = require('../middleware/auth');

router.post('/', auth, authorize('admin'), createPromo);
router.put('/:id', auth, authorize('admin'), updatePromo);
router.delete('/:id', auth, authorize('admin'), deletePromo);
router.get('/admin', auth, authorize('admin'), getAdminPromos);
router.get('/public', getPublicPromos);
module.exports = router;
