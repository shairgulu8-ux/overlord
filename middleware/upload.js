import multer from "multer";
import path from "path";
import crypto from "crypto";
import { CloudinaryStorage } from "multer-storage-cloudinary";

import cloudinary from "../config/cloudinary.js";


// =====================================================
// Allowed File Types
// =====================================================

const allowedMimeTypes = [

    "image/jpeg",

    "image/jpg",

    "image/png",

    "image/webp",

    "image/heic",

    "image/heif",

    "image/pjpeg",

    "image/x-png",

    "image/avif",

];


// =====================================================
// Allowed File Extensions
// =====================================================

const allowedExtensions = [

    ".jpg",

    ".jpeg",

    ".png",

    ".webp",

    ".heic",

    ".heif",

    ".avif",

];


// =====================================================
// File Filter
// =====================================================

const fileFilter = (
    req,
    file,
    cb
) => {

    const mimeType =
        file.mimetype?.toLowerCase();


    const extension =
        path
            .extname(
                file.originalname || ""
            )
            .toLowerCase();


    /*
    =========================================
    Validate MIME Type
    =========================================
    */

    if (
        !allowedMimeTypes.includes(
            mimeType
        )
    ) {

        return cb(

            new Error(
                "Only JPG, JPEG, PNG, WEBP, HEIC, HEIF and AVIF images are allowed."
            ),

            false

        );

    }


    /*
    =========================================
    Validate File Extension
    =========================================
    */

    if (
        !allowedExtensions.includes(
            extension
        )
    ) {

        return cb(

            new Error(
                "Invalid image file extension."
            ),

            false

        );

    }


    cb(
        null,
        true
    );

};


// =====================================================
// Cloudinary Storage
// =====================================================

const storage =
    new CloudinaryStorage({

        cloudinary,

        params: async (
            req,
            file
        ) => {

            let folder =
                "bobstock/misc";


            switch (
                file.fieldname
            ) {


                /*
                =========================================
                KYC ID DOCUMENTS
                =========================================
                */

                case "idFront":

                case "idBack":

                    folder =
                        "bobstock/kyc/id";

                    break;


                /*
                =========================================
                IPO LOGO
                =========================================
                */

                case "logo":

                    folder =
                        "bobstock/ipo";

                    break;


                /*
                =========================================
                BLOCK TRADE LOGO
                =========================================
                */

                case "blockTradeLogo":

                    folder =
                        "bobstock/blocktrade";

                    break;


                /*
                =========================================
                NEWS IMAGE
                =========================================
                */

                case "newsImage":

                    folder =
                        "bobstock/news";

                    break;


                /*
                =========================================
                DEFAULT
                =========================================
                */

                default:

                    folder =
                        "bobstock/misc";

            }


            return {

                folder,


                /*
                =========================================
                Unique Cloudinary Public ID
                =========================================
                */

                public_id:

                    `${Date.now()}-${crypto.randomBytes(12).toString("hex")}`,


                /*
                =========================================
                Store as image
                =========================================
                */

                resource_type:
                    "image",


                /*
                =========================================
                Don't use original filename
                =========================================
                */

                use_filename:
                    false,


                unique_filename:
                    false,


                overwrite:
                    false,

            };

        },

    });


// =====================================================
// KYC Upload Configuration
// =====================================================

export const uploadKyc =
    multer({

        storage,

        fileFilter,

        limits: {

            /*
            =========================================
            Maximum size per image: 10 MB
            =========================================
            */

            fileSize:
                10 * 1024 * 1024,


            /*
            =========================================
            KYC requires:
            idFront
            idBack
            =========================================
            */

            files:
                2,

        },

    }).fields([


        /*
        =========================================
        ID FRONT
        =========================================
        */

        {

            name:
                "idFront",

            maxCount:
                1,

        },


        /*
        =========================================
        ID BACK
        =========================================
        */

        {

            name:
                "idBack",

            maxCount:
                1,

        },

    ]);


// =====================================================
// IPO Upload Configuration
// =====================================================

export const uploadIPO =
    multer({

        storage,

        fileFilter,

        limits: {

            fileSize:
                10 * 1024 * 1024,

            files:
                1,

        },

    }).single(
        "logo"
    );


// =====================================================
// Block Trade Upload Configuration
// =====================================================

export const uploadBlockTrade =
    multer({

        storage,

        fileFilter,

        limits: {

            fileSize:
                10 * 1024 * 1024,

            files:
                1,

        },

    }).single(
        "blockTradeLogo"
    );


// =====================================================
// News Upload Configuration
// =====================================================

export const uploadNews =
    multer({

        storage,

        fileFilter,

        limits: {

            /*
            =========================================
            Maximum News Image Size: 10 MB
            =========================================
            */

            fileSize:
                10 * 1024 * 1024,


            /*
            =========================================
            Only one image per news
            =========================================
            */

            files:
                1,

        },

    }).single(
        "newsImage"
    );


// =====================================================
// Multer Error Handler
// =====================================================

export const handleUploadError = (

    err,

    req,

    res,

    next

) => {


    /*
    =========================================
    No Upload Error
    =========================================
    */

    if (!err) {

        return next();

    }


    /*
    =========================================
    Multer Errors
    =========================================
    */

    if (
        err instanceof multer.MulterError
    ) {

        switch (
            err.code
        ) {


            /*
            =========================================
            FILE TOO LARGE
            =========================================
            */

            case "LIMIT_FILE_SIZE":

                return res.status(
                    400
                ).json({

                    success:
                        false,

                    message:
                        "Each image must be smaller than 10MB.",

                });


            /*
            =========================================
            TOO MANY FILES
            =========================================
            */

            case "LIMIT_FILE_COUNT":

                return res.status(
                    400
                ).json({

                    success:
                        false,

                    message:
                        "Maximum allowed files have been exceeded.",

                });


            /*
            =========================================
            UNEXPECTED FILE
            =========================================
            */

            case "LIMIT_UNEXPECTED_FILE":

                return res.status(
                    400
                ).json({

                    success:
                        false,

                    message:
                        `Unexpected file received${
                            err.field
                                ? `: ${err.field}`
                                : "."
                        }`,

                });


            /*
            =========================================
            OTHER MULTER ERROR
            =========================================
            */

            default:

                return res.status(
                    400
                ).json({

                    success:
                        false,

                    message:
                        err.message,

                });

        }

    }


    /*
    =========================================
    FILE FILTER / OTHER ERROR
    =========================================
    */

    return res.status(
        400
    ).json({

        success:
            false,

        message:
            err.message ||
            "File upload failed.",

    });

};