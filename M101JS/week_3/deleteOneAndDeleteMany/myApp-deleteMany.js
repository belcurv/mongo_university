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
  let markedForRemoval = [];
  
  const cursor = db.collection('companies').find(query);
  cursor.project(projection);
  cursor.sort({ 'permalink' : 1 });
  cursor.forEach(
    function(doc) {
      
      if ((doc.permalink === previous.permalink) && (doc.updated_at === previous.updated_at)) {
        markedForRemoval.push(doc._id);        
      }
      
      previous = doc;
      
    },
    // once cursor is done iterating ...
    function(err) {
      assert.equal(err, null);
      
      // look at the `_id` field, and for all _id in `markedForRemoval`, delete!
      let filter = { '_id' : { '$in': markedForRemoval } };
      
      db.collection('companies').deleteMany(filter, (err, res) => {
        
        console.log(res.result);
        console.log(markedForRemoval.length + ' documents removed.');
        return db.close();
      });
    }
  );
  
});