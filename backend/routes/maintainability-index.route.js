import express from 'express';
import multer from 'multer';
import { analyzeCodeFromZip, detectDataClassSmell, detectParallelInheritanceHierarchies, exportCsv } from '../controllers/maintainability-index.controller.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/parallel', upload.single('folder'), detectParallelInheritanceHierarchies);

router.post('/analyze', upload.single('folder'), analyzeCodeFromZip);

router.post('/dataclass', upload.single('folder'), detectDataClassSmell);

router.post('/export-csv', exportCsv);

export default router;
