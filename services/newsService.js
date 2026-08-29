import cloudinary from "../config/cloudinary.js";

import News, {
    NEWS_CATEGORIES,
} from "../models/News.js";


// =====================================================
// Extract Cloudinary Public ID
// =====================================================

const getCloudinaryPublicId = (
    imageUrl
) => {

    if (
        !imageUrl ||
        typeof imageUrl !== "string"
    ) {

        return null;

    }


    try {

        /*
        =========================================
        Example:

        https://res.cloudinary.com/demo/image/upload/v1234567890/bobstock/news/abc123.jpg

        We need:

        bobstock/news/abc123
        =========================================
        */

        const uploadMarker =
            "/upload/";


        const uploadIndex =
            imageUrl.indexOf(
                uploadMarker
            );


        if (
            uploadIndex === -1
        ) {

            return null;

        }


        let publicId =
            imageUrl.substring(
                uploadIndex +
                uploadMarker.length
            );


        /*
        =========================================
        Remove Cloudinary version
        =========================================
        */

        publicId =
            publicId.replace(
                /^v\d+\//,
                ""
            );


        /*
        =========================================
        Remove file extension
        =========================================
        */

        publicId =
            publicId.replace(
                /\.[^/.]+$/,
                ""
            );


        return publicId || null;

    }

    catch (error) {

        console.error(
            "Cloudinary public ID extraction error:",
            error
        );


        return null;

    }

};


// =====================================================
// Delete News Image From Cloudinary
// =====================================================

const deleteNewsImage =
    async (
        imageUrl
    ) => {

        if (
            !imageUrl
        ) {

            return;

        }


        const publicId =
            getCloudinaryPublicId(
                imageUrl
            );


        if (
            !publicId
        ) {

            console.warn(
                "Could not determine Cloudinary public ID for news image."
            );


            return;

        }


        try {

            await cloudinary.uploader.destroy(
                publicId,
                {
                    resource_type:
                        "image",
                }
            );


            console.log(
                "News image deleted from Cloudinary:",
                publicId
            );

        }

        catch (error) {

            /*
            =========================================
            Do not stop the application
            if Cloudinary deletion fails.
            =========================================
            */

            console.error(
                "Failed to delete news image from Cloudinary:",
                error
            );

        }

    };


// =====================================================
// Validate News Category
// =====================================================

const validateNewsCategory =
    (category) => {

        if (
            !category ||
            typeof category !== "string"
        ) {

            throw new Error(
                "News category is required."
            );

        }


        const normalizedCategory =
            category
                .trim()
                .toLowerCase();


        if (
            !NEWS_CATEGORIES.includes(
                normalizedCategory
            )
        ) {

            throw new Error(
                `Invalid news category. Allowed categories: ${NEWS_CATEGORIES.join(", ")}.`
            );

        }


        return normalizedCategory;

    };


// =====================================================
// Create News
// =====================================================

export const createNews =
    async (
        title,
        description,
        category,
        image
    ) => {

        /*
        =========================================
        Validate title
        =========================================
        */

        if (
            !title ||
            !title.trim()
        ) {

            throw new Error(
                "News title is required."
            );

        }


        /*
        =========================================
        Validate description
        =========================================
        */

        if (
            !description ||
            !description.trim()
        ) {

            throw new Error(
                "News description is required."
            );

        }


        /*
        =========================================
        Validate category
        =========================================
        */

        const normalizedCategory =
            validateNewsCategory(
                category
            );


        /*
        =========================================
        Validate image
        =========================================
        */

        if (
            !image
        ) {

            throw new Error(
                "News image is required."
            );

        }


        /*
        =========================================
        Create News
        =========================================
        */

        const news =
            await News.create({

                title:
                    title.trim(),

                description:
                    description.trim(),

                category:
                    normalizedCategory,

                image:
                    image.trim(),

            });


        return news;

    };


// =====================================================
// Get All News
// =====================================================

export const getAllNews =
    async (
        category = null
    ) => {

        /*
        =========================================
        Build Query
        =========================================
        */

        const query = {};


        /*
        =========================================
        Optional Category Filter
        =========================================
        */

        if (
            category
        ) {

            const normalizedCategory =
                validateNewsCategory(
                    category
                );


            query.category =
                normalizedCategory;

        }


        /*
        =========================================
        Get News
        =========================================
        */

        const news =
            await News.find(
                query
            )
                .sort({
                    createdAt: -1,
                })
                .lean();


        return news;

    };


// =====================================================
// Get Single News
// =====================================================

export const getNewsById =
    async (
        newsId
    ) => {

        if (
            !newsId
        ) {

            throw new Error(
                "News ID is required."
            );

        }


        const news =
            await News.findById(
                newsId
            ).lean();


        if (
            !news
        ) {

            throw new Error(
                "News not found."
            );

        }


        return news;

    };


// =====================================================
// Delete News
// =====================================================

export const deleteNews =
    async (
        newsId
    ) => {

        if (
            !newsId
        ) {

            throw new Error(
                "News ID is required."
            );

        }


        /*
        =========================================
        Find news first
        =========================================
        */

        const news =
            await News.findById(
                newsId
            );


        if (
            !news
        ) {

            throw new Error(
                "News not found."
            );

        }


        /*
        =========================================
        Delete image from Cloudinary
        =========================================
        */

        await deleteNewsImage(
            news.image
        );


        /*
        =========================================
        Delete news from MongoDB
        =========================================
        */

        await News.findByIdAndDelete(
            newsId
        );


        return {

            success:
                true,

            message:
                "News deleted successfully.",

        };

    };


// =====================================================
// Export Cloudinary Image Helper
// =====================================================

export {
    deleteNewsImage,
    validateNewsCategory,
};