/** app.js
    Mongo University M101JS Homework Challenge Project
*/


/* ================================= SETUP ================================= */

const express     = require('express');
const app         = express();
const engines     = require('consolidate');
const bodyParser  = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
const assert      = require('assert');
const morgan      = require('morgan');
const port        = process.env.PORT || 3000;

const dbUrl       = 'mongodb://localhost:27017/video';


/* ================================ CONFIG ================================= */

// log http requests
app.use(morgan('dev'));

// enable http request body parsing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended : true }));

// enable view engine
app.engine('html', engines.nunjucks);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');


/* ============================= CONNECT TO DB ============================= */

MongoClient.connect(dbUrl, (err, db) => {
    
    // check for connection errors
    assert.equal(null, err);
    console.log('Successfully connected to MongoDB');
    
    
    /* ============================== ROUTES =============================== */
    
    // render home page
    app.get('/', (req, res) => {
        res.render('home', {});
    });
    
    
    // render movies list
    app.get('/movies', (req, res) => {
        db.collection('movies')
            .find({})
            .toArray( (err, docs) => {
                res.render('movies', {'movies' : docs });
            });
    });
    
    
    // handle form submits
    app.post('/movies', (req, res) => {
        let newMovie = Object.assign({}, req.body);
        db.collection('movies').insert(newMovie);
        res.redirect(301, '/movies');
    });
    
    
    // handle missing routes
    app.use( (req, res) => {
       res.sendStatus(404); 
    });
    
    
    /* =========================== START SERVER ============================ */

    app.listen(port, () => {
        console.log(`Express server listening on port ${port}`);
    });
    
});
