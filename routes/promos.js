const express = require('express');
const router = express.Router();
const { createPromo, updatePromo, deletePromo } = require('../controllers/promos');
const { auth, authorize } = require('../middleware/auth');

router.post('/', auth, authorize('admin'), createPromo);
router.put('/:id', auth, authorize('admin'), updatePromo);
router.delete('/:id', auth, authorize('admin'), deletePromo);

module.exports = router;
