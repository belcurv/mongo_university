
var MongoClient = require('mongodb').MongoClient,
    assert      = require('assert'),
    dbUrl       = 'mongodb://localhost:27017/crunchbase';


MongoClient.connect(dbUrl, function(err, db) {

  console.log("Successfully connected to MongoDB.");
    assert.equal(err, null);

    var query      = { "category_code" : "biotech"};
    var projection = { "name": 1, "category_code": 1, "_id": 0};

    var cursor = db
      .collection('companies')
      .find(query);

    cursor.project(projection);

    cursor.forEach(
        function(doc) {
            console.log(doc.name + " is a " + doc.category_code + " company.");
            console.log(doc);
        },
        function(err) {
            assert.equal(err, null);
            return db.close();
        }
    );

});
