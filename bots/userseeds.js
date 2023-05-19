const User = require('../models/user');
const Post = require('../models/posts');
const Comment = require('../models/comments');
const { faker } = require('@faker-js/faker');
const mongoose = require('mongoose');
const users = [];
const crypto = require('crypto');

if (process.env.NODE_ENV === "production") {
    console.log("Code is running in production environment.");
} else {
    require('dotenv').config(
        { path: '../.env' }
    );

}

var mongo_user = process.env.MONGO_USER;
var mongo_pass = process.env.MONGO_PASSWORD;
var SECRET_KEY = process.env.CRYPTO_KEY;
var ALGORITHM = 'aes-256-cbc';
var IV = crypto.randomBytes(16); // Initialization vector.



mongoose.connect(`mongodb+srv://${mongo_user}:${mongo_pass}@groovify.mshdgj8.mongodb.net/?retryWrites=true&w=majority`, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Mongo Connection Open!!!");
}).catch(err => {
    console.log("Mongo Connection Error!");
    console.log(err);
});

function createRandomUser() {
    return new User({
        username: faker.internet.userName(),
        email: faker.internet.email(),
        password: faker.internet.password(),
        posts: [],
        registeredAt: Date.now(),
        followers: [],
        following: [],
        lastRefresh: Date.now(),
        accessToken: 'Access Token',
        code: 'Code',
        refreshToken: 'Refresh Token'
    })
}

function encrypt(text) {
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, IV);

    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return {
        IV: IV.toString('hex'),
        content: encrypted.toString('hex')
    };
}

const deleteData = async () => {
    try {
        await User.deleteMany({});
        console.log('Users deleted');

        await Post.deleteMany({});
        console.log('Posts deleted');

        await Comment.deleteMany({});
        console.log('Comments deleted');

        // Continue with the next steps or additional code here

    } catch (error) {
        console.error('Error deleting data:', error);
    }
};

deleteData();


const createUser = async () => {
    try {
        for (let i = 0; i < 100; i++) {
            try {
                const user = createRandomUser();
                users.push(user);
                await user.save();
            }
            catch (err) {
                continue;
            }

            console.log(i);
        }
        console.log('Users created and saved successfully');
        require('fs').writeFile(

            './users.json',

            JSON.stringify(encrypt(JSON.stringify(users))),


            function (err) {
                console.log("File created")
                if (err) {
                    console.error('Error');
                }
            }
        )

    } catch (error) {
        console.error('Error creating and saving users:', error);
    }
};

createUser();





