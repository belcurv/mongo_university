/* jshint esversion:6, node:true */

// EXAMPLE USAGE: node app 

const MongoClient     = require('mongodb').MongoClient;
const commandLineArgs = require('command-line-args');
const assert          = require('assert');
const dbConnectionStr = 'mongodb://localhost:27017/crunchbase';


/* ============================ utility methods ============================ */

const queryDocument = (options) => {
  console.log(options);
  let query = {
    'founded_year' : {
      '$gte' : options.firstYear,
      '$lte' : options.lastYear
    }
  };
  
  if ('employees' in options) {
    query.number_of_employees = { '$gte' : options.employees };
  }
  
  if ('ipo' in options) {
    if (options.ipo === 'yes') {
      query['ipo.valuation_amount'] = { '$exists' : true, '$ne' : null };
    } else if (options.ipo === 'no') {
      query['ipo.valuation_amount'] = null;
    }
  }
  
  return query;
};


const projectionDocument = (options) => {
  let projection = {
    '_id'          : 0,
    'name'         : 1,
    'founded_year' : 1,
    'number_of_employees' : 1,
    'ipo.valuation_emount' : 1
  };
  return projection;
};

const commandLineOptions = () => {

  const cli = commandLineArgs([
    { name: 'firstYear', alias: 'f', type: Number },
    { name: 'lastYear',  alias: 'l', type: Number },
    { name: 'employees', alias: 'e', type: Number },
    { name: 'ipo',       alias: 'i', type: String }
  ]);

  let options = cli.parse();

  if ( !(('firstYear' in options) && ('lastYear' in options))) {
    console.log(cli.getUsage({
      title       : 'Usage',
      description : 'The first two options are require. The rest are optional.'
    }));
    process.exit();
  }

  return options;

};


/* ============================= connect to db ============================= */

MongoClient.connect(dbConnectionStr, (err, db) => {

  assert.equal(err, null);
  console.log('Successfully connected to MongoDB');

  let numMatches = 0;
  let options    = commandLineOptions();
  let query      = queryDocument(options);
  let projection = projectionDocument(options);

  let cursor = db.collection('companies').find(query, projection);

  cursor.forEach(
    function(doc) {
      numMatches += 1;
      console.log(doc);
    },
    function(err) {
      assert.equal(err, null);
      console.log('Our query was: ', JSON.stringify(query));
      console.log('Matching documents: ', numMatches);
      return db.close();
    }
  );

});
