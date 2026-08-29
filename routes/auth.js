import express from "express";

import OTP from "../models/OTP.js";
import PendingUser from "../models/PendingUser.js";

import {
    generateOTP,
    getExpiryTime,
    getVerificationExpiry,
    isExpired
} from "../utils/otp.js";

import {
    sendOTPEmail
} from "../services/emailService.js";

import {
    otpLimiter,
    verifyLimiter
} from "../middleware/rateLimiter.js";

import {
    register,
    login,
    changePassword,
    profile,
    savePhoneNumber,
    saveUserEmail,
    saveUserAccount,
    completeUserRegistration
} from "../controllers/authController.js";

import {
    protect
} from "../middleware/auth.js";

const router = express.Router();

const EMAIL_REGEX =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


/*
=========================================
SEND OTP
=========================================
*/

router.post(

    "/send-otp",

    otpLimiter,

    async (req, res) => {

        try {

            const { email } = req.body;

            if (!email) {

                return res.status(400).json({

                    success: false,

                    message: "Email is required."

                });

            }


            if (!EMAIL_REGEX.test(email)) {

                return res.status(400).json({

                    success: false,

                    message: "Invalid email address."

                });

            }


            const normalizedEmail =
                email.toLowerCase().trim();


            const otp =
                generateOTP();


            const expiresAt =
                getExpiryTime();


            await OTP.findOneAndUpdate(

                {

                    email:
                        normalizedEmail

                },

                {

                    email:
                        normalizedEmail,

                    otp,

                    verified: false,

                    expiresAt,

                    verificationExpiresAt: null,

                    attempts: 0

                },

                {

                    upsert: true,

                    new: true

                }

            );


            await sendOTPEmail(

                normalizedEmail,

                otp

            );


            return res.status(200).json({

                success: true,

                message:
                    "OTP sent successfully."

            });

        }


        catch (error) {

            console.error(error);

            return res.status(500).json({

                success: false,

                message:
                    "Failed to send OTP."

            });

        }

    }

);


/*
=========================================
VERIFY OTP
=========================================
*/

router.post(

    "/verify-otp",

    verifyLimiter,

    async (req, res) => {

        try {

            const {

                email,

                otp

            } = req.body;


            if (!email || !otp) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Email and OTP are required."

                });

            }


            const normalizedEmail =
                email.toLowerCase().trim();


            const record =
                await OTP.findOne({

                    email:
                        normalizedEmail

                });


            if (!record) {

                return res.status(404).json({

                    success: false,

                    message:
                        "OTP not found."

                });

            }


            if (

                isExpired(
                    record.expiresAt
                )

            ) {

                await OTP.deleteOne({

                    email:
                        normalizedEmail

                });


                return res.status(400).json({

                    success: false,

                    message:
                        "OTP expired."

                });

            }


            if (record.otp !== otp) {

                record.attempts += 1;

                await record.save();

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid OTP."

                });

            }


            record.verified = true;

            record.verificationExpiresAt =
                getVerificationExpiry();


            await record.save();


            await PendingUser.findOneAndUpdate(

                {

                    email:
                        normalizedEmail

                },

                {

                    emailVerified: true

                }

            );


            return res.status(200).json({

                success: true,

                message:
                    "Email verified successfully."

            });

        }


        catch (error) {

            console.error(error);

            return res.status(500).json({

                success: false,

                message:
                    "OTP verification failed."

            });

        }

    }

);


/*
=========================================
RESEND OTP
=========================================
*/

router.post(

    "/resend-otp",

    otpLimiter,

    async (req, res) => {

        try {

            const {

                email

            } = req.body;


            if (!email) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Email is required."

                });

            }


            const normalizedEmail =
                email.toLowerCase().trim();


            const otp =
                generateOTP();


            const expiresAt =
                getExpiryTime();


            await OTP.findOneAndUpdate(

                {

                    email:
                        normalizedEmail

                },

                {

                    email:
                        normalizedEmail,

                    otp,

                    verified: false,

                    expiresAt,

                    verificationExpiresAt: null,

                    attempts: 0

                },

                {

                    upsert: true,

                    new: true

                }

            );


            await sendOTPEmail(

                normalizedEmail,

                otp

            );


            return res.status(200).json({

                success: true,

                message:
                    "OTP resent successfully."

            });

        }


        catch (error) {

            console.error(error);

            return res.status(500).json({

                success: false,

                message:
                    "Unable to resend OTP."

            });

        }

    }

);


/*
=========================================
REGISTER
=========================================
*/

router.post(

    "/register",

    register

);


/*
=========================================
LOGIN
=========================================
*/

router.post(

    "/login",

    login

);


/*
=========================================
CHANGE PASSWORD
=========================================
*/

router.post(

    "/change-password",

    protect,

    changePassword

);


/*
=========================================
PROFILE
=========================================
*/

router.get(

    "/profile",

    protect,

    profile

);


/*
=========================================
SAVE PHONE
=========================================
*/

router.post(

    "/save-phone",

    savePhoneNumber

);


/*
=========================================
SAVE EMAIL
=========================================
*/

router.post(

    "/save-email",

    saveUserEmail

);


/*
=========================================
SAVE ACCOUNT
=========================================
*/

router.post(

    "/save-account",

    saveUserAccount

);


/*
=========================================
COMPLETE REGISTRATION
=========================================
*/

router.post(

    "/complete-registration",

    completeUserRegistration

);


/*
=========================================
HEALTH CHECK (OPTIONAL)
=========================================
*/

router.get(

    "/health",

    (req, res) => {

        return res.status(200).json({

            success: true,

            message: "Auth API is running."

        });

    }

);


/*
=========================================
EXPORT
=========================================
*/

export default router;