
const express = require('express');
const app = express(); // create express app
const port = 3000; // define port
var client_id = process.env.SPOTIFY_CLIENT_ID;
var client_secret = process.env.SPOTIFY_CLIENT_SECRET;
var mongo_user = process.env.MONGO_USER;
var mongo_pass = process.env.MONGO_PASSWORD;

const randomString = require('randomstring');
const querystring = require('querystring');
const axios = require('axios');
const Buffer = require('buffer').Buffer;
const path = require('path');
const engine = require('ejs-mate');
const SpotifyWebApi = require('spotify-web-api-node');
const methodOverride = require('method-override');
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/user');
const session = require('express-session');
const ExpressError = require('./utils/ExpressError');
const catchAsync = require('./utils/catchAsync');
const flash = require('connect-flash');
const Post = require('./models/posts');
const geoip = require('fast-geoip');
const Comment = require('./models/comments');
const fs = require('fs');
var CronJob = require('cron').CronJob;
const { spawn } = require('child_process');

var job = new CronJob(
    '0 0 */12 * * *', // Run every 12 hours at 00:00:00
    function () {
        console.log('You will see this message every 12 hours');

        // Run the bot.js script using child_process.spawn
        const botProcess = spawn('node', ['bots/bot.js']);

        // Log the output of the bot.js script if any
        botProcess.stdout.on('data', (data) => {
            console.log(`Output from bot.js: ${data}`);
        });

        // Log any errors that occur during the execution of the bot.js script
        botProcess.stderr.on('data', (data) => {
            console.error(`Error from bot.js: ${data}`);
        });
    },
    null,
    true,
    'America/Los_Angeles'
);




//MongoDB Connection
mongoose.connect(`mongodb+srv://${mongo_user}:${mongo_pass}@groovify.mshdgj8.mongodb.net/?retryWrites=true&w=majority`, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Mongo Connection Open!!!");
}).catch(err => {
    console.log("Mongo Connection Error!");
    console.log(err);
});




//Session Configuration
const sessionConfig = {
    name: process.env.SESSION_NAME,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: true,
    }


}
app.use(session(sessionConfig));



//flash configuration
app.use(flash());

//Pasport Configuration
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//Express configs
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.engine('ejs', engine);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));


//Spotify API Configuration

//Get access token
const getToken = async (code, state, err) => {
    var state = randomString.generate(16);
    const scope = [
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing',
        'user-read-email',
        'user-read-private',
        'playlist-read-collaborative',
        'playlist-modify-public',
        'playlist-read-private',
        'playlist-modify-private',
        'user-library-modify',
        'user-library-read',
        'user-top-read',
        'user-read-playback-position',
        'user-read-recently-played',
    ];
    const scopeString = scope.join(' ');


    let data = axios.get('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scopeString,
            redirect_uri: 'https://groovify-spotify-am598vs7e-mnshah0101.vercel.app/callback',
            state: state
        }));

    if (err) {
        return "There is an error"
    }
    else {
        let authString = Buffer.from(client_id + ':' + client_secret, 'utf-8').toString('base64');
        const data = await axios.post('https://accounts.spotify.com/api/token', {
            "grant_type": 'authorization_code',
            "code": code,
            "redirect_uri": "https://groovify-spotify-am598vs7e-mnshah0101.vercel.app/callback"
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + authString
            }
        })
        return data;

    }
}

const updateRefreshToken = async (req, res, next) => {
    let authString = Buffer.from(client_id + ':' + client_secret, 'utf-8').toString('base64');
    let data = await axios.post('https://accounts.spotify.com/api/token', {
        "grant_type": 'refresh_token',
        "refresh_token": req.user.refreshToken
    }, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + authString
        }
    })
    let id = req.user._id;
    let newUser = await User.findById(id)
    newUser.lastRefresh = Date.now();
    newUser.accessToken = data.data.access_token;
    await newUser.save();
    next();

}




const hasFollowedUser = (user, otherUser) => {
    if (user._id.equals(otherUser._id)) {
        console.log('Same Person')

        return true;
    }

    if (user.following.includes(otherUser._id)) {
        console.log('already following')

        return true;
    }
    else {
        console.log('not already following')

        return false;

    }
}

const isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.flash('error', 'You must be signed in');
        return res.redirect('/login');
    }
    next();
}
const isNotLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
        req.flash('error', 'You are already signed in');
        return res.redirect('/');
    }
    next();
}

const getPlaylists = async function (user) {
    const spotifyApi = new SpotifyWebApi({
        clientId: client_id,
        clientSecret: client_secret,
        redirectUri: 'https://groovify-spotify-am598vs7e-mnshah0101.vercel.app/callback',
        refreshToken: user.refreshToken,
        accessToken: user.accessToken

    });
    let playlists = null;
    await spotifyApi.getUserPlaylists()
        .then(function (data) {
            playlists = data.body;
        }, function (err) {
            console.log('Something went wrong!', err);
        });
    return playlists;


}



const hasLikedPost = function (post, userId) {
    let liked = false;
    for (let i = 0; i < post.likes.length; i++) {
        if (post.likes[i].toString() == userId.toString()) {
            liked = true;
        }

    }

    return liked;
}
const hasDislikedPost = function (post, userId) {
    let disliked = false;
    for (let i = 0; i < post.dislikes.length; i++) {
        if (post.dislikes[i].toString() == userId.toString()) {
            disliked = true;
        }

    }

    return disliked;
}

// Converts from degrees to radians.
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

// Calculates the distance between two lat/long points in kilometers.
function calculateDistance(lat1, lon1, lat2, lon2) {
    const radiusOfEarthInKilometers = 6371;

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return radiusOfEarthInKilometers * c;
}

// Compares if two lat/long points are within a certain distance of each other.
function isWithinDistance(lat1, lon1, lat2, lon2, maxDistanceInKilometers) {
    const distance = calculateDistance(lat1, lon1, lat2, lon2);

    return distance <= maxDistanceInKilometers;
}

function filterPostsByLocation(lat, lon, maxDistanceInKilometers) {
    return Post.find().populate('user')
        .then(posts => {
            return posts.filter(post => {
                const latitude = post.location[0];
                const longitude = post.location[1];
                return isWithinDistance(lat, lon, latitude, longitude, maxDistanceInKilometers);
            });
        })
        .catch(err => {
            console.log('Error: ', err);
        });
}
async function getMostViewedPost(startDate, endDate) {
    try {
        const mostViewed = await Post
            .find({
                date: {
                    $gte: new Date(startDate), // greater than or equal to start date
                    $lte: new Date(endDate)    // less than or equal to end date
                }
            })
            .sort({ views: -1 }) // sort by views in descending order
            .limit(1) // only return the top post
            .exec();

        return mostViewed[0]; // since we limited the result to 1, we can return the first (and only) item
    } catch (err) {
        console.log('Error: ', err);
    }
}









//Routes and Middleware
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

app.get('/show/:id', isLoggedIn, catchAsync(async (req, res) => {
    let id = req.params.id;
    let post = await Post.findById(id);
    if (!post) {
        req.flash('error', 'Cannot find that post!');
        return res.redirect('/dashboard');
    }
    let comments = await Comment.find({ postId: id }).populate('userId');
    let user = await User.findById(post.user);
    post.views++;
    await post.save();
    let thisUser = req.user;
    console.log(thisUser)

    res.render('post/show', { post, comments, user, thisUser });
}))


app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/feed');
    }

    res.render('home');
}
);

app.get('/register', isNotLoggedIn, (req, res) => {
    res.render('user/register');
});


app.post('/register', isNotLoggedIn, catchAsync(async (req, res, next) => {
    let username = req.body.username;
    let email = req.body.email;
    let password = req.body.password;
    let newUser = new User({ username, email });
    const registeredUser = await User.register(newUser, password).catch(err => {
        req.flash('error', err.message);
        return res.redirect('/register');
    });
    req.session.user_id = registeredUser._id;
    const scope = [
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing',
        'user-read-email',
        'user-read-private',
        'playlist-read-collaborative',
        'playlist-modify-public',
        'playlist-read-private',
        'playlist-modify-private',
        'user-library-modify',
        'user-library-read',
        'user-top-read',
        'user-read-playback-position',
        'user-read-recently-played',
    ];
    const scopeString = scope.join(' ');


    let state = randomString.generate(16);
    let redirect_uri = 'https://groovify-spotify-am598vs7e-mnshah0101.vercel.app/callback';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scopeString,
            redirect_uri: redirect_uri,
            state: state
        }))
}
));

app.get('/callback', catchAsync(async (req, res, next) => {
    let userId = req.session.user_id;
    let code = req.query.code || null;
    let state = req.query.state || null;
    let error = req.query.error || null;
    let user = await User.findById(userId);
    let data = await getToken(code, state, error);
    let scope = data.data.scope;
    console.log(scope)
    let accessToken = data.data.access_token;
    let refreshToken = data.data.refresh_token;
    user.accessToken = accessToken;
    user.refreshToken = refreshToken;
    user.lastRefresh = new Date().getTime()
    user.posts = [];
    user.followers = [];
    user.following = [];
    user.code = code;
    console.log('saving user')
    await user.save();


    req.login(user, err => {
        if (err) return next(err);
        req.flash('success', 'Welcome!')
        res.redirect('/dashboard');
    })

}));


