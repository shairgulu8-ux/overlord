import mongoose from "mongoose";

import {
    createNews,
    getAllNews,
    getNewsById,
    deleteNews,
} from "../services/newsService.js";


// =====================================================
// CREATE NEWS
// =====================================================
// POST /api/news
// Admin only
// =====================================================

export const createNewsController =
    async (
        req,
        res
    ) => {

        try {

            // =========================================
            // Request Body
            // =========================================

            const {
                title,
                description,
                category,
            } = req.body || {};


            // =========================================
            // Uploaded Image
            // =========================================

            const image =
                req.file?.path;


            // =========================================
            // Create News
            // =========================================

            const news =
                await createNews(
                    title,
                    description,
                    category,
                    image
                );


            // =========================================
            // Response
            // =========================================

            return res.status(201).json({

                success:
                    true,

                message:
                    "News uploaded successfully.",

                news,

            });

        }

        catch (error) {

            console.error(
                "Create News Error:",
                error
            );


            return res.status(400).json({

                success:
                    false,

                message:
                    error.message ||
                    "Failed to upload news.",

            });

        }

    };


// =====================================================
// GET ALL NEWS
// =====================================================
// GET /api/news
// Public
// =====================================================

export const getAllNewsController =
    async (
        req,
        res
    ) => {

        try {

            // =========================================
            // Optional Category Filter
            // =========================================

            const {
                category,
            } = req.query || {};


            // =========================================
            // Get News
            // =========================================

            const news =
                await getAllNews(
                    category || null
                );


            // =========================================
            // Response
            // =========================================

            return res.status(200).json({

                success:
                    true,

                count:
                    news.length,

                news,

            });

        }

        catch (error) {

            console.error(
                "Get All News Error:",
                error
            );


            return res.status(400).json({

                success:
                    false,

                message:
                    error.message ||
                    "Failed to fetch news.",

            });

        }

    };


// =====================================================
// GET SINGLE NEWS
// =====================================================
// GET /api/news/:id
// Public
// =====================================================

export const getNewsByIdController =
    async (
        req,
        res
    ) => {

        try {

            const {
                id,
            } = req.params;


            // =========================================
            // Validate MongoDB ID
            // =========================================

            if (
                !mongoose.Types.ObjectId.isValid(
                    id
                )
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        "Invalid news ID.",

                });

            }


            // =========================================
            // Get News
            // =========================================

            const news =
                await getNewsById(
                    id
                );


            // =========================================
            // Response
            // =========================================

            return res.status(200).json({

                success:
                    true,

                news,

            });

        }

        catch (error) {

            console.error(
                "Get News By ID Error:",
                error
            );


            const statusCode =
                error.message ===
                "News not found."
                    ? 404
                    : 500;


            return res.status(
                statusCode
            ).json({

                success:
                    false,

                message:
                    error.message ||
                    "Failed to fetch news.",

            });

        }

    };


// =====================================================
// DELETE NEWS
// =====================================================
// DELETE /api/news/:id
// Admin only
// =====================================================

export const deleteNewsController =
    async (
        req,
        res
    ) => {

        try {

            const {
                id,
            } = req.params;


            // =========================================
            // Validate MongoDB ID
            // =========================================

            if (
                !mongoose.Types.ObjectId.isValid(
                    id
                )
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        "Invalid news ID.",

                });

            }


            // =========================================
            // Delete News
            // =========================================

            const result =
                await deleteNews(
                    id
                );


            // =========================================
            // Response
            // =========================================

            return res.status(200).json({

                success:
                    true,

                message:
                    result.message ||
                    "News deleted successfully.",

            });

        }

        catch (error) {

            console.error(
                "Delete News Error:",
                error
            );


            const statusCode =
                error.message ===
                "News not found."
                    ? 404
                    : 500;


            return res.status(
                statusCode
            ).json({

                success:
                    false,

                message:
                    error.message ||
                    "Failed to delete news.",

            });

        }

    };