const User = require('../models/user');
const Post = require('../models/posts');
const axios = require('axios');
const fs = require('fs');
var client_id = "c0e31556068844569a27aab28c663e78"
var client_secret = "a8704ddff0c440d4a1c73eed1fca7614"
const mongoose = require('mongoose');
const SpotifyWebApi = require('spotify-web-api-node');
const { faker } = require('@faker-js/faker');
const geoip = require('fast-geoip');
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
const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = process.env.CRYPTO_KEY;





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






const updateRefreshToken = async (user_id, client_id, client_secret, refreshToken) => {

    let authString = Buffer.from(client_id + ':' + client_secret, 'utf-8').toString('base64');
    let data = await axios.post('https://accounts.spotify.com/api/token', {
        "grant_type": 'refresh_token',
        "refresh_token": refreshToken
    }, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + authString
        }
    })
    let newUser = await User.findById(user_id)
    newUser.lastRefresh = Date.now();
    newUser.accessToken = data.data.access_token;
    await newUser.save();


}





let getTracks = async function (user) {


    let this_user = await User.findById(user._id);
    let spotifyApi = new SpotifyWebApi({
        clientId: client_id,
        clientSecret: client_secret,
        redirectUri: 'https://groovify-spotify.vercel.app/callback'
    });
    spotifyApi.setAccessToken(this_user.accessToken);
    spotifyApi.setRefreshToken(this_user.refreshToken);
    let ids = [];
    await spotifyApi.getMyTopTracks({
        limit: 1,
        time_range: 'short_term'
    }).then(function (data) {
        ids = data.body.items.map(object => object.id);



    }, function (err) {
        console.log('Something went wrong!', err);
    }
    );
    return ids;

}

let getRecommendations = async function (user, tracks) {
    let this_user = await User.findById(user._id);
    let spotifyApi = new SpotifyWebApi({
        clientId: client_id,
        clientSecret: client_secret,
        redirectUri: 'https://groovify-spotify.vercel.app/callback'
    });
    spotifyApi.setAccessToken(this_user.accessToken);
    spotifyApi.setRefreshToken(this_user.refreshToken);

    let recommendations = []

    await spotifyApi.getRecommendations({
        min_energy: 0.4,
        seed_tracks: tracks,
        min_popularity: 50
    })
        .then(function (data) {
            recommendations = data.body;
        }, function (err) {
            console.log("Something went wrong!", err);
        });

    return recommendations;
}


let createPlaylist = async function (user, playlistName, playlistDescription) {
    let this_user = await User.findById(user._id);
    let spotifyApi = new SpotifyWebApi({
        clientId: client_id,
        clientSecret: client_secret,
        redirectUri: 'https://groovify-spotify.vercel.app/callback'
    });
    spotifyApi.setAccessToken(this_user.accessToken);
    spotifyApi.setRefreshToken(this_user.refreshToken);
    let tracks = await getTracks(user);
    let recs = await getRecommendations(user, tracks);
    recs = recs.tracks.map(object => object.id);
    all_tracks = tracks.concat(recs);
    let trackUris = all_tracks.map(id => 'spotify:track:' + id);

    let playlist = await spotifyApi.createPlaylist(playlistName, { 'description': playlistDescription, 'public': false })


    await spotifyApi.addTracksToPlaylist(playlist.body.id, trackUris);

    return playlist.body.id;

}

let createPlaylists = async function (users) {
    for (let i = 0; i < users.length; i++) {
        let name = faker.word.words({ count: { min: 1, max: 5 } }) // generates a fake playlist name
        let description = faker.word.words({ count: { min: 5, max: 10 } }) // generates a fake description
        let userId = users[i]._id;
        let refresh_token = users[i].refreshToken;
        await updateRefreshToken(userId, client_id, client_secret, refresh_token);
        let playlistId = await createPlaylist(users[i], name, description);
        let user = await User.findById(userId);
        let spotifyApi = new SpotifyWebApi({
            clientId: client_id,
            clientSecret: client_secret,
            redirectUri: 'https://groovify-spotify.vercel.app/callback'
        });
        spotifyApi.setAccessToken(user.accessToken);
        spotifyApi.setRefreshToken(user.refreshToken);

        let playlist = await spotifyApi.getPlaylist(playlistId);
        let playlistImages = playlist.body.images.map(object => object.url);
        let images = null;

        if (!(playlistImages[0])) {
            images = "https://st3.depositphotos.com/23594922/31822/v/600/depositphotos_318221368-stock-illustration-missing-picture-page-for-website.jpg";
        } else {
            images = playlistImages[0];
        }
        let date = new Date();
        let ip = faker.internet.ip();
        let geo = geoip.lookup(ip);
        if (!geo) {
            geo = { ll: [38.9072, 77.0369] }
        }
        let views = Math.floor(Math.random() * 1000);
        let newPost = new Post({ location: geo.ll, views, name, description, images, playlistId, user, date, likes: [], dislikes: [] });
        await newPost.save();
        await user.posts.push(newPost);
        await user.save();
        console.log('Saved Post')

    }
}

//Decrypt function
function decrypt(hash) {
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, Buffer.from(hash.IV, 'hex'));

    const decrpyted = Buffer.concat([decipher.update(Buffer.from(hash.content, 'hex')), decipher.final()]);

    return decrpyted.toString();
}

//Get Fake Users
let getUsers = function () {
    const readFile = fs.readFileSync('users.json', 'utf8');
    console.log(readFile);
    const decryptedData = decrypt(JSON.parse(readFile));
    const finalData = JSON.parse(decryptedData);
    return finalData;

}
const fakeUsers = getUsers();



//get 20 random fake users
let randomUsers = [];
for (let i = 0; i < 5; i++) {
    let random = Math.floor(Math.random() * fakeUsers.length);
    randomUsers.push(fakeUsers[random]);
}
createPlaylists(randomUsers).then(() => {
    console.log('Done');
    process.exit(0);
}).catch(err => {
    console.log(err);
    process.exit(1);
}
)















