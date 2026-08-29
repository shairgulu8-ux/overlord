import mongoose from "mongoose";


// =====================================================
// Allowed News Categories
// =====================================================

const NEWS_CATEGORIES = [
    "stock",
    "crypto",
    "blockchain",
    "gold",
    "forex",
    "economic",
];


// =====================================================
// News Schema
// =====================================================

const newsSchema = new mongoose.Schema(

    {
        // ==============================================
        // News Title
        // ==============================================

        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },


        // ==============================================
        // News Description
        // ==============================================

        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 10000,
        },


        // ==============================================
        // News Category
        // ==============================================

        category: {
            type: String,
            required: true,
            enum: NEWS_CATEGORIES,
            lowercase: true,
            trim: true,
            index: true,
        },


        // ==============================================
        // News Image
        // ==============================================

        image: {
            type: String,
            required: true,
            trim: true,
        },

    },


    // ==============================================
    // Schema Options
    // ==============================================

    {
        timestamps: true,
    }

);


// =====================================================
// Indexes
// =====================================================

// Latest news should be easy and fast to retrieve.
newsSchema.index({
    createdAt: -1,
});


// Category + latest news lookup should be fast.
newsSchema.index({
    category: 1,
    createdAt: -1,
});


// =====================================================
// Model
// =====================================================

const News = mongoose.model(
    "News",
    newsSchema
);


// =====================================================
// Export
// =====================================================

export {
    NEWS_CATEGORIES,
};

export default News;