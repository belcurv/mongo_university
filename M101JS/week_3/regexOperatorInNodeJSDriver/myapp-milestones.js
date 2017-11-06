/* jshint esversion:6, node:true */

// EXAMPLE USAGE: node app -o <overview string> -m <milestones string>

const MongoClient     = require('mongodb').MongoClient;
const commandLineArgs = require('command-line-args');
const assert          = require('assert');
const dbConnectionStr = 'mongodb://localhost:27017/crunchbase';


/* ============================ utility methods ============================ */

const queryDocument = (options) => {
  
  console.log(options);
  
  let query = {};
  
  if ('overview' in options) {
    query.overview = { '$regex' : options.overview, '$options' : 'i' };
  }
  
  if ('milestones' in options) {
    // use [array] notation to add dot.notation key to our options object
    query['milestones.source_description'] = {
      '$regex' : options.milestones, '$options' : 'i'
    };
  }
  
  return query;
};


const projectionDocument = (options) => {

  let projection = {
    '_id'          : 0,
    'name'         : 1,
    'founded_year' : 1
  };

  if ('overview' in options) {
    projection.overview = 1;
  }
  
  if ('milestones' in options) {
    projection['milestones.source_description'] = 1;
  }
  
  return projection;
};


const commandLineOptions = () => {

  const cli = commandLineArgs([
    { name: 'overview',   alias: 'o', type: String },
    { name: 'milestones', alias: 'm', type: String }
  ]);

  let options = cli.parse();

  if (Object.keys(options).length < 1) {
    console.log(cli.getUsage({
      title       : 'Usage',
      description : 'You must supply at least one options. See below.'
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

  let cursor = db.collection('companies').find(query);
  cursor.project(projection);

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
