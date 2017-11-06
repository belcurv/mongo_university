# Week 3: The NodeJS Driver

Deeper dive on the Node.js driver; CRUD operations in the driver; Cursors; writing applications in the driver

#### find() and Cursors in the Node.js Driver

Going to use `mongoimport` to import a massive collection of CrunchBase data. Rather than working with a binary dump file with _mongorestore_, `mongoimport` allows us to import human-readable JSON. Make sure `mongod` is running and `cd` to `~/Documents/code/mongodb_university/M101JS/week_3/findAndCursorsInNodeJSDriver` and then:

```
mongoimport -d cruchbase -c companies companies.json
```

Then do a quick find to make sure it all worked

```
use crunchbase
db.companies.find().count()
// 18801
```

How can we use this dataset? With the `app.js` file in the above folder. Some notes...

When connecting using the Node MongoDB driver's `MongoClient`, we use pass in a connection string and a callback like this:

```
//         path takes://hostname :port /database
var dbPath = 'mongodb://localhost:27017/crunchbase';

MongoClient.connect(dbPath, function(err, db) {
  /*...*/
});
```

Port bindings. By default `mongod` starts up on port 27017. To change that:

```
mongod --port 27018
```

When we discuss replica sets and clustering, we'll neeed multiple mongod processes running on multiple ports.

Cursors in the NodeJS driver. If you don't do anything with the result of a `find` (like chain a `toArray()` method off of it), you get back a **cursor**. Store that in a variable:

```
var cursor = db.collection('companies').find(query);

cursor.forEach(
    function(doc) {
        console.log( doc.name + " is a " + doc.category_code + " company." );
    },
    function(err) {
        assert.equal(err, null);
        return db.close();
    }
);
```

In the above case, `.find(query)` returns a cursor. The cursor basically just **describes** our query - it doesn't actually make a request to the database! It doesn't actually ask for anything until we do something with the cursor (like the subsequent `forEach()`). Doing it this way, we're **streaming** data out of the database and into our application _as we need them_. Where "as we need them" is defined by the first callback in `cursor.forEach()`.

In contrast, when we chained the `toArray()` call, the driver sees that and understands that it actually needs to execute the query and make db requests.

Note that the cursor's `forEach()` method is **not the same** method as `Array.forEach()`. Cursor's `forEach` expects 2 arguments:

1.  A **callback** to execute for each document in the result set

2.  An **error handler** callback. This is called whenever there is an error or when the cursor is exhausted.

When a cursor requests documents, the response from the database system isn't necessary the entire results set. What happens is, MongoDB returns a **batch of documents** so the client application can start working with them. Once the first batch is done, the cursor makes a 2nd request for the next batch. And so on. This works nicely with `.forEach()` because it can process batches as they come in.

In contrast, the `toArray()` callback doesn't fire until all documents have been retrieved from the database system and the entire array is built, which means you're not getting any advantage from the fact that the driver and db system are working together to batch results to your application. Batching is provided to improve memory overhead and execution time.

#### Projection in the Node.js Driver

Projection documents with queries. It's important to know that the mongo shell and Node MongoDB driver have slightly different APIs. With respect to CRUD, as of MongoDB 3.2 the mongo shell and drivers adhere to the same CRUD spec - the methods are the same (`find`, `findOne`, `insertOne`, `inserMany`, etc). But how you access / implement these methods **is** different. Projection is a good example - you chain a call to `.project()`. This doesn't trigger a call to the db; rather, it adds additional detail to the query representation maintained by our cursor.

Following is from `M101JS/week_3/projectionInTheNodeDriver/app.js`

```
// define our query and projection docs
var query      = { "category_code" : "biotech"};
var projection = { "name": 1, "category_code": 1, "_id": 0};

// create our cursor
var cursor = db
  .collection('companies')
  .find(query);

// modify our cursor with project method
cursor.project(projection);

// finally, forEach employs the cursor to retrieve documents
cursor.forEach(
    function(doc) {
      /* yada yada yada ... */
```

Projection gives us a performance advantage. It means we're only sending over the wireand using network bandwidth for data we actually need. The performance impact can be massive if there are thousands of clients making requests to our db system. Using projection, responses take less time to assemble on the server, less time to transmit to clients, and less time to process within those clients.

**Problem**

>For the space marked with a TODO comment below, write ONE LINE OF CODE that will cause only the `name` and `number_of_employees` fields to be returned in query results. To simplify, please do not assign your projection document to a variable as we did in the lesson. Instead, just type the correct projection document directly into the call to the appropriate method.

```
var MongoClient = require('mongodb').MongoClient,
    assert = require('assert');

MongoClient.connect('mongodb://localhost:27017/crunchbase', function(err, db) {

    assert.equal(err, null);
    console.log("Successfully connected to MongoDB.");

    var query = {"founded_year": 2010};

    var cursor = db.collection('companies').find(query);

    // TODO
    cursor.project({"name":1, "number_of_employees":1, "_id":0});

    cursor.forEach(
        function(doc) {
            console.log(doc.name + " has " + doc.number_of_employees + " employees.");
        },
        function(err) {
            assert.equal(err, null);
            return db.close();
        }
    );

});
```

#### The CrunchBase Dataset

Reviewing the documents and fields in the CrunchBase dataset. We'll mainly use the following top-level fields: `overview`, `relationships`, `providerships`, `funding_rounds`, `offices`, `milestones`, and `ipo`


#### Query Operators in the Node.js Driver

Using the driver for applications that respond to input and query the db accordingly.



#### $regex in the Node.js Driver

Use the `$regex` operator in the NodeJS driver for searching text fields. See the sample application downloaded from the course site.

Example regex using the `$options` operator:

```
{
  "$regex"   : String
  "$options" : "i"  // case insensitive
}
```

MongoDB supports PERL compatible regular expressions. The PERL language defines the standard for regular expressions.

#### Dot Notation in the Node.js Driver

Say we want to query for documents based on embedded documents inside a record's `ipo` field:

```
"ipo": {
  "valuation_amount": Number,
  "valuation_currency_code" : String,
  "pub_year": Number,
  "etc" : "etc"
}
```

When constucting queries in javascript using the NodeJS driver, we can use regular methods to create and assign values to javascript objects (object literals, dot notation, and [array] bracket notation).

You can use dot.notation to identify fields within embedded documents. You can **also** use dot.notation to identify fields within documents that are embedded within arrays.

For example, in a crunchbase document, `offices` is and array. We can query against it thus:

```
if ('country' in options) {
  query['offices.country_code'] = options.country;
}
```

That (`offices.country_code`) works because Mongo treats documents with arrays of nested documents as if there were multiple separate copies of the document for each nested array, with the array value as a regular (non array element) document field.

#### Dot Notation on Embedded Documents in Arrays



#### Sort, Skip, and Limit in the Node.js Driver


#### insertOne() and insertMany() in the Node.js Driver



#### deleteOne() and deleteMany() in the Node.js Driver
