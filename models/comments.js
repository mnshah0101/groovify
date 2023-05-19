const mongoose = require('mongoose'); // Import mongoose
const Schema = mongoose.Schema; // Create a Schema

const CommentSchema = new Schema({ // Create a comment schema
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    postId: {
        type: Schema.Types.ObjectId,
        ref: 'Post',
        required: true
    },
    comment: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    likes: {
        type: Number,
        default: 0
    },
    dislikes: {
        type: Number,
        default: 0
    }
});

let Comment = mongoose.model('Comment', CommentSchema); // Create a Comment model
module.exports = Comment; // Export Comment model