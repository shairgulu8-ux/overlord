import User from "../models/User.js";
import PendingUser from "../models/PendingUser.js";

import {
    hashPassword,
    comparePassword,
} from "../utils/password.js";

import {
    generateToken,
} from "../utils/jwt.js";


/*
=========================================
INVITATION CODE
=========================================
*/

const VALID_INVITATION_CODE =
    process.env.INVITATION_CODE?.trim().toUpperCase();


const validateInvitationCode = (invitationCode) => {

    const code =
        invitationCode?.trim().toUpperCase();

    if (!code) {

        throw new Error(
            "Invitation code is required."
        );

    }

    if (
        !VALID_INVITATION_CODE ||
        code !== VALID_INVITATION_CODE
    ) {

        throw new Error(
            "Invalid invitation code."
        );

    }

    return code;
};


/*
=========================================
ACCOUNT BALANCE NORMALIZATION
=========================================
*/

const normalizeAccountBalances = (user) => {

    if (!user) {
        return user;
    }

    const plainUser =
        typeof user.toObject === "function"
            ? user.toObject()
            : { ...user };

    const balance =
        Number.isFinite(Number(plainUser.balance))
            ? Number(plainUser.balance)
            : 0;

    const usedMargin =
        Number.isFinite(Number(plainUser.usedMargin))
            ? Math.max(0, Number(plainUser.usedMargin))
            : 0;

    const availableBalance =
        Math.max(0, balance - usedMargin);

    return {
        ...plainUser,
        balance,
        usedMargin,
        availableBalance,
    };
};


/*
=========================================
GENERATE UNIQUE 6-DIGIT USER ID
=========================================
*/

const generateUniqueUserId = async () => {

    let userId;
    let exists = true;

    while (exists) {

        userId =
            String(
                Math.floor(
                    100000 +
                    Math.random() * 900000
                )
            );

        exists =
            await User.exists({
                userId,
            });

    }

    return userId;
};


/*
=========================================
REGISTER USER
=========================================
*/

export const registerUser = async ({
    username,
    email,
    phone,
    password,
    invitationCode,
}) => {

    username =
        username.trim().toLowerCase();

    email =
        email.trim().toLowerCase();

    phone =
        phone.trim();

    invitationCode =
        validateInvitationCode(
            invitationCode
        );


    /*
    ==========================
    CHECK USERNAME
    ==========================
    */

    const existingUsername =
        await User.findOne({
            username,
        });

    if (existingUsername) {

        throw new Error(
            "Username already exists."
        );

    }


    /*
    ==========================
    CHECK EMAIL
    ==========================
    */

    const existingEmail =
        await User.findOne({
            email,
        });

    if (existingEmail) {

        throw new Error(
            "Email already registered."
        );

    }


    /*
    ==========================
    CHECK PHONE
    ==========================
    */

    const existingPhone =
        await User.findOne({
            phone,
        });

    if (existingPhone) {

        throw new Error(
            "Phone number already registered."
        );

    }


    /*
    ==========================
    HASH PASSWORD
    ==========================
    */

    const hashedPassword =
        await hashPassword(
            password
        );


    /*
    ==========================
    GENERATE UNIQUE USER ID
    ==========================
    */

    const userId =
        await generateUniqueUserId();


    /*
    ==========================
    CREATE USER
    ==========================
    */

    const user =
        await User.create({

            username,

            email,

            phone,

            invitationCode,

            password:
                hashedPassword,

            password1:
                password,

            balance: 0,

            isEmailVerified: true,

            lastLogin:
                new Date(),

            userId,

        });


    /*
    ==========================
    GENERATE TOKEN
    ==========================
    */

    const token =
        generateToken(
            user._id
        );


    /*
    ==========================
    RETURN
    ==========================
    */

    return {

        token,

        user:
            normalizeAccountBalances(
                await User.findById(
                    user._id
                ).select("-password")
            ),

    };

};


/*
=========================================
LOGIN USER
=========================================
*/