app.get('/login', isNotLoggedIn, (req, res) => {
    res.render('user/login');
});

app.post('/login', isNotLoggedIn, passport.authenticate('local', { failureFlash: true, failureRedirect: '/login' }), (req, res) => {
    res.redirect('/dashboard');
});
app.get('/feed', isLoggedIn, updateRefreshToken, catchAsync(async (req, res) => {
    let id = req.user._id;
    let user = await User.findById(id).populate('posts');
    let following = user.following;
    let feed = await Post.find({ user: { $in: following } }).populate('user');
    feed = feed.slice(0, 20);
    res.render('user/feed', { feed });
}));

app.get('/dashboard', isLoggedIn, updateRefreshToken, catchAsync(async (req, res) => {
    let id = req.user._id;
    let user = await User.findById(id).populate('posts');
    let playlists = await getPlaylists(user);
    res.render('user/dashboard', { user, playlists: playlists });
}));



app.get('/explore', isLoggedIn, updateRefreshToken, catchAsync(async (req, res) => {
    let id = req.user._id;
    let user = await User.findById(id).populate('posts');
    let following = user.following;
    let feed = await Post.find({ user: { $in: following } }).populate('user');
    let ip = req.ip
        || req.connection.remoteAddress
        || req.socket.remoteAddress
        || req.connection.socket.remoteAddress;
    if (ip == "::1") {
        ip = "65.220.23.226"
    }
    let geo = geoip.lookup(ip);
    let lat = null;
    let lon = null;
    let city = null;
    try {
        lat = geo.ll[0];
        lon = geo.ll[1];
        city = geo.city;
    } catch {

        lat = 40.730610;
        lon = -73.935242;
        city = "Washington DC";
    }
    let maxDistanceInKilometers = 1000;
    let nearbyPosts = await filterPostsByLocation(lat, lon, maxDistanceInKilometers);

    let year = await getMostViewedPost(Date.now() - 365 * 24 * 60 * 60 * 1000, Date.now())
    let month = await getMostViewedPost(Date.now() - 30 * 24 * 60 * 60 * 1000, Date.now())
    let week = await getMostViewedPost(Date.now() - 7 * 24 * 60 * 60 * 1000, Date.now())
    let day = await getMostViewedPost(Date.now() - 1 * 24 * 60 * 60 * 1000, Date.now())
    if (day == null) {
        day = year;
    }
    if (week == null) {
        week = year;
    }
    if (month == null) {
        month = year;
    }

    let recentPosts = await Post.find({}).sort({ createdAt: -1 }).limit(10).populate('user');







    res.render('user/explore', { user, feed, nearbyPosts, recentPosts, city, year, month, week, day });
}));


app.get('/logout', (req, res) => {
    req.logout(
        function (err) {
            if (err) {
                req.flash('error', "Something went wrong");
                res.redirect('/dashboard');
            } else {
                req.flash('success', 'Goodbye!');
                res.redirect('/');
            }
        }

    );

});


app.post('/posts', isLoggedIn, updateRefreshToken, catchAsync(async (req, res) => {
    let userId = req.user._id;
    let user = await User.findById(userId);
    let playlistId = req.body.playlistId;
    let name = req.body.name;
    let description = req.body.description || "This is a playlist";
    let images = null;
    if (!(JSON.parse(req.body.image)[0])) {
        images = "https://st3.depositphotos.com/23594922/31822/v/600/depositphotos_318221368-stock-illustration-missing-picture-page-for-website.jpg";
    } else {
        images = JSON.parse(req.body.image)[0].url;
    }
    let date = new Date();
    let ip = req.ip
        || req.connection.remoteAddress
        || req.socket.remoteAddress
        || req.connection.socket.remoteAddress;
    if (ip == "::1") {
        ip = "65.220.23.226"
    }

    let geo = geoip.lookup(ip);
    let lat = null;
    let lon = null;
    try {
        lat = geo.ll[0];
        lon = geo.ll[1];
    } catch {

        lat = 40.730610;
        lon = -73.935242;
    }

    let newPost = new Post({ location: [lat, lon], name, description, images, playlistId, user, date, likes: [], dislikes: [] });
    await newPost.save();
    await user.posts.push(newPost);
    await user.save();
    req.flash('success', 'Successfully created post!');
    res.redirect('/dashboard');


}));

app.delete('/posts', isLoggedIn, catchAsync(async (req, res) => {
    let { playlistId } = req.body;
    let userId = req.user._id;
    await Post.deleteOne({ _id: playlistId })
    let user = await User.findById(userId)
    user.posts = user.posts.filter(e => e != playlistId)

    await user.save()
    req.flash('success', 'Successfully deleted post!');
    res.redirect('/dashboard')
}));

