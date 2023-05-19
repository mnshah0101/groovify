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
        accessToken: 'BQDqTu4ZQHJnytqCjCZr2AkfuRZkZSFuAV7rLrqHD0sdBd2bzE3a6Kv84RHL_FU4I1AvCK_JDtfql63ycVDUpQLNm1DPryzkU9AvmcW6rH88wYRFZ-lHI29Z79j1CFcBn-ZwYl2gOWyH5cirLZQUNqAcvHdQApDzvT_-DMk9PeGmUaEcD3gqKZBm4ttRHSBERSVFCWOSISOrCiEEttdZyjBGxRV00WFDmc8fczXwNCFKGxSErxWV0Qh2tnT98aiDFyrKa6eBY2XQdd7yTxwRSTWkRfksw8kc7Sne3L49MOH7tkNXT3wjlg',
        code: 'AQAuGqOPBSMkPtmBqndqeNkZeOM0fqnafUmkWDq7tXJCrg6Xho8liDXAyi8v84nQjmUUAe-DQK6NM_MAVIl5Zt4udLqRfrcnyoCfvAwGTtsbYG5lfvXJH29MNozJTEwY9lj7qXFo3DksLJKRoTR-W0yrKjB7Qa37pJg70C6aV0asdpPR-YxBa8NDOKmQY8LWzVFp9FudehWJN4YGINaMlVRvyTT5l49whRBoYn5w0fU1lnzBpWA6vceea_4L5lv3GQNJfbtXN_M7djRdVbJ5vhK5uOgCclABM6JVkX7qhYHF6nj0K4UsRfMxM09WcbxhfjF7aojmLkoptm1T7oXfoZLoyRfO9kcBTi4yBZ9t982B52n4t--E_cdR3yy8FhAK0nH9UWaFBsxpPr-chBXnhAdpMipthWyqLf4x4bPRRQLS5gig8pA0yV9gjQcL5Y8CyNgKOU-ZCApTkb0ehVrBOpX-CMR8z5PbyegLJ5oio8MmHsNXkBmkWhTQNbbFCeVgizphW_cYaPIIGBQShKDG2aS7AL1HOyoLuemS1JtEYkFbnnUBdpc-Tdm0tbjmTDT2U4GG1Hy3eCh7RmXGEctV6XiDJrJDTntjME0gloc',
        refreshToken: 'AQBPjrS97zAk4jo8VmABoZ8W8w0GlUhxHQo4F3BkbVYRt15Ak22OPhaMW4VAGtrHdxuGbIwDACgBOgVFF4VodOURN25pOb9ee-6rd16RDTT-QzGcgHzkyPHUm1gE39uTVBA'
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





