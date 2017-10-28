M101JS

Grading

1. quizes - don't count
2. homework - 50% of final grade
3. final project - 50% of final grade

What is MongoDB

A documnent database.
Uses JSON.
Dev teams can design data models to support common access patterns.

MongoDB data modesl are not predicated on joins. Easier to distrib deploments across shards.

MongoDB natively supports sharding out / scalaing out. Single node to hundreds of nodes.

In contrast, relations systems best option is scaling UP, requiring increasingly expensive hardware.

Enables app devs to design data models that make sense for their applications. That is, those that efficiently support common data access patterns.

MongoDB supports agile practices.

--------------

Core MongoDB server is written in C++

Mongo Shell:

1. similar to Node. Also just a C++ program controlled using V8.
2. Commands input into prompt.
3. Make requests to Mongo DB, see responses in the shell.

Node communicates to MongoDB through the DRIVER.

--------------

How to install Mongo DB.

https://www.mongodb.com/download-center#community

Download. Then unpack wherever. Go to the `/bin` directory. Look at that: all the binaries you need! You can literally execute `./mongod` and get a running server. And `./mongo` in another terminal session will launch the mongo shell.

**BUT FIRST**

`sudo bash`
`mkdir -p /data/db`
`chmod 777 /data`
`chmod 777 /data/db`
// Copy all the extracted files to `/usr/local/bin`:
`cp * /usr/local/bin`
`exit`  // exit the root bash shell

Now, you should be able to run `mongod` and `mongo` from anywhere.

----------------

BSON

Binary JSON.

bsonspec.org

MongoDB drivers send/receive data as BSON, and when data is written to MongoDB it's stored as BSON.

On the application side, MongoDB drivers map BSON to whatever is appropriate.

BSON is lightweight, traversable, and efficient.

JSON value tyes:
1. single number type
2. no dates. encode as string or some other nested object

BSON extends this to include
1. integers
2. doubles dates
3. binary data (images)

Although we will be looking primary at JSON, we'll refer to them as "documents" because a lot of the data we'll look at isn't JSON due to the different value types MongoDB supports and due to some syntactic shortcuts that the mongo shell and other tools use.

-----------

CRUD

Creating a database:

`use video`

Creating a document:

`db.movies.insert({"title":"Raiders of the Lost Arc", "year":1981, "imdb":"tt0082971"});
`

Reading documents:

`db.movies.find()`    // find all
`db.movies.find({})`  // also find all
`db.movies.find({}).pretty()`  // find all, better-looking output
`db.movies.find({"date":1981}).pretty()`  // find only movies from 1981

The return object from find is NOT an array of documents. It's a CURSOR.

Can demo this by assigning a query to a variable.

`var c = db.movies.find()`

And then calling two methods:

`c.hasNext()`  // true if there are more documents
`c.next()`  // returns the next document

---------------------

#### Week 2: CRUD

**Creating Documents**

As we saw before, we can use db.collection.insertOne() to insert a single document.

We can use our own `_id` values:

```
db.moviesScratch.insertOne({ "title": "Rocky", "year": "1976", "_id": "tt0075148"});
```

To create multiple documents, we can `insertMany()` which takes an array of documents.

```
db.moviesScratch.insertMany(
  [
    {
      "title": "Rocky",
      "year": "1976",
      "_id": "tt0075148"
    },
    {
      "title": "Rocky II",
      "year": "1977",
      "_id": "tt0072341"
    },
    {
      "title": "Rocky III",
      "year": "1978",
      "_id": "tt0079874"
    }
  ]
)
```

What if there are errors during `insertMany()`? We can do either *ordered* inserts or *unordered* inserts. By default, `insertMany()` does an ordered insert, meaning as soon as it encounters an error it stops.

If we want our app to keep going after encountering an error, we pass the option `ordered: false`

```
db.moviesScratch.insertMany(
  [
    {
      "title": "Rocky",
      "year": "1976",
      "_id": "tt0075148"
    },
    {
      "title": "Rocky II",
      "year": "1977",
      "_id": "tt0072341"
    },
    {
      "title": "Rocky III",
      "year": "1978",
      "_id": "tt0079874"
    }
  ],
  {
    'ordered': false
  }
)
```

We can also create documents using update commands, we call them **upserts**.

#### About the `_id` field

All collections have a unique primary index on the `_id` field. This enables mongodb to retrieve documents based on the `_id` field very efficiently. By defeult, MongoDB creates `_id` values with value type ObjectId, a 12-byte hex string consisting of:

```
DATE | MAC ADDR | PID | COUNTER
____      ___      __     ___
```

#### Reading Documents

Equality searches involving scalar values, then nested documents and array fields.

Simple query:

```
db.movieDetails.find({ rated: "PG-13"}).pretty()
```

Selectors in the query document for `find` are implicitly "and-ed" together. Meaning BOTH selectors must match.

```
db.movieDetails.find({ rated: "PG-13", year: 2009}).pretty()
```

Matching nested fields/documents. Use 'dot.notation' between quotes:

```
db.movieDetails.find({ 'tomato.meter': 100})
```

Matches for array fields. We can consider:

1.  Exact matches on the entire array. Order matters in the array.

    ```
    db.movieDetails.find({ "writers" : ["Ethan Coen", "Joel Coen"] })
    ```

2.  Based on any single element. The syntax is the same for selectors for scalar values: you don't need to enclose your query in array brackets. Doing so matches the exact, entire array as above. Finding a single value in an array, for example:

    ```
    db.movieDetails.find({ "actors" : "Jeff Bridges" })
    ```

3.  based on a specific element position in an array. For example, find documents where Jeff Bridges is the star (aka, listed in the 1st position in the array). Use 'dot.notation' in quotes:

    ```
    db.movieDetails.find({ "actors.0": "Jeff Bridges" })
    ```

4.  more complex matches using operators. _Discussed in later lessons_

Cursors and Projection.

The `find` method returns a cursor. In mongo shell, if we don't assign the return value from `find` to a variable, the cursor is automatically iterated up to 20 times to print an initial set of query results. Mongodb returns query results in batches. Batch size will not exceed the max BSON doc size, and most queries return 101 documents of just enough docs to exceed 1MB. Subsequent batches will be 4MB.

`cursor.next` will retrieve the next batch of docs.

To see how many docs remain in a batch, you can do:

```
// assign cursor to a variable
var c = db.movieDetails.find();

// create a function to see if there are any more results,
// and if there are, getting them
var doc = function() { return c.hasNext() ? c.next() : null; }

// how many objects are left in batch?
c.objsLeftInBatch()

// then we can iterate through the docs one at a time using the `doc`
// method we just wrote:
doc()
doc()
doc()
```

Projections limit the fields returned in results docs. We can explicitly include & exclude fields. `_id` is always returned by default, so if you don't want to see it you have to explicitly exclude it.

#### Comparison Operators

`$eq` - equal

`$ne` - not equal

`$gt` - greater than

`$gte` - greater than or equal

`$lt` - less than

`$lte` - less than or equal

`$in` - find any one of a number of values. Ex:

    ```
    db.movieDetails.find({ rated: { $in: ["G", "PG", "PG-13"]}})
    ```

`$nin` - not in
