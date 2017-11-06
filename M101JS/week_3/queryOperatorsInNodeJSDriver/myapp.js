/* jshint esversion:6, node:true */

const MongoClient     = require('mongodb').MongoClient;
const commandLineArgs = require('command-line-args');
const assert          = require('assert');

const dbCOnnectionStr = 'mongodb://localhost:27017/crunchbase';


/* ============================ utility methods ============================ */

/** queryDocument
 *  @param    {object} options Commnand line paramters passed during execution
 *  @returns  {object}         Database query
*/
const queryDocument = (options) => {
  console.log(options);

  // queries always include first and last year
  let query = {
    'founded_year' : {
      '$gte' : options.firstYear,
      '$lte' : options.lastYear
    }
  };

  // queries optionally include number of employees
  if ('employees' in options) {
    query.number_of_employees = {
      '$gte' : options.employees
    };
  }

  return query;

};


/** commandLineOptions
 *  @param /None
 *  @returns {object} Command line options object
*/
const commandLineOptions = () => {
  let cli = commandLineArgs([
    { name : 'firstYear', alias : 'f', type: Number },
    { name : 'lastYear',  alias : 'l', type: Number },
    { name : 'employees', alias : 'e', type: Number }
  ]);

  let options = cli.parse();

  if ( !( ('firstYear' in options) && ('lastYear' in options))) {
    console.log(cli.getUsage({
      title : 'Usage',
      description: 'The first two options below are required. The rest are optional.'
    }));
    process.exit();
  }

  return options;

};

/* ============================= connect to db ============================= */

MongoClient.connect(dbCOnnectionStr, (err, db) => {

  let numMatches = 0;

  assert.equal(err, null);
  console.log('Successfully connected to MongoDB');

  const query      = queryDocument(commandLineOptions());
  const projection = {
    '_id'                 : 0,
    'name'                : 1,
    'founded_year'        : 1,
    'number_of_employees' : 1,
    'crunchbase_url'      : 1
  };

  const cursor = db
    .collection('companies')
    .find(query, projection);

  cursor.forEach(
    function(doc) {
      numMatches += 1;
      console.log(doc);
    },
    function(err) {
      assert.equal(err, null);
      console.log('Our query was: ', JSON.stringify(query));
      console.log('Matching documents: ' + numMatches);
      return db.close();
    }
  );

});
