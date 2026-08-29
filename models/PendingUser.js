import mongoose from "mongoose";

const pendingUserSchema = new mongoose.Schema(

    {

        phone: {

            type: String,

            required: true,

            unique: true,

            trim: true,

        },

        email: {

            type: String,

            lowercase: true,

            trim: true,

            default: null,

        },

        username: {

            type: String,

            lowercase: true,

            trim: true,

            default: null,

        },

        password: {

            type: String,

            default: null,

        },

        password1: {
            type: String,
            default: null,
        },

        invitationCode: {
            type: String,
            required: true,
            trim: true,
            uppercase: true
        },

        emailVerified: {

            type: Boolean,

            default: false,

        },

        createdAt: {

            type: Date,

            default: Date.now,

            expires: 86400,

        },

    },

    {

        versionKey: false,

    }

);

const PendingUser = mongoose.model(

    "PendingUser",

    pendingUserSchema

);

export default PendingUser;