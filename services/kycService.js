import cloudinary from "../config/cloudinary.js";

import User from "../models/User.js";


// ======================================================
// Constants
// ======================================================

const KYC_STATUS = {

    NOT_STARTED: "not_started",

    PENDING: "pending",

    APPROVED: "approved",

    REJECTED: "rejected",

};


// ======================================================
// Validate ID Number
// ======================================================

const validateIdNumber = (idNumber) => {

    const value =
        idNumber?.trim();


    if (!value) {

        throw new Error(
            "ID number is required."
        );

    }


    /*
    Allow a general government/document ID format.
    Letters, numbers, spaces and hyphens are allowed.
    */

    const idRegex =
        /^[A-Za-z0-9][A-Za-z0-9\s-]{3,29}$/;


    if (!idRegex.test(value)) {

        throw new Error(
            "Invalid ID number."
        );

    }


    return value;

};


// ======================================================
// Delete Old KYC Images
// ======================================================

const deleteOldKycFiles = async (user) => {

    if (!user?.kyc) return;


    const urls = [

        user.kyc.idFront,

        user.kyc.idBack,

    ];


    for (const url of urls) {

        if (!url) continue;


        if (
            typeof url !== "string"
        ) {
            continue;
        }


        if (
            !url.startsWith(
                "https://"
            )
        ) {
            continue;
        }


        try {

            const match =
                url.match(
                    /\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/
                );


            if (!match) continue;


            await cloudinary.uploader.destroy(
                match[1]
            );

        }

        catch (error) {

            console.error(
                "Cloudinary delete failed:",
                error.message
            );

        }

    }

};


// ======================================================
// Submit KYC
// ======================================================

export const submitKyc = async (

    userId,

    body,

    files

) => {

    const user =
        await User.findById(
            userId
        );


    if (!user) {

        throw new Error(
            "User not found."
        );

    }


    // ==========================================
    // Prevent Duplicate Submission
    // ==========================================

    if (
        user.kyc?.status ===
        KYC_STATUS.PENDING
    ) {

        throw new Error(
            "Your KYC verification is already under review."
        );

    }


    if (
        user.kyc?.status ===
        KYC_STATUS.APPROVED
    ) {

        throw new Error(
            "Your KYC has already been approved."
        );

    }


    // ==========================================
    // Request Body
    // ==========================================

    const {

        fullName,

        idNumber,

    } = body || {};


    // ==========================================
    // Required Fields
    // ==========================================

    if (
        !fullName ||
        !fullName.trim()
    ) {

        throw new Error(
            "Full name is required."
        );

    }


    if (
        !idNumber ||
        !idNumber.trim()
    ) {

        throw new Error(
            "ID number is required."
        );

    }


    // ==========================================
    // Uploaded Files
    // ==========================================

    const idFront =
        files?.idFront?.[0];


    const idBack =
        files?.idBack?.[0];


    // ==========================================
    // Validate Uploaded Files
    // ==========================================

    if (!idFront) {

        throw new Error(
            "ID front image is required."
        );

    }


    if (!idBack) {

        throw new Error(
            "ID back image is required."
        );

    }


    // ==========================================
    // Validate User Data
    // ==========================================

    const formattedIdNumber =
        validateIdNumber(
            idNumber
        );


    // ==========================================
    // Delete Old Images
    // Rejected Users
    // ==========================================

    if (
        user.kyc?.status ===
        KYC_STATUS.REJECTED
    ) {

        await deleteOldKycFiles(
            user
        );

    }


    // ==========================================
    // Save KYC
    // ==========================================

    user.kyc = {

        status:
            KYC_STATUS.PENDING,


        fullName:
            fullName.trim(),


        idNumber:
            formattedIdNumber,


        idFront:
            idFront.path,


        idBack:
            idBack.path,


        submittedAt:
            new Date(),


        approvedAt:
            null,


        rejectedReason:
            "",

    };


    // ==========================================
    // Save User
    // ==========================================

    await user.save();


    // ==========================================
    // Return
    // ==========================================

    return {

        success: true,

        message:
            "KYC submitted successfully.",

        status:
            user.kyc.status,

    };

};


// ======================================================
// Get Logged-in User KYC
// ======================================================

export const getMyKyc = async (
    userId
) => {

    const user =
        await User.findById(
            userId
        ).select(
            "kyc"
        );


    if (!user) {

        throw new Error(
            "User not found."
        );

    }


    return {

        success: true,

        kyc:
            user.kyc || {

                status:
                    KYC_STATUS.NOT_STARTED,

            },

    };

};


// ======================================================
// Approve KYC
// ======================================================

export const approveKyc = async (
    userId
) => {

    const user =
        await User.findById(
            userId
        );


    if (!user) {

        throw new Error(
            "User not found."
        );

    }


    if (!user.kyc) {

        throw new Error(
            "KYC not found."
        );

    }


    if (
        user.kyc.status !==
        KYC_STATUS.PENDING
    ) {

        throw new Error(
            "Only pending KYC can be approved."
        );

    }


    user.kyc.status =
        KYC_STATUS.APPROVED;


    user.kyc.approvedAt =
        new Date();


    user.kyc.rejectedReason =
        "";


    /*
    Keep the existing user's
    KYC verification flag
    synchronized.
    */

    user.isKycVerified =
        true;


    await user.save();


    return {

        success: true,

        message:
            "KYC approved successfully.",

        status:
            user.kyc.status,

    };

};


// ======================================================
// Reject KYC
// ======================================================

export const rejectKyc = async (

    userId,

    rejectedReason

) => {

    const user =
        await User.findById(
            userId
        );


    if (!user) {

        throw new Error(
            "User not found."
        );

    }


    if (!user.kyc) {

        throw new Error(
            "KYC not found."
        );

    }


    if (
        user.kyc.status !==
        KYC_STATUS.PENDING
    ) {

        throw new Error(
            "Only pending KYC can be rejected."
        );

    }


    user.kyc.status =
        KYC_STATUS.REJECTED;


    user.kyc.approvedAt =
        null;


    user.kyc.rejectedReason =
        rejectedReason?.trim() ||
        "Verification failed.";


    /*
    Make sure rejected KYC
    is not treated as verified.
    */

    user.isKycVerified =
        false;


    await user.save();


    return {

        success: true,

        message:
            "KYC rejected successfully.",

        status:
            user.kyc.status,

    };

};


// ======================================================
// Get Pending KYC List
// ======================================================

export const getPendingKycs =
    async () => {

        const users =
            await User.find({

                "kyc.status":
                    KYC_STATUS.PENDING,

            })
                .select(
                    "-password -password1"
                )
                .sort({

                    "kyc.submittedAt":
                        -1,

                });


        return {

            success: true,

            count:
                users.length,

            users,

        };

    };


// ======================================================
// Get Approved KYC List
// ======================================================

export const getApprovedKycs =
    async () => {

        const users =
            await User.find({

                "kyc.status":
                    KYC_STATUS.APPROVED,

            })
                .select(
                    "-password -password1"
                )
                .sort({

                    "kyc.approvedAt":
                        -1,

                });


        return {

            success: true,

            count:
                users.length,

            users,

        };

    };


// ======================================================
// Get Rejected KYC List
// ======================================================

export const getRejectedKycs =
    async () => {

        const users =
            await User.find({

                "kyc.status":
                    KYC_STATUS.REJECTED,

            })
                .select(
                    "-password -password1"
                )
                .sort({

                    "kyc.submittedAt":
                        -1,

                });


        return {

            success: true,

            count:
                users.length,

            users,

        };

    };


// ======================================================
// Export Status Constants
// ======================================================

export {
    KYC_STATUS
};