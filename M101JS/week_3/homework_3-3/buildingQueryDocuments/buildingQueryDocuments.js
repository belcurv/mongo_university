/* jshint esversion:6, node:true */

var MongoClient = require('mongodb').MongoClient,
    assert      = require('assert');

var allOptions = [
    {
        firstYear : 2002,
        lastYear  : 2016,
        city      : "Palo Alto"
    },
    {
        lastYear  : 2010,
        city      : "New York"
    },
    {
        city      : "London"
    }
];

var numQueriesFinished = 0;
var companiesSeen      = {};

for (var i = 0; i < allOptions.length; i++) {
    var query = queryDocument(allOptions[i]);
    queryMongoDB(query, i);
}


function queryMongoDB(query, queryNum) {

    MongoClient.connect('mongodb://localhost:27017/crunchbase', function(err, db) {
        
        assert.equal(err, null);
        console.log("Successfully connected to MongoDB for query: " + queryNum);
        
        var cursor = db.collection('companies').find(query);
        
        var numMatches = 0;
        
        cursor.forEach(
            function(doc) {
                numMatches = numMatches + 1;
                if (doc.permalink in companiesSeen) return;
                companiesSeen[doc.permalink] = doc;
            },
            function(err) {
                assert.equal(err, null);
                console.log("Query " + queryNum + " was:" + JSON.stringify(query));
                console.log("Matching documents: " + numMatches);
                numQueriesFinished = numQueriesFinished + 1;
                if (numQueriesFinished == allOptions.length) {
                    report();
                }
                return db.close();
            }
        );
        
    });
    
}


function queryDocument(options) {

    console.log(options);
    
    // TODO
    // match the regular expression "social-networking"/
    var query = {
        "tag_list": {$regex: 'social-networking'}         
    };

    
    // TODO
    // if both firstYear and lastYear appear in the options object,
    // we will match documents that have a value for the "founded_year"
    // field of companies documents in the correct range. 
    if (("firstYear" in options) && ("lastYear" in options)) {
        query.founded_year = {
            "$gte" : options.firstYear,
            "$lte" : options.lastYear
        };
    } else if ("firstYear" in options) {
        query.founded_year = { "$gte": options.firstYear };
    } else if ("lastYear" in options) {
        query.founded_year = { "$lte": options.lastYear };
    }

    // TODO
    // match on the "offices.city" field. The "offices" field stores an array
    // in which each element is a nested document containing fields that
    // describe a corporate office. Each office document contains a "city"
    // field.
    if ("city" in options) {
        query['offices.city'] = options.city;
    }
        
    return query;
    
}


function report(options) {
    var totalEmployees = 0;
    for (var key in companiesSeen) {
        totalEmployees = totalEmployees + companiesSeen[key].number_of_employees;
    }

    var companiesList = Object.keys(companiesSeen).sort();
    console.log("Companies found: " + companiesList);
    console.log("Total employees in companies identified: " + totalEmployees);
    console.log("Total unique companies: " + companiesList.length);
    console.log("Average number of employees per company: " + Math.floor(totalEmployees / companiesList.length));
}