app.get('/posts/create', isLoggedIn, updateRefreshToken, catchAsync(async (req, res) => {
    let id = req.user._id;
    let user = await User.findById(id);
    let playlists = await getPlaylists(user);
    res.render('post/create', { user, "playlists": playlists.items });
}));

app.post('/comment', isLoggedIn, catchAsync(async (req, res) => {
    let { postId, comment } = req.body;
    let post = await Post.findById(postId);
    post.views = post.views - 1;
    let userId = req.user._id;
    let date = new Date();
    let newComment = new Comment({ userId, comment, date, postId });
    await newComment.save();
    await post.save();
    res.send('Success');
}));

app.post('/post/like', isLoggedIn, catchAsync(async (req, res) => {
    let { postId } = req.body;
    let userId = req.user._id;
    let post = await Post.findById(postId);
    let index;
    post.views = post.views - 1;

    if (hasLikedPost(post, userId)) {
        for (let i = 0; i < post.likes.length; i++) {
            if (post.likes[i].toString() == userId.toString()) {
                index = i
            }
        }
        post.likes.splice(index, 1);
        await post.save();
        return res.send('Success');

    }
    post.likes.push(userId);


    await post.save();
    return res.send('Success');
}));

app.post('/post/dislike', isLoggedIn, catchAsync(async (req, res) => {
    let { postId } = req.body;
    let userId = req.user._id;
    let post = await Post.findById(postId);
    post.views = post.views - 1;
    if (hasDislikedPost(post, userId)) {
        for (let i = 0; i < post.dislikes.length; i++) {
            if (post.dislikes[i].toString() == userId.toString()) {
                index = i
            }
        }
        post.dislikes.splice(index, 1);
        await post.save();
        return res.send('Success');

    }

    post.dislikes.push(userId);
    await post.save();
    return res.send('Success');
}));

app.delete('/comment', isLoggedIn, catchAsync(async (req, res) => {
    let { commentId } = req.body;
    let comment = await Comment.deleteOne({ _id: commentId });

    res.send('Success');
}));
app.get('/user/:id/profilepicture', isLoggedIn, catchAsync(async (req, res) => {
    let id = req.params.id;
    var pngFiles = [];
    await fs.readdir('public/mycollection/png', (err, files) => {
        if (err) {
            console.log(err);
            res.send('Error')
        } else {
            pngFiles = files;
            res.render('user/profile', { id, pngFiles });

        }
    });

}));

app.post('/user/:id/profilepicture', isLoggedIn, catchAsync(async (req, res) => {
    let userId = req.body.userId;
    let { profilePic } = req.body;
    let user = await User.findById(userId);
    console.log(user)
    user.profilePicture = "/mycollection/png/" + profilePic;
    await user.save();
    req.flash('success', 'Successfully updated profile picture!');
    res.redirect('/dashboard');

}
));
app.get('/user/search', isLoggedIn, catchAsync(async (req, res) => {
    res.render('user/search');


}));
app.get('/user/:id/', isLoggedIn, catchAsync(async (req, res) => {
    let id = req.params.id;
    let myid = req.user._id;
    let myUser = await User.findById(myid);
    let user = await User.findById(id).populate('posts');
    if (!user) {
        req.flash('error', 'User not found!');
        return res.redirect('/dashboard');
    }
    let doesFollow = hasFollowedUser(myUser, user);
    let playlists = await getPlaylists(user);
    res.render('user/otheruser', { user, playlists, doesFollow });
}));

app.post('/user/follow', isLoggedIn, catchAsync(async (req, res) => {
    let { otherUser } = req.body;
    let userId = req.user._id;
    let user = await User.findById(userId);
    let otheruser = await User.findById(otherUser);
    if (hasFollowedUser(user, otherUser)) {
        return res.send('You have already followed this user');
    }
    else {

        await user.following.push(otherUser);
        await otheruser.followers.push(userId);
        await user.save();
        await otheruser.save();
        res.send('Success');
    }
}));




app.get('/search', isLoggedIn, catchAsync(async (req, res) => {
    try {
        const query = req.query.q;
        if (query.length < 1) return res.json([]);

        console.log('This is a query', query)
        const users = await User.find({
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } },
            ]
        });
        return res.json(users.slice(0, 10));
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error' });
    }



}));






app.use("*", (req, res, next) => {
    next(new ExpressError("Page not found", 404));

});

app.use((err, req, res, next) => {
    const { status = 500, message = "Something went wrong" } = err;
    console.log(err.stack);
    res.render('error', { status, err });
});



app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});