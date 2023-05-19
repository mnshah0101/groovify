const mongoose = require('mongoose'); // Import mongoose
const Schema = mongoose.Schema; // Create a Schema
const passport = require('passport-local-mongoose'); // Import passport-local-mongoose (for authentication

const UserSchema = new Schema({ // Create a UserSchema
    email: {
        type: String,
        required: true,
        unique: true
    },
    accessToken: {
        type: String
    },
    code: {
        type: String
    },
    refreshToken: {
        type: String
    },
    lastRefresh: {
        type: Number
    },
    posts: [
        { type: Schema.Types.ObjectId, ref: 'Post', required: true }
    ],
    profilePicture: {
        type: String,
        default: "/mycollection/png/001-bear.png"
    },
    followers: [
        { type: Schema.Types.ObjectId, ref: 'User', required: true }
    ],
    following: [
        { type: Schema.Types.ObjectId, ref: 'User', required: true }
    ]
});
UserSchema.plugin(passport); // Add passport-local-mongoose to UserSchema


let User = mongoose.model('User', UserSchema); // Create a User model
module.exports = User; // Export User model