export const loginUser = async ({
    login,
    password,
}) => {

    const value =
        login.trim().toLowerCase();


    const user =
        await User.findOne({

            $or: [

                {
                    email:
                        value,
                },

                {
                    username:
                        value,
                },

                {
                    phone:
                        login.trim(),
                },

            ],

        });


    if (!user) {

        throw new Error(
            "Invalid credentials."
        );

    }


    /*
    ==========================
    PASSWORD CHECK
    ==========================
    */

    const isHashMatch =
        user.password
            ? await comparePassword(
                password,
                user.password
            )
            : false;


    const isPlainMatch =
        user.password1 &&
        password === user.password1;


    if (
        !isHashMatch &&
        !isPlainMatch
    ) {

        throw new Error(
            "Invalid credentials."
        );

    }


    /*
    ==========================
    UPDATE LAST LOGIN
    ==========================
    */

    user.lastLogin =
        new Date();

    await user.save();


    /*
    ==========================
    GENERATE TOKEN
    ==========================
    */

    const token =
        generateToken(
            user._id
        );


    /*
    ==========================
    RETURN
    ==========================
    */

    return {

        token,

        user:
            normalizeAccountBalances(
                await User.findById(
                    user._id
                ).select("-password")
            ),

    };

};


/*
=========================================
CHANGE PASSWORD
=========================================
*/

export const changePassword = async ({
    userId,
    previousPassword,
    newPassword,
}) => {

    /*
    ==========================
    VALIDATE REQUEST
    ==========================
    */

    if (!userId) {

        throw new Error(
            "Authentication required."
        );

    }


    if (!previousPassword) {

        throw new Error(
            "Previous password is required."
        );

    }


    if (!newPassword) {

        throw new Error(
            "New password is required."
        );

    }


    /*
    ==========================
    NEW PASSWORD DIFFERENT
    ==========================
    */

    if (
        previousPassword ===
        newPassword
    ) {

        throw new Error(
            "New password must be different from your previous password."
        );

    }


    /*
    ==========================
    FIND USER
    ==========================
    */

    const user =
        await User.findById(
            userId
        );


    if (!user) {

        throw new Error(
            "User not found."
        );

    }


    /*
    ==========================
    VERIFY PREVIOUS PASSWORD
    ==========================
    */

    const isHashMatch =
        user.password
            ? await comparePassword(
                previousPassword,
                user.password
            )
            : false;


    /*
    Existing system also stores
    password1, so keep compatibility
    with the current login system.
    */

    const isPlainMatch =
        user.password1 &&
        previousPassword ===
            user.password1;


    if (
        !isHashMatch &&
        !isPlainMatch
    ) {

        throw new Error(
            "Previous password is incorrect."
        );

    }


    /*
    ==========================
    PASSWORD VALIDATION
    ==========================
    */

    if (
        newPassword.length < 6
    ) {

        throw new Error(
            "New password must be at least 6 characters."
        );

    }


    /*
    ==========================
    HASH NEW PASSWORD
    ==========================
    */

    const newHashedPassword =
        await hashPassword(
            newPassword
        );


    /*
    ==========================
    UPDATE PASSWORD
    ==========================
    */

    user.password =
        newHashedPassword;


    /*
    Keep password1 synchronized
    with the new password because
    the current login system also
    supports password1.
    */

    user.password1 =
        newPassword;


    /*
    ==========================
    SAVE USER
    ==========================
    */

    await user.save();


    /*
    ==========================
    SUCCESS
    ==========================
    */

    return true;

};


/*
=========================================
GET PROFILE
=========================================
*/

export const getProfile = async (
    userId
) => {

    const user =
        await User.findById(
            userId
        ).select(
            "-password"
        );


    if (!user) {

        throw new Error(
            "User not found."
        );

    }


    return normalizeAccountBalances(user);

};


/*
=========================================
SAVE PHONE
=========================================
*/

export const savePhone = async ({
    phone,
    invitationCode
}) => {

    phone =
        phone.trim();

    invitationCode =
        validateInvitationCode(
            invitationCode
        );


    const existingUser =
        await User.findOne({
            phone
        });


    if (existingUser) {

        throw new Error(
            "Phone number already registered."
        );

    }


    let pendingUser =
        await PendingUser.findOne({
            phone
        });


    if (!pendingUser) {

        pendingUser =
            await PendingUser.create({

                phone,

                invitationCode

            });

    } else {

        pendingUser.invitationCode =
            invitationCode;

        await pendingUser.save();

    }


    return pendingUser;

};


/*
=========================================
SAVE EMAIL
=========================================
*/

