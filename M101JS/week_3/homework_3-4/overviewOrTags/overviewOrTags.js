/* jshint esversion:6, node:true */

var MongoClient = require('mongodb').MongoClient,
    assert      = require('assert');

var allOptions = [
    {
        overview: "wiki",
    },
    {
        milestones: "CMO"
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

    var query = {};

    if ("overview" in options) {
        /*
           TODO: Write an assignment statement to ensure that if "overview" appears in the 
           options object, we will match documents that have the value of options.overview 
           in either the "overview" field or "tag_list" field of companies documents.

           You will need to use the $or operator to do this. As a hint, "$or" should be the
           name of the field you create in the query object.

           As with the example for options.milestones below, please ensure your regular
           expression matches are case insensitive.
        */
        query.$or = [
            {
                'overview' : {
                    '$regex'   : options.overview,
                    '$options' : 'i'
                }
            },
            {
                'tag_list' : {
                    '$regex'   : options.overview,
                    '$options' : 'i'
                }
            }
        ];
    }

    if ("milestones" in options) {
        query["milestones.source_description"] =
            {"$regex": options.milestones, "$options": "i"};
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





