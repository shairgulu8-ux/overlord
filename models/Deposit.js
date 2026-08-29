import mongoose from "mongoose";


// =====================================================
// Deposit Schema
// =====================================================

const depositSchema = new mongoose.Schema(

    {

        // ==============================================
        // User ID
        // ==============================================
        // Exact User document reference.
        // Balance update isi userId se hoga.
        // ==============================================

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },


        // ==============================================
        // Username
        // ==============================================
        // Stored separately for quick admin display.
        // This is NOT used as the primary identity
        // for balance updates.
        // ==============================================

        username: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            index: true,
        },


        // ==============================================
        // Deposit Amount
        // ==============================================

        amount: {
            type: Number,
            required: true,
            min: 0.000001,
        },


        // ==============================================
        // Deposit Address
        // ==============================================
        // The address associated with this deposit request.
        // It will be visible to admin.
        // ==============================================

        address: {
            type: String,
            required: true,
            trim: true,
        },


        // ==============================================
        // Deposit Status
        // ==============================================

        status: {
            type: String,
            enum: [
                "pending",
                "approved",
                "rejected",
            ],
            default: "pending",
            index: true,
        },


        // ==============================================
        // Processed At
        // ==============================================
        // Normally remains null while pending.
        // Useful if a request is processed before deletion
        // or for future audit/history handling.
        // ==============================================

        processedAt: {
            type: Date,
            default: null,
        },

    },


    // ==================================================
    // Schema Options
    // ==================================================

    {
        timestamps: true,
    }

);


// =====================================================
// Indexes
// =====================================================

// Admin mostly needs pending requests ordered newest first.
depositSchema.index({
    status: 1,
    createdAt: -1,
});


// User's deposit requests can be found quickly.
depositSchema.index({
    userId: 1,
    createdAt: -1,
});


// =====================================================
// Model
// =====================================================

const Deposit = mongoose.model(
    "Deposit",
    depositSchema
);


// =====================================================
// Export
// =====================================================

export default Deposit;