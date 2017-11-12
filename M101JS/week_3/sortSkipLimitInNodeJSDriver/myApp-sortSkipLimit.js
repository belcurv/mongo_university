/* jshint esversion:6, node:true */

const MongoClient     = require('mongodb').MongoClient;
const commandLineArgs = require('command-line-args');
const assert          = require('assert');
const dbConnectionStr = 'mongodb://localhost:27017/crunchbase';

/* ============================ utility methods ============================ */

// build db query document
const queryDocument = (options) => {
  
  let query = {
    'founded_year' : {
      '$gte' : options.firstYear,
      '$lte' : options.lastYear
    }
  };
  
  if ('employees' in options) {
    query.number_of_employees = { '$gte' : options.employees };
  }
  
  return query;
  
};


// build projection document
const projectionDocument = () => {
  return {
    '_id'                 : 0,
    'name'                : 1,
    'founded_year'        : 1,
    'number_of_employees' : 1
  };
};


// build command line options object
const commandLineOptions = () => {
  
  const cli = commandLineArgs([
    { name : 'firstYear', alias : 'f', type : Number },
    { name : 'lastYear',  alias : 'l', type : Number },
    { name : 'employees', alias : 'e', type : Number },
    { name : 'skip',      type : Number, defaultValue : 0 },
    { name : 'limit',     type : Number, defaultValue : 20000 }
  ]);
  
  const options = cli.parse();
  
  if ( !(('firstYear' in options) && ('lastYear' in options))) {
    console.log(cli.getUsage({
      title       : 'Usage',
      description : 'The first two options below are required. The rest are optional.'
    }));
    process.exit();
  }
  
  return options;
  
};


/* ========================= connect to db & query ========================= */

MongoClient.connect(dbConnectionStr, (err, db) => {
  
  assert.equal(err, null);
  console.log('Successfully connected to MongoDB');
  
  const options    = commandLineOptions();
  const query      = queryDocument(options);
  const projection = projectionDocument();
  const cursor     = db.collection('companies').find(query);
  
  let numMatches   = 0;
  
  cursor.project(projection);
  
  cursor.limit(options.limit);
  cursor.skip(options.skip);
  
//  cursor.sort({ founded_year: 1 });
  cursor.sort([
    ['founded_year', 1],
    ['number_of_employees', -1]
  ]);
  
  cursor.forEach(
    function(doc) {
      numMatches += 1;
      console.log(doc.name + '\n\tfounded ' + doc.founded_year +
                 '\n\t' + doc.number_of_employees + ' employees');
    },
    function(err) {
      assert.equal(err, null);
      console.log('Our query was: ' + JSON.stringify(query));
      console.log('Matching documents: ' + numMatches);
      return db.close();
    }
  );
  
});
