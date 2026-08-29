import {
    registerUser,
    loginUser,
    getProfile,
    changePassword as changePasswordService,
    savePhone,
    saveEmail,
    saveAccount,
    completeRegistration
} from "../services/authService.js";

import OTP from "../models/OTP.js";

import {
    validateUsername,
    validateEmail,
    validatePhone,
    validatePassword
} from "../utils/validators.js";

import {
    isExpired
} from "../utils/otp.js";


/*
=========================================
REGISTER
=========================================
*/

export const register = async (req, res) => {

    try {

        const {
            username,
            email,
            phone,
            password,
            invitationCode
        } = req.body;


        /*
        ============================
        VALIDATIONS
        ============================
        */

        const usernameError =
            validateUsername(username);

        if (usernameError) {

            return res.status(400).json({

                success: false,

                message: usernameError

            });

        }


        const emailError =
            validateEmail(email);

        if (emailError) {

            return res.status(400).json({

                success: false,

                message: emailError

            });

        }


        const phoneError =
            validatePhone(phone);

        if (phoneError) {

            return res.status(400).json({

                success: false,

                message: phoneError

            });

        }


        const passwordError =
            validatePassword(password);

        if (passwordError) {

            return res.status(400).json({

                success: false,

                message: passwordError

            });

        }


        /*
        ============================
        CHECK INVITATION CODE
        ============================
        */

        if (!invitationCode?.trim()) {

            return res.status(400).json({

                success: false,

                message:
                    "Invitation code is required."

            });

        }


        /*
        ============================
        CHECK VERIFIED EMAIL
        ============================
        */

        const otpRecord =
            await OTP.findOne({

                email:
                    email.toLowerCase()

            });


        if (!otpRecord) {

            return res.status(403).json({

                success: false,

                message:
                    "Please verify your email first."

            });

        }


        if (!otpRecord.verified) {

            return res.status(403).json({

                success: false,

                message:
                    "Email is not verified."

            });

        }


        if (

            !otpRecord.verificationExpiresAt ||

            isExpired(
                otpRecord.verificationExpiresAt
            )

        ) {

            await OTP.deleteOne({

                email:
                    email.toLowerCase()

            });


            return res.status(403).json({

                success: false,

                message:
                    "Verification expired. Please verify your email again."

            });

        }


        /*
        ============================
        CREATE USER
        ============================
        */

        const result =
            await registerUser({

                username,

                email,

                phone,

                password,

                invitationCode

            });


        /*
        ============================
        REMOVE OTP RECORD
        ============================
        */

        await OTP.deleteOne({

            email:
                email.toLowerCase()

        });


        /*
        ============================
        RESPONSE
        ============================
        */

        return res.status(201).json({

            success: true,

            message:
                "Account created successfully.",

            token:
                result.token,

            user: {

                id:
                    result.user._id,

                username:
                    result.user.username,

                email:
                    result.user.email,

                phone:
                    result.user.phone,

                balance:
                    result.user.balance,

                role:
                    result.user.role,

                isKycVerified:
                    result.user.isKycVerified,

                isEmailVerified:
                    result.user.isEmailVerified,

                createdAt:
                    result.user.createdAt

            }

        });

    }


    catch (error) {

        console.error(error);

        return res.status(400).json({

            success: false,

            message:
                error.message

        });

    }

};


/*
=========================================
LOGIN
=========================================
*/

export const login = async (req, res) => {

    try {

        const {
            login,
            password
        } = req.body;


        if (!login || !password) {

            return res.status(400).json({

                success: false,

                message:
                    "Login and password are required."

            });

        }


        /*
        ============================
        IMPORTANT:
        Invitation code is NOT required
        for login.
        ============================
        */

        const result =
            await loginUser({

                login,

                password

            });


        return res.status(200).json({

            success: true,

            message:
                "Login successful.",

            token:
                result.token,

            user: {

                id:
                    result.user._id,

                username:
                    result.user.username,

                email:
                    result.user.email,

                phone:
                    result.user.phone,

                balance:
                    result.user.balance,

                role:
                    result.user.role,

                isKycVerified:
                    result.user.isKycVerified,

                isEmailVerified:
                    result.user.isEmailVerified,

                lastLogin:
                    result.user.lastLogin,

                createdAt:
                    result.user.createdAt

            }

        });

    }


    catch (error) {

        console.error(error);

        return res.status(401).json({

            success: false,

            message:
                error.message

        });

    }

};


/*
=========================================
CHANGE PASSWORD
=========================================
*/

