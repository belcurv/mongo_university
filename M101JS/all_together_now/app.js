/* jshint esversion:6 */

const express     = require('express');
const app         = express();
const engines     = require('consolidate');
const MongoClient = require('mongodb').MongoClient;
const assert      = require('assert');

const dbUrl       = 'mongodb://localhost:27017/video';

app.engine('html', engines.nunjucks);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

MongoClient.connect(dbUrl, (err, db) => {

  // check for connection errors
  assert.equal(null, err);
  console.log('Successfully connected to MongoDB');

  // handle GET requests to root route
  app.get('/', (req, res) => {

    db.collection('movies')
      .find({})
      .toArray( (err, docs) => {
        res.render('movies', {'movies': docs });
      });

  });

  // handle file not found
  app.use( (req, res) => {
    res.sendStatus(404);
  });

  // start server
  let server = app.listen(3000, () => {
    let port = server.address().port;
    console.log('Server listening on port %s', port);
  });

});