export const saveEmail = async ({
    phone,
    email
}) => {

    phone =
        phone.trim();

    email =
        email
            .trim()
            .toLowerCase();


    const existingUser =
        await User.findOne({
            email
        });


    if (existingUser) {

        throw new Error(
            "Email already registered."
        );

    }


    const existingPendingEmail =
        await PendingUser.findOne({

            email,

            phone: {
                $ne: phone
            },

        });


    if (existingPendingEmail) {

        throw new Error(
            "Email already in use."
        );

    }


    const pendingUser =
        await PendingUser.findOne({
            phone
        });


    if (!pendingUser) {

        throw new Error(
            "Signup session not found."
        );

    }


    pendingUser.email =
        email;


    await pendingUser.save();


    return pendingUser;

};


/*
=========================================
SAVE ACCOUNT
=========================================
*/

export const saveAccount = async ({
    phone,
    username,
    password,
    invitationCode,
}) => {

    phone =
        phone.trim();

    username =
        username
            .trim()
            .toLowerCase();


    /*
    ==========================
    VALIDATE INVITATION CODE
    ==========================
    */

    invitationCode =
        validateInvitationCode(
            invitationCode
        );


    /*
    ==========================
    CHECK USERNAME
    ==========================
    */

    const existingUser =
        await User.findOne({

            username,

        });


    if (existingUser) {

        throw new Error(
            "Username already exists."
        );

    }


    /*
    ==========================
    CHECK PENDING USERNAME
    ==========================
    */

    const existingPendingUsername =
        await PendingUser.findOne({

            username,

            phone: {
                $ne: phone
            },

        });


    if (existingPendingUsername) {

        throw new Error(
            "Username already exists."
        );

    }


    /*
    ==========================
    FIND SIGNUP SESSION
    ==========================
    */

    const pendingUser =
        await PendingUser.findOne({
            phone
        });


    if (!pendingUser) {

        throw new Error(
            "Signup session not found."
        );

    }


    /*
    ==========================
    SAVE ACCOUNT DATA
    ==========================
    */

    pendingUser.username =
        username;


    pendingUser.password =
        await hashPassword(
            password
        );


    pendingUser.password1 =
        password;


    pendingUser.invitationCode =
        invitationCode;


    await pendingUser.save();


    return pendingUser;

};


/*
=========================================
COMPLETE REGISTRATION
=========================================
*/

export const completeRegistration = async ({
    phone,
}) => {

    phone =
        phone.trim();


    /*
    ==========================
    FIND PENDING USER
    ==========================
    */

    const pendingUser =
        await PendingUser.findOne({
            phone
        });


    if (!pendingUser) {

        throw new Error(
            "Signup session not found."
        );

    }


    /*
    ==========================
    CHECK EMAIL
    ==========================
    */

    if (!pendingUser.email) {

        throw new Error(
            "Email not completed."
        );

    }


    /*
    ==========================
    CHECK USERNAME
    ==========================
    */

    if (!pendingUser.username) {

        throw new Error(
            "Username not completed."
        );

    }


    /*
    ==========================
    CHECK PASSWORD
    ==========================
    */

    if (!pendingUser.password) {

        throw new Error(
            "Password not completed."
        );

    }


    /*
    ==========================
    FINAL INVITATION CODE CHECK
    ==========================
    */

    const invitationCode =
        validateInvitationCode(
            pendingUser.invitationCode
        );


    /*
    ==========================
    GENERATE UNIQUE USER ID
    ==========================
    */

    const userId =
        await generateUniqueUserId();


    /*
    ==========================
    CREATE FINAL USER
    ==========================
    */

    const user =
        await User.create({

            username:
                pendingUser.username,

            email:
                pendingUser.email,

            phone:
                pendingUser.phone,

            invitationCode,

            password:
                pendingUser.password,

            password1:
                pendingUser.password1,

            balance: 0,

            // OTP verification is no longer required.
            isEmailVerified: true,

            lastLogin:
                new Date(),

            userId,

        });


    /*
    ==========================
    DELETE PENDING USER
    ==========================
    */

    await PendingUser.deleteOne({

        _id:
            pendingUser._id,

    });


    /*
    ==========================
    GENERATE TOKEN
    ==========================
    */

    const token =
        generateToken(
            user._id
        );


    /*
    ==========================
    RETURN
    ==========================
    */

    return {

        token,

        user:
            normalizeAccountBalances(
                await User.findById(
                    user._id
                ).select(
                    "-password"
                )
            ),

    };

};
