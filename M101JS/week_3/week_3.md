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

#### Dot Notation on Embedded Documents in Arrays

Documents embedded as elements in an array field. For example, `offices` in the `crunchbase` dataset is an array.

You can use dot.notation to identify fields within embedded documents. You can **also** use dot.notation to identify fields within documents that are embedded within arrays.

For example, in a crunchbase document, `offices` is and array. We can query against it thus:

```
if ('country' in options) {
  query['offices.country_code'] = options.country;
}
```

That (`offices.country_code`) works because Mongo treats documents with arrays of nested documents as if there were multiple separate copies of the document for each nested array, with the array value as a regular (non array element) document field.

#### Sort, Skip, and Limit in the Node.js Driver

When retieving docs, we often want to be able to page through results. Not 'batching', but like a number of pages of results. Databases in general are designed to support that kind of paging mechanism.  Page 2 of the results might mean a 2nd query where we `skip` the first say 10 results.

Because the concepts of `skip`ing `limit`ing and `sort`ing are most important when building mongodb applications, we'll discuss them in conjunction with the NodeJS driver.

**sort** - refer to `app-sort.js`

To sort, specify the field name and either 1 (ascending order) or -1 (descending order).

```
cursor.sort({ founded_year: -1 });
```

Again, not until we run the `forEach` method does the query actually execute. Rather, we create the `find` and chain `project` and now `sort` on to the query. The `forEach` fires the fully prepared query off to the db server.

How about _sorted by year, then sorted by number of empoyees_? We pass an array to `sort` because the order is important and **arrays preserve order** (objects do not guarantee order).

```
cursor.sort([
  ['founded_year', 1],
  ['number_of_employees', -1]
]);
```

`skip` and `limit` are also `cursor` methods, and as with `sort` the merely modify the description of the operation we want to execute against the database. Again, the query is not executed until the `forEach` fires.

We almost NEVER want to apply `skip` before `sort` !!  But, by design MongoDB will **always** sort first, skip second, and limit last. Regardless of how foolishly we arrange the methods.

#### insertOne() and insertMany() in the Node.js Driver

Writing data to MongoDB using the NodeJS driver.

Lecture Notes:

