/* jshint esversion:6, node: true */

const MongoClient = require('mongodb').MongoClient;
const assert      = require('assert');
const dbConnStr   = `mongodb://localhost:27017/crunchbase`;

MongoClient.connect(dbConnStr, (err, db) => {
  
  assert.equal(err, null);
  console.log('Successfully connected to MongoDB');
  
  let numToRemove = 0;
  
  const query      = { 'permalink' : { '$exists' : true, '$ne' : null } };
  const projection = { 'permalink' : 1, 'updated_at' : 1 };
  let previous     = { 'permalink' : '', 'updated_at' : '' };
  
  const cursor = db.collection('companies').find(query);
  cursor.project(projection);
  cursor.sort({ 'permalink' : 1 });
  cursor.forEach(
    function(doc) {
      
      if ((doc.permalink === previous.permalink) && (doc.updated_at === previous.updated_at)) {
        console.log(doc.permalink);
        numToRemove += 1;
        let filter = { '_id' : doc._id };
        db.collection('companies').deleteOne(filter, (err, res) => {
          
          assert.equal(err, null);
          console.log(res.result);
          
        });
        
      }
      
      previous = doc;
      
    },
    function(err) {
      assert.equal(err, null);
    }
  );
  
});