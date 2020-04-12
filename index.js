const bcrypt = require('bcrypt');
const saltRounds = 10;

const express = require('express');
const passport = require('passport');
const connectEnsureLogin = require('connect-ensure-login');
let LocalStrategy = require('passport-local').Strategy;

const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

const adapter = new FileSync('db.json')
const db = low(adapter)

const timeslots = {
    MONDAY: {
        MORNING: "lundi matin",
        AFTERNOON: "lundi après-midi"
    },
    TUESDAY: {
        MORNING: "mardi matin",
        AFTERNOON: "mardi après-midi"
    },
    WEDNESDAY: {
        MORNING: "mercredi matin",
        AFTERNOON: "mercredi après-midi"
    },
    THURSDAY: {
        MORNING: "jeudi matin",
        AFTERNOON: "jeudi après-midi"
    },
    FRIDAY: {
        MORNING: "vendredi matin",
        AFTERNOON: "vendredi après-midi"
    },
    SATURDAY: {
        MORNING: "samedi matin",
        AFTERNOON: "samedi après-midi"
    }
}

let baseStonks = [
    {
        timeslot: 'lundi matin',
        price: 'undefined'
    },
    {
        timeslot: 'lundi après-midi',
        price: 'undefined'
    },
    {
        timeslot: 'mardi matin',
        price: 'undefined'
    },
    {
        timeslot: 'mardi après-midi',
        price: 'undefined'
    },
    {
        timeslot: 'mercredi matin',
        price: 'undefined'
    },
    {
        timeslot: 'mercredi après-midi',
        price: 'undefined'
    },
    {
        timeslot: 'jeudi matin',
        price: 'undefined'
    },
    {
        timeslot: 'jeudi après-midi',
        price: 'undefined'
    },
    {
        timeslot: 'vendredi matin',
        price: 'undefined'
    },
    {
        timeslot: 'vendredi après-midi',
        price: 'undefined'
    },
    {
        timeslot: 'samedi matin',
        price: 'undefined'
    },
    {
        timeslot: 'samedi après-midi',
        price: 'undefined'
    }

];

// Configure the local strategy for use by Passport.
//
// The local strategy require a `verify` function which receives the credentials
// (`username` and `password`) submitted by the user.  The function must verify
// that the password is correct and then invoke `cb` with a user object, which
// will be set at `req.user` in route handlers after authentication.
passport.use(new LocalStrategy(
    (username, password, cb) => {

        let user = db.get('users')
            .find({ username: username })
            .value();

        if (user != undefined) {

            if (bcrypt.compareSync(password, user.password)) {
                return cb(null, user);
            }
        }
        return cb(null, false);
    }));


// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  The
// typical implementation of this is as simple as supplying the user ID when
// serializing, and querying the user record by ID from the database when
// deserializing.
passport.serializeUser(function (user, cb) {
    cb(null, user.username);
});

passport.deserializeUser(function (id, cb) {

    let user = db.get('users')
        .find({ username: id })
        .value();

    if (user != undefined) {
        return cb(null, user);
    }
});

// Create a new Express application.
var app = express();

// Configure view engine to render EJS templates.
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// Use application-level middleware for common functionality, including
// logging, parsing, and session handling.
app.use(require('morgan')('combined'));
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(require('express-session')({ secret: 'sauc', resave: false, saveUninitialized: false }));

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());


db.defaults({ users: [] })
    .write();

// Define routes.
app.get('/',
    function (req, res) {
        res.render('home', { user: req.user });
    });

app.get('/login',
    function (req, res) {
        res.render('login');
    });

app.post('/login',
    passport.authenticate('local', { failureRedirect: '/login' }),
    function (req, res) {
        res.redirect('/');
    });

app.get('/register',
    function (req, res) {
        res.render('register');
    });

app.post('/register',
    function (req, res) {

        let username = req.body.username;
        let pwd = bcrypt.hashSync(req.body.password, saltRounds);

        let user = db.get('users')
            .find({ username: username })
            .value();

        if (user == undefined) {

            db.get('users')
                .push({ username: username, password: pwd, stonks: baseStonks })
                .write();

            res.redirect('/login');
        } else {
            res.redirect('/register');
        }
    });

app.get('/logout',
    function (req, res) {
        req.logout();
        res.redirect('/');
    });

app.get('/stonks',
    connectEnsureLogin.ensureLoggedIn(),
    function (req, res) {
        res.render('stonks', { user: req.user, currentTimeslot: getCurrentTimeslot(), spectateMode: false });
    });

app.get('/stonks/reset',
    connectEnsureLogin.ensureLoggedIn(),
    function (req, res) {
        let user = db.get('users')
            .find({ username: req.user.username })
            .assign({ stonks: baseStonks })
            .write();
        res.redirect('/stonks');
    });

app.get('/stonks/:username',
    connectEnsureLogin.ensureLoggedIn(),
    function (req, res) {
        let username = req.params.username;
        let user = db.get('users')
            .find({ username: username })
            .value();

        if (user == undefined) {
            res.redirect('/stonks');
        } else {
            res.render('stonks', { user: user, currentTimeslot: getCurrentTimeslot(), spectateMode: true });
        }
    });

app.post('/stonks',
    connectEnsureLogin.ensureLoggedIn(),
    function (req, res) {
        let price = req.body.turntipPrice;

        let currentTimeslot = getCurrentTimeslot();

        let newStonks = req.user.stonks
        let index = newStonks.findIndex(x => x.timeslot === currentTimeslot)
        if (index !== -1) {
            newStonks[index].price = price;
        }/* else {
            newStonks.push({ timeslot: currentTimeslot, price: price });
        }*/

        let user = db.get('users')
            .find({ username: req.user.username })
            .assign({ stonks: newStonks })
            .write();

        res.redirect('/stonks');
    });

app.listen(8080);

let getCurrentTimeslot = () => {
    let date = new Date();
    let day = date.getDay();
    let hour = date.getHours();

    switch (day) {
        case 0:
            if (hour < 12) {
                return timeslots.MONDAY.MORNING;
            } else {
                return timeslots.MONDAY.AFTERNOON;
            }
            break;
        case 1:
            if (hour >= 12) {
                return timeslots.MONDAY.MORNING;
            } else {
                return timeslots.MONDAY.AFTERNOON;
            }
            break;
        case 2:
            if (hour >= 12) {
                return timeslots.TUESDAY.MORNING;
            } else {
                return timeslots.TUESDAY.AFTERNOON;
            }
            break;
        case 3:
            if (hour >= 12) {
                return timeslots.WEDNESDAY.MORNING;
            } else {
                return timeslots.WEDNESDAY.AFTERNOON;
            }
            break;
        case 4:
            if (hour >= 12) {
                return timeslots.THURSDAY.MORNING;
            } else {
                return timeslots.THURSDAY.AFTERNOON;
            }
            break;
        case 5:
            if (hour >= 12) {
                return timeslots.FRIDAY.MORNING;
            } else {
                return timeslots.FRIDAY.AFTERNOON;
            }
            break;
        case 6:
            if (hour >= 12) {
                return timeslots.SATURDAY.MORNING;
            } else {
                return timeslots.SATURDAY.AFTERNOON;
            }
            break;
        default:
            return "sunday";
    }
}