export const changePassword = async (req, res) => {

    try {

        const {
            previousPassword,
            newPassword,
            confirmPassword
        } = req.body;


        /*
        ============================
        CHECK REQUIRED FIELDS
        ============================
        */

        if (
            !previousPassword ||
            !newPassword ||
            !confirmPassword
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Previous password, new password and confirm password are required."

            });

        }


        /*
        ============================
        CONFIRM NEW PASSWORD
        ============================
        */

        if (
            newPassword !==
            confirmPassword
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "New password and confirm password do not match."

            });

        }


        /*
        ============================
        NEW PASSWORD MUST BE
        DIFFERENT
        ============================
        */

        if (
            previousPassword ===
            newPassword
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "New password must be different from your previous password."

            });

        }


        /*
        ============================
        AUTHENTICATED USER
        ============================
        */

        if (!req.user?.id) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required."

            });

        }


        /*
        ============================
        CHANGE PASSWORD
        ============================
        */

        await changePasswordService({
            userId:
                req.user.id,

            previousPassword,

            newPassword
        });


        /*
        ============================
        SUCCESS RESPONSE
        ============================
        */

        return res.status(200).json({

            success: true,

            message:
                "Password changed successfully."

        });

    }


    catch (error) {

        console.error(
            "CHANGE PASSWORD ERROR:",
            error
        );


        return res.status(400).json({

            success: false,

            message:
                error.message

        });

    }

};


/*
=========================================
PROFILE
=========================================
*/

export const profile = async (req, res) => {

    try {

        const user =
            await getProfile(
                req.user.id
            );


        return res.status(200).json({

            success: true,

            user

        });

    }


    catch (error) {

        console.error(error);

        return res.status(401).json({

            success: false,

            message:
                error.message

        });

    }

};


/*
=========================================
SAVE PHONE
=========================================
*/

export const savePhoneNumber = async (req, res) => {

    try {

        const {
            phone,
            invitationCode
        } = req.body;


        const phoneError =
            validatePhone(phone);


        if (phoneError) {

            return res.status(400).json({

                success: false,

                message:
                    phoneError

            });

        }


        if (!invitationCode?.trim()) {

            return res.status(400).json({

                success: false,

                message:
                    "Invitation code is required."

            });

        }


        await savePhone({

            phone,

            invitationCode

        });


        return res.status(200).json({

            success: true,

            message:
                "Phone number saved successfully."

        });

    }


    catch (error) {

        console.error(
            "SAVE PHONE ERROR:",
            error
        );


        return res.status(400).json({

            success: false,

            message:
                error.message

        });

    }

};


/*
=========================================
SAVE EMAIL
=========================================
*/

export const saveUserEmail = async (req, res) => {

    try {

        const {
            phone,
            email
        } = req.body;


        const emailError =
            validateEmail(email);


        if (emailError) {

            return res.status(400).json({

                success: false,

                message:
                    emailError

            });

        }


        await saveEmail({

            phone,

            email

        });


        return res.status(200).json({

            success: true,

            message:
                "Email saved successfully."

        });

    }


    catch (error) {

        return res.status(400).json({

            success: false,

            message:
                error.message

        });

    }

};


/*
=========================================
SAVE ACCOUNT
=========================================
*/

export const saveUserAccount = async (req, res) => {

    try {

        const {
            phone,
            username,
            password,
            invitationCode
        } = req.body;


        /*
        ============================
        USERNAME VALIDATION
        ============================
        */

        const usernameError =
            validateUsername(username);


        if (usernameError) {

            return res.status(400).json({

                success: false,

                message:
                    usernameError

            });

        }


        /*
        ============================
        PASSWORD VALIDATION
        ============================
        */

        const passwordError =
            validatePassword(password);


        if (passwordError) {

            return res.status(400).json({

                success: false,

                message:
                    passwordError

            });

        }


        /*
        ============================
        INVITATION CODE VALIDATION
        ============================
        */

        if (!invitationCode?.trim()) {

            return res.status(400).json({

                success: false,

                message:
                    "Invitation code is required."

            });

        }


        /*
        ============================
        SAVE ACCOUNT
        ============================
        */

        await saveAccount({

            phone,

            username,

            password,

            invitationCode

        });


        return res.status(200).json({

            success: true,

            message:
                "Account details saved."

        });

    }


    catch (error) {

        return res.status(400).json({

            success: false,

            message:
                error.message

        });

    }

};


/*
=========================================
COMPLETE REGISTRATION
=========================================
*/

export const completeUserRegistration = async (req, res) => {

    try {

        const {
            phone
        } = req.body;


        const result =
            await completeRegistration({

                phone

            });


        return res.status(201).json({

            success: true,

            message:
                "Account created successfully.",

            token:
                result.token,

            user:
                result.user

        });

    }


    catch (error) {

        return res.status(400).json({

            success: false,

            message:
                error.message

        });

    }

};