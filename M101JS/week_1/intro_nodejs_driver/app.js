var MongoClient = require('mongodb').MongoClient,
    assert     = require('assert');

var url = 'mongodb://localhost:27017/video';

MongoClient.connect(url, function(err, db) {

  assert.equal(null, err);
  console.log('Successfully connected to server');

  //f find some documents in the collection
  db.collection('movies')
    .find({})                       // returns a cursor!
    .toArray(function(err, docs) {  // consumes entire result set, produces array

      // print the documents returned
      docs.forEach(function(doc) {
        console.log(doc.title);
      });

      // close the DB
      db.close();

    });

    // declare Success
    console.log("Called find()");

});
