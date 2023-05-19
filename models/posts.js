const mongoose = require('mongoose'); // Import mongoose
const Schema = mongoose.Schema; // Create a Schema

const PostSchema = new Schema({ // Create a UserSchema
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    images: {
        type: String,
        required: true
    },
    playlistId: {
        type: String,
        required: true
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    likes: [
        {
            type: Schema.Types.ObjectId, ref: 'User'
        }
    ],
    dislikes: [
        {
            type: Schema.Types.ObjectId, ref: 'User'
        }
    ],
    location: {
        type: Array,
        default: []
    },

    views: {
        type: Number,
        default: 0
    }


});


let Post = mongoose.model('Post', PostSchema); // Create a User model
module.exports = Post; // Export User model
