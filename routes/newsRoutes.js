import express from "express";

import {
    createNewsController,
    getAllNewsController,
    getNewsByIdController,
    deleteNewsController,
} from "../controllers/newsController.js";

import {
    uploadNews,
    handleUploadError,
} from "../middleware/upload.js";


const router = express.Router();


// =====================================================
// PUBLIC NEWS ROUTES
// =====================================================


// =====================================================
// GET ALL NEWS
// GET /api/news
//
// Returns all news.
//
// Optional category filter:
//
// GET /api/news?category=stock
// GET /api/news?category=crypto
// GET /api/news?category=blockchain
// GET /api/news?category=gold
// GET /api/news?category=forex
// GET /api/news?category=economic
// =====================================================

router.get(
    "/",
    getAllNewsController
);


// =====================================================
// GET SINGLE NEWS
// GET /api/news/:id
// =====================================================

router.get(
    "/:id",
    getNewsByIdController
);


// =====================================================
// ADMIN NEWS ROUTES
// =====================================================


// =====================================================
// CREATE / UPLOAD NEWS
// POST /api/news
//
// FormData:
//
// title
// description
// category
// newsImage
//
// Middleware order:
//
// 1. uploadNews
// 2. handleUploadError
// 3. createNewsController
// =====================================================

router.post(
    "/",
    uploadNews,
    handleUploadError,
    createNewsController
);


// =====================================================
// DELETE NEWS
// DELETE /api/news/:id
//
// Controller handles:
//
// 1. MongoDB news deletion
// 2. Cloudinary image deletion
// =====================================================

router.delete(
    "/:id",
    deleteNewsController
);


// =====================================================
// EXPORT ROUTER
// =====================================================

export default router;