[Twitter Developer Documentation](https://dev.twitter.com/overview/documentation)

[Documentation on the Twitter streaming API](https://dev.twitter.com/streaming/overview)

[Documentation on the Twitter REST API](https://dev.twitter.com/rest/public)

To use any of the Twitter APIs you will need access tokens. The simplest means of [acquiring access tokens is described here](https://dev.twitter.com/oauth/overview/application-owner-access-tokens)

The Twitter API client library for Node.js that I used in the lessons is found [here](https://www.npmjs.com/package/twitter)

Note that you can place your access tokens in a separate file (.env) and use the following package to load them.

https://www.npmjs.com/package/dotenv

The `package.json` file for this lesson contains the dependencies for the `twitter` and `dotenv` packages. See the applications in the handouts for examples of how to use. The documentation for the `twitter` and `nodenv` packages provides details on setting up your tokens as environment variables, loading them, and using them to access the twitter API.

Inserting a document with `insertOne`. It takes a document( MongoDB will readily accept JSON) and a callback. 

```
db.collection('statuses').insertOne(document, function(err, res) {
  // etc
});
```

`insertMany` takes an array. It is otherwise the same: takes array od documents as 1st paramter and a callback as the 2nd.

```
db.collection('statuses').insertMany(docsArray, function(err, res) {
  // etc
});
```

#### deleteOne() and deleteMany() in the Node.js Driver

`deleteOne` takes a query document and will delete the first record it finds. In the course example, we loop over an array and call `deleteOne` for each set of duplicate documents. This is pretty inefficient since each `deleteOne` call needs a full round-trip to the database.

When you have a large task, really want to use `deleteMany`.

#### Homework 3.1

>When using find() in the Node.js driver, which of the following best describes **when** the driver will send a query to MongoDB?

A: When we call a `cursor` method passing a callback as an argument.

#### Homework 3.2

Suppose you have a MongoDB collection called `school.grades` that is composed solely of these 20 documents:

```
{"_id": 17, "student": "David",     "grade": 5,  "assignment": "exam"}
{"_id": 18, "student": "Steve",     "grade": 9,  "assignment": "homework"}
{"_id": 4,  "student": "Wendy",     "grade": 12, "assignment": "homework"}
{"_id": 3,  "student": "Fiona",     "grade": 16, "assignment": "quiz"}
{"_id": 16, "student": "Sacha",     "grade": 23, "assignment": "quiz"}
{"_id": 15, "student": "Kim",       "grade": 28, "assignment": "quiz"}
{"_id": 14, "student": "Seamus",    "grade": 33, "assignment": "exam"}
{"_id": 13, "student": "Bob",       "grade": 37, "assignment": "exam"}
{"_id": 1,  "student": "Mary",      "grade": 45, "assignment": "homework"}
{"_id": 2,  "student": "Alice",     "grade": 48, "assignment": "homework"}
{"_id": 11, "student": "Ted",       "grade": 52, "assignment": "exam"}
{"_id": 12, "student": "Bill",      "grade": 59, "assignment": "exam"}
{"_id": 9,  "student": "Sam",       "grade": 61, "assignment": "homework"}
{"_id": 10, "student": "Tom",       "grade": 67, "assignment": "exam"}
{"_id": 8,  "student": "Stacy",     "grade": 73, "assignment": "quiz"}
{"_id": 7,  "student": "Katherine", "grade": 77, "assignment": "quiz"}
{"_id": 5,  "student": "Samantha",  "grade": 82, "assignment": "homework"}
{"_id": 6,  "student": "Fay",       "grade": 89, "assignment": "quiz"}
{"_id": 19, "student": "Burt",      "grade": 90, "assignment": "quiz"}
{"_id": 20, "student": "Stan",      "grade": 92, "assignment": "exam"}
```

Assuming the variable `db` holds a connection to the `school` database in the following code snippet.

var cursor = db.collection("grades").find({});
cursor.skip(6);
cursor.limit(2);
cursor.sort({"grade": 1});

Which student's documents will be returned as part of a subsequent call to toArray()?

#### Homework 3.3

Download Handouts:

    buildingQueryDocuments_569ef31dd8ca393add3abeba.zip

This application depends on the `companies.json` dataset distributed as a handout with the `findAndCursorsInNodeJSDriver` lesson. You must first import that collection. Please ensure you are working with an unmodified version of the collection before beginning this exercise.

To import a fresh version of the `companies.json` data, please type the following:

```
mongoimport --drop -d crunchbase -c companies companies.json
```

If you have already mongoimported this data you will first need to drop the `crunchbase` database in the Mongo shell. Do that by typing the following two commands, one at a time, in the Mongo shell:

```
use crunchbase
db.dropDatabase()
```

The code in the attached handout is complete with the exception of the `queryDocument()` function. As in the lessons, the `queryDocument()` function builds an object that will be passed to `find()` to match a set of documents from the `crunchbase.companies` collection.

For this assignment, please complete the `queryDocument()` function as described in the TODO comments you will find in that function.

Once complete, run this application by typing:

```
node buildingQueryDocuments.js
```

When you are convinced you have completed the application correctly, please enter the average number of employees per company reported in the output. Enter only the number reported. It should be three numeric digits.

As a check that you have completed the exercise correctly, the total number of unique companies reported by the application should equal 42.

A: see code in /homework folder...

#### Homework 3.4

The code attached is complete with the exception of the `queryDocument()` function. As in the lessons, the `queryDocument()` function builds an object that will be passed to `find()` to match a set of documents from the `crunchbase.companies` collection.

For this assignment, please complete the `queryDocument()` function as described in the TODO comments you will find in that function.

Once complete, run this application by typing:

```
node overviewOrTags.js
```

When you are convinced you have completed the application correctly, please enter the average number of employees per company reported in the output. Enter only the number reported. It should be two numeric digits.

As a check that you have completed the exercise correctly, the total number of unique companies reported by the application should equal 194.
