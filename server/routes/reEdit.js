import express from 'express';
import { reEditImages } from '../controllers/reEditController.js';

const router = express.Router();

router.post('/', express.json(), reEditImages);

export default router;
