# Week 5: Indexes and Performance

Using Indexes, Monitoring And Understanding Performance. Performance In Sharded Environments.

#### Storage Engines: Introduction

New in MongoDB 3.0: pluggable storage engines.

Storage engine is the interface between the persistent storage disks and the MongoDB server.

```
MongoDB driver >> MongoDB server >> engine >> HDDs.
```

All the different structures that hold the documents, the indexes and the metadata involving the documents are all written the the storage by the engine. The engine can use memory to optimize the process - it doesn't have work with slow disks. Engine can decide what to put in memory, and what to take out of memory and persist to storage.

MongoDB lets us use the storage engine that we want; they differ in their performance characteristics.

There are two:

1.  MMAPv1 - the default in Mongo 3.0. But WiredTiger is the default as of MongoDB 3.2.

2.  WiredTiger - came into MongoDB through acquisition of WiredTiger company in 2014.

To start MongoDB with a specific storage engine:

```
mongod --storageEngine mmapv1
```

Storage engines do NOT affect communications between mongodb servers in a cluster. And they do not affect the API that the database presents to the programmer.

Quiz: The storage engine directly determines which of the following?

>The data file format - The data files' format is determined by the storage engine, so this choice is correct. Different storage engines can implement different types of compression, and different ways of storing the BSON for mongoDB.

>Format of indexes - True. It may not be obvious when you first think about it, but indexes are controlled by the storage engine. For instance, MongoDB uses Btrees. With MongoDB 3.0, WiredTiger will be using B+ trees, with other formats expected to come in later releases.

#### Storage Engines: MMAPv1

MMAPv1 is built on top of the unix `mmap` system call that maps files into memory. More info:

```
man mmap
```

Mongodb needs store documents somewhere, and it stores them inside files. To do that, it might initially allocate a large file - a 100GB file.

MongoDB then calls `mmap` system call, and maps that 100GB file into 100GB of virtual memory. Since you cannot get 100GB of virtual memory space on a 32 bit system, note that this requires a 64-bit OS. The OS divides that virtual memory into pages according to it's default page size.

And the OS determines where stuff is stored - whether in actual memory pages or in the virtual memory pages. So when you go to read a document, and it hits a page that's in memory: you get it. If it's not in memory, then the OS has to bring it from disk into memory before you can access it.

MMAPv1 offers:

1.  **collection-level locking** - Each collection inside mongodb is it's own file if you look in `data/db`. This means that if you have 2 **write** operations going on at the same time and they are in the same collection, one has to wait for the other to finish. It's a **multi-reader, single-writer lock**. 1 write per collection.

2.  **in-Place updates** - mongodb will try to update a document wherever it exists, as long as there's space for the updates. If there isn't space, the original page is marked as a "hole" and the document is moved somewhere else where there is enough space to fit the update.

3.  **power of 2 sizes** - MMAPv1 automatically allocates power-of-two-sized documents when new documents are inserted. This is handled by the storage engine. When allocating the initial storage space for a document, mongo rounds up to the next binary power of 2. So for a 3 byte document, mongo allocates 4 bytes. 7 byte document, allocate 8 bytes. 19 byte document, allocate 32 bytes. This way, it's more likely that you can _grow_ a document a little via updating, and that, if/when space opens up we can reuse it more easily.

Since the OS determines what is in memory and what is on disk, there's not much we can do about that. But OS are usually pretty good about allocating memory. The DB doesn't get to have an opinion about what's stored where.


#### Storage Engines: WiredTiger

WiredTiger manages the memory used to access the persistent storage file. A disk file is brought in in pages of varying sizes. WiredTiger decides which blocks it's going to keep in memory and which it's going to send back to disk.

Has some different features that make it faster in certain workloads:

1.  **Document Level Concurrency** - lock-free implementation based on an "optimistic" storage model. Assumes no two concurrent writes are to the same document. And if any two _are_, one of those writes is unwound and has to try again. This is not visible to the application.

2.  **Compression** - of both the documents and the indexes. This is possible because WiredTiger manages its own memory and storage. Blocks are kept uncompressed in memory, but before they're written back to disk WiredTiger can compress them. If you think about MongoDB document keys, they're often repeated in every single document. So there's a lot of opportunity for compression.

3.  **No In-Place Updates** - WiredTiger is an "append-only" storage engine. When you update a document, that document is marked "no longer use" and WiredTiger allocates new space somewhere else on disk. Eventually the original space is reclaimed. Append-only allows WiredTiger to operate without locks at the document level.

**NOTE**  Because the two storage engines you different file formats, they cannot open files stored in the other's folder.  By default, MongoDB looks for databases in `/data/db`. If we're going to use a different engine, we have to manually point `mongod` to a specific path:

```
mongod -dbpath new_path -storageEngine wiredTiger
```

You can check which storage engine you're using with

```
db.collection.stats()
```

#### Indexes

Generally documents are not stored in any particular order on disk. So when searching for a document in a collection you have the scan the entire collection. A full collection scan (or table scan in the relational world) is very slow. The author even says that the single biggest performance function - more than CPU speed, RAM, etc. - is whether you can use some sort of index to avoid having to look through the entire collection.

You should put index on the items that you believe you're going to be querying. What is an index: an ordered set of things. Ordered things make for vaster searches.

Mongodb index structure: **Btree**. Google it, lol.

Sometimes we don't just want to query on 1 thing (name). What if we want to query on 2 things (name, hair_color)?

All indexes are ordered. So `name`, then `hair_color`. Could be represented like this:

```
[Andrew|Blonde] [Andrew|Red] ... [Barry|Brown] [Barry|Red] ... [Zoe|Red]
```

Where each [name|hair_color] points to a document. Note that the `name`s are ordered within the overall collection, and the `hair_color`s are ordered _within each `name` subgrouping_. So we can do like "fractal" binary searches: "find all Barrys with Red hair".

But what if we just want to search for all records with red hair? Our (name, hair_color) index doesn't help us - `hair_color` is not in order across the entirety of the index; still have to search through each document in the collection.

Indexes are described using notation `(a, b, c)`. So what searches benefit from such an index?

* `a`       = yes
* `a, b`    = yes
* `a, b, c` = yes
* `c`       = no
* `c, b`    = no
* `a, c`    = _partial yes_ - can use the index for `a` but still have to search through all of them for `c`

Indexing is not free. Any time you change some document that affects the index, you have to update the index in memory and eventually on disk. Maintaining index Btrees takes time. So, if you have a collection w/ indexes and writes affect items in that index, **writes will be slower** than if there were no index. But **reads will be much faster**.

So one strategy when initially populating a large database is to 1) insert all the data before creating any indexes, and then build the indexes.

The write performance penalty is why you don't have an index on every single key in a collection.

#### Creating Indexes

For the lecture's sample student scores dataset (1 million docs), to create an index you use the `createIndex` method and pass in the document key and a ascending (`1`) or descending (`-1`) identifier (remember indexes are ordered):

```
db.students.createIndex({ student_id:1 });
```

That will take a while (many seconds). MongoDB has to scan the entire collection, create new data structures and store them to disk.

Compound indexes are just as easy:

```
db.students.createIndex({ student_id:1, class_id:-1 });
```

#### Discovering (and Deleting) indexes

Indexes are created on collections, so to discover them we use a collection method. In mongodb >= 3.0 with either WiredTiger or MMAPv1:

```
db.students.getIndexes();
```

Get back an array of documents, where each document is an index.

To remove an index:

```
db.students.dropIndex({ student_id:1 });
```

#### Multikey indexes

Multikey indexes are indexes created on arrays. An index _becomes multikey_ when a document gets added that has an array as it's value for one of the keys.

Imagine the following document:

```
{
    name     : 'Andrew',
    tags     : ['photography', 'hiking', 'golf'],
    color    : 'red',
    location : ['NY', 'CA']
}
```

You can create an index on (tags) - MongoDB will create an index point for 'photography hiking, and golf'.

you can also create a compound index on (tags, color). In this case MongoDB will create index points for 'photography|red', 'hiking|red', and 'golf|red'.

Restrictions on the use of Multikey indexes: you can't have 2 items in a compound index where both of them are arrays. For example, (tags, location) is illegal. Error "cannot index parallel arrays".

#### Dot Notation and Multikey

Using dot notation to reach deep into a document and add an index to something that's in a subdocument of the main document. And also, doing this with things that are arrays.

Given a students collection with documents of this shape:

```
{
    "_id" : ObjectId("90as098asd098asd098asd098"),
    "student_id" : 0,
    "scores" : [
        {
            "type" : "exam",
            "score" : 70.108
        },
        {
            "type" : "quiz",
            "score" : 98.807
        },
        {
            "type" : "homework",
            "score" : 38.001
        },
        {
            "type" : "homework",
            "score" : 65.124
        }
    ]
}
```

... say we want to index on _score_:

```
db.students.createIndex({ 'scores.score' : 1 });
```

That took the author 20 minutes to complete because there's 10 million docs and 4 elements in each array.

So what can we do with this? We can search for records where scores are above some specified value:

```
db.students.find({ 'scores.score' : { '$gt' : 99 }});
```

That will return docs where at least 1 score is above 99. But what if we want to find all docs with an _exam_ score above 99? Using `$elemMatch` (matches a document where _at least one_ element in an array field matches):

```
db.students.find({
    'scores' : {
        $elemMatch : {
            type  : 'exam',
            score : { '$gt' : 99 }
        }
    }
});
```

What Mongo does in the above case is

1.  searches using our `scores.score` index first, for records with scores greater than 99
2.  and then runs `elemMatch` on the result from step 1 (a much smaller set of documents then 10 million)

#### Index Creation Option, Unique

Creating unique indexes: keys must be unique within a collection. No two documents can have the same key (aka 'value'). For example, the `_id` field is unique - no two docs can have the same value for `_id`.

Consider the collection:

```
{ "_id" : ObjectId("90as09asd098asd"), "thing" : "apple" }
{ "_id" : ObjectId("09dfg09df09s8df"), "thing" : "pear" }
{ "_id" : ObjectId("78923ksdf89q8dj"), "thing" : "apple" }
```

Note how there are 2 apples? When creating a unique index with:

```
db.collection.createIndex({ field : 1 }, { unique : true });
```

... we'll get a duplicate key error.

#### Index Creation, Sparse

Sparse indexes are indexes that can be used when the indexed key is missing from some of the documents.

```
{ a : 1,  b : 2, c : 5  }
{ a : 10, b : 5, c : 10 }
{ a : 13, b : 17        }
{ a : 7,  b : 23        }
```

No problem to create a unique index on `a` (all keys for `a` are unique). Same with `b` (all keys for `b` are unique). **BUT** we cannot create a unique index on `c` because the 3rd and 4th documents above have a `c` value of `null`, which violates the unique constraint.

One solution is to specify the `sparse` option when creating the index. It tells MongoDB it should not include in the index documents that are missing the key.

Creating the index, just psss the `sparse` option:

```
db.employees.createIndex({ cell_phone : 1 }, { sparse : true });
```

With regular indexes, if we sort on the indexed field sorting is very fast because the sort uses the index:

```
db.employees.find().sort({ employee_id : 1 })
```

But with sparse indexes, `sort`ing based on an indexed key can't use the index:

```
db.employees.find().sort({ cell_phone : 1 })
```

Instead what happens is the database has to do a full collection scan. It's unable to use the index on `cell_phone`s because it's a sparse index. It knows that certain documents are not indexed, and that in sorting it would omit documents. It doesn't want to omit documents.

Sparse indexes also use a lot less storage space.

#### Index Creation, Background

Do you create indexes in the foreground or background? What's the difference?

**Foreground**:

1.  the default
2.  relatively fast
3.  blocks all writers and readers in the database tht the collection exists. So don't do this in production

**Background**

1.  slower
2.  don't block readers and writers
3.  prior to MOngoDB 2.4 you could only create one background index at a time. With MongoDB 2.4 and later, you can create multiple background indexes in parallel even on the same database. Beginning in MongoDB 2.6, creating an index in the background on the primary will cause the indexes to be created in the background on secondaries, as well. The secondaries will begin index creation when the primary completes building its index.

The other way to create an index is to create an index on a different server than the one you're using to serve your queries. So if you have a replica set, you can take one of them out of the set temporarily, and then run the index creation in that server's foreground, and then bring him back into the set. You avoid the index creation performance penalty.

In action:

```
// default - foreground
db.students.createIndex({ 'scores.score' : 1 })
```

```
// background index creation
db.students.createIndex({ 'scores.score' : 1 }, { background: true })
```

In the 2nd case above, we could still serve queries. Although the database server will continue to take requests, background index creation still blocks the mongo shell you are using to create the index. Open a new shell to issue queries.

#### Using Explain

`.explain()`

Use to find out how a query was executed; what indexes were used; and stats about the query. It doesn't actually bring data back to the client. It's really what the database _would do_ in a query.

In MongoDB 3.0 the syntax changed from

```
db.foo.find().explain()
```

to:

```
db.foo.explain().find()
                .udate()
                .remove()
                .aggregate()
                .findAndModify()
                .help()  // shell help on explain()
````

Why? Because certain things don't return a cursor (`.count()` for example). So the former above has less utility.

`.explain()` returns an "explainable" object. From that, you can run and find, etc. You **cannot** run an `.insert()` on it though, so you can't see what the query optimizer would have done for an insert. But really, there's not much to do in that case.

`explain()` can take some params, which will be covered next lecture.

Valid ways to use `.explain()`:

1.  `db.example.find({a : 1, b : 2}).explain()`  // not preferred but still works
2.  `db.example.explain().find({a : 1, b : 2})`  // preferred
3.  `db.example.explain().remove({a : 1, b : 2})`
4.  `var exp = db.example.explain(); exp.find({a : 1, b : 2})`
5.  `curs = db.example.find({a : 1, b : 2}); curs.explain()` // not preferred

#### Explain: Verbosity

Above we looked at `explain()` running in "queryPlanner" mode, the default mode.

Modes of operation:

1.  **queryPlanner** - tells you what a query would do but doesn't tell you what the results of using that index are.

2.  **executionStats** - includes queryPlanner mode. Additionally, tells you the results of using the index in an `executionStats` property on the document.

    ```
    var exp = db.example.explain('executionStats');
    exp.find({a:17, b:55})
    ```

3.  **allPlansExecution** - includes queryPlanner & executionStats modes. This does what the query optimizer does periodically: runs all possible indexes that could be used, in parallel, and then shows you the why it picked a specific plan over the others. This is in an `allPlansExecution` property on the document.

    ```
    var exp = db.example.explain('allPlansExecution');
    exp.find({a:17, b:55})
    ```

Generally, it's good to have an index for every query. But it's also important that for every index on your collection, there should be at least 1 query hitting it. An index on a collection that's never selected is a waste of time. All queries should have at least 1 index that can satisfy it.

#### Covered Queries

Covered query: a query that can be satisfied entirely from an index. Zero docs need to be examined to satisfy the query. This is a lot faster.

Often will need to exclude `_id` because it's implied in a find. For example, say we have an index (i:1, j:1, k:1):

```
var exp = db.numbers.explain('executionStats');
exp.find({i:45, j:23});
```

The `.explain()` output, executionStats part, from the above would show that 100 results were returned, 100 keys were examined and 100 documents were examined. If 100 docs were examined, this is not a covered index. Why? Because we implicitly also asked to see `_id`.

Let's change the query to project out `_id`:

```
exp.find({i:45, j:23}, {_id:0, i:1, j:1, k:1});
```

Now the executionStats will say 100 docs found, total keys examined = 100, total docs examined = 0. And when number of docs returned > 0, and the number of docs examined = zero, and we used an index ... we have a covered query.

You have to project the fields you're trying to match in your index for a covered query to work.  This won't work:

```
exp.find({i:45, j:23}, { _id:0 });
```

In that case, mongodb has to search the whole collection because it doesn't know if there are other fields. There could be a `u` for example. It doesn't know for sure that it could satisfy that query with just an index. You have to project exactly what's in the index (or a subset of the index).

#### When is an Index Used?

How does MongoDB choose an index to satisfy a query. When a query comes in Mongo looks at the query "shape": has to do with what fields are being searchin ed and additional info such as is there a sort.

Based on that, the system identifies a set of candidate indexes. Out of those candidates, Mongo creates a separate query plan and in parallel threads issue each plan and see which one is the fastest. The idea: the 1st plan to return will be selected as the index for all future queries that take that same query shape.

The real value here is that for subsequent queries mongodb knows which index to select. This is achieved through caching the winning query plan for future use.

Over time, our collection changes or the index changes. There are several ways in which a query plan can be evicted. The index could be rebuilt, or the mongod process could be restarted.

MongoDB no longer evict plans from the cache after a threshold number of writes. Instead, it evicts when the "works" of the first portion of the query exceeds the number of "works" used to decide on the winning plan by a factor of 10x.

#### How Large is Your Index?

With mongo it's important that we're able to fit the "working set" into memory. Working set: the portion of our data that clients are frequently accessing. A key component of this are the indexes. For performance reasons it's essential that we can fit the entire working set into memory vs going to disk. This is especially true for indexes.

Measuring the size of an index - call the `.stats()` method onthe collection of interest:

```
db.students.stats()
```

That will return a document including a key `totalIndexSize` as well as the size of each individual index in the `indexSizes` subdocument.

There's a shortcut method as well:

```
db.students.totalIndexSize();
```

MongoDB > 3.0 WiredTiger supports a few different types of compression. Index prefix compression allows us to have smaller indexes.

```
mongod --storageEngine wiredTiger --wiredTigerIndexPrefixCompression true --dbpath blah/blah
```

Prefix compression comes at the cost of CPU.

#### Number of Index Entries

Index Cardinality: how many index points are there for each type of index that MongoDB supports.

1. **regular indexes** - 1 index point for every key that you put into the index. And if there is no key, there will be an index point under the 'null' entry. Essentially, you get about a 1:1 relative to the number of documents.

2. **sparse indexes** - when a document is missing the key being indexed, it's not in the index. It's a 'null' and we don't keep nulls in a sparse index. So we could have index points <= the number of documents.

3. **multikey idexes** - an index on an array value. There may be multiple index points for each document. Say the array has 5 elements. There's going to be an index point for every single one of those keys. We could have index points > number of documents. If a doc has an array of 100 elements and there's an index on that array, and that doc gets updated, all 100 points in the index need to be updated as well.

#### Geospatial indexes

Geospatial indexes allow you to find things based on location. In a 2D world we have the Cartesian plane - X and Y.

To do searches based on location

1. your document needs to have some X Y location stored on it: `'location' : [x, y]`. Note that `location` is just the name of the field - it could be whatever we want.

2. you need to use `createIndex({'location' : '2d'})` to tell the DB that those are locations that need to be indexed, and that the index is type `'2d'`. `'2d'` is a reserved type that tells the DB that this is a 2D geospatial index.

3. you need a query operator to work on this, for ex. the `$near` operator:
    ```
    db.collection.find({
      location : {
        $near : [ x, y ]
      }
    }).limit(20);  // to restrict to the closest 20 results
    ```

The database will return results in order of increasing distance.

Suppose you have a 2D geospatial index defined on the key `location` in the collection `places`. Write a query that will find the closest three places (the closest three documents) to the location 74, 140:

```
db.places.find({ location : { $near : [74, 140] } }).limit(3);
```

#### Geospatial Spherical

3D geospatial. We describe the location of any point in the surface of the globe by latitude and longitude. We can index documents that have latitude and longitude using a special type of index called `2dsphere`

**note** MongoDB tales _longitude, latitude_ - this is the opposite of how google maps does it.

MongoDB uses a small part of the location specification: [GeoJSON](geojson.org). In a mongodb document, it might look like this:

```
{
  '_id'      : '0a8s098a8sd098asd08asd',
  'name'     : 'Apple Store',
  'city'     : 'Palo Alto',
  'location' : {
    'type'        : 'Point',
    'coordinates' : [
      -122.1691291,
      37.4434854
    ]
  },
  'type'    : 'Retail'
}
```

The object value of `location` above is GeoJSON.

To query that, we need an index on the GeoJSON documents:

```
db.places.createIndex({ 'location' : '2dsphere' })
```

To query it ...

```
db.places.find({
  location : {
    $near : {
      $geometry : {
        type : 'Point',
        coordinates : [ -122.166641, 37.4278925 ]
      },
      $maxDistance : 2000 // in meters
    }
  }
}).pretty()
```

So. We need to:

1. have latitude and longitude coordinates on our documents

2. create a `2dsphere` index to use the `$near` operator. Some of the operators don't require having an index, but they all perform better if there is an index on the location.

3. insert the locations and perform the query.

#### Text indexes

Full text search index. Say you had a large piece of text in a document. Like the US Constitution. We can index a whole text in the same way we index arrays. Essentially indexing every word in the text. Then we can query it, essentially using an 'or' operator looking for one of several words.

Say we have documents that look like this:

```
{
  '_id'   : ObjectId('8d9asd098asd0asd98'),
  'words' : 'dog shrub ruby.'
}
```

We could query for it normally like:

```
db.sentences.find({ words : 'dog shrub ruby.'})
```

... and that would work, but it's not very flexible. Omit the period and it fails. Omit a word and it fails. So let's add a text index:

```
db.sentences.createIndex({ 'words' : 'text' });
```

Then to perform a full text search:

```
db.sentences.find({ $text : { $search : 'dog' } });
```

The above returns all documents where "dog" is in `words`. Capitalization makes no difference. Punctuation makes no difference.


#### Efficiency of Index Use

Designing and Using Indexes. Goal: efficient read/write operations. This required forethought and some experimentation.

We're interested in **selectivity** - minimizing the number of records scanned. And other operations: how are sorts handled?

Selectivity is the primary factor that determines how efficiently an index can be used. Ideally, the index enables us to select only those records required to complete the result set, without the need to scan a substantially larger number of index keys (or documents) in order to complete the query. Selectivity determines how many records any subsequent operations must work with. Fewer records means less execution time.

Method `.hint()` - force mongodb to use a specific index, overriding the queryPlanner. With `.hint()` we specify a particular index we want to use, either by specifying its shape or its actual name. Example specifying shape:

```
db.collection
  .find({student_id: {$gt:50000}, class_id: 54})
  .sort({student_id: 1})
  .hint({class_id : 1})
  .explain('executionStats');
```

#### Efficiency of Index Use Example

The previous example is not that efficient. The solution is to design a better index. One way to do that, is to use `class_id` as the prefix becuase it's the most selective part of our query:

```
db.students.createIndex({class_id: 1, student_id: 1});
```

Generally, re: field order in compound indexes, you want to work with fields on which you'll be doing equality queries first. So put point queries before range queries (`$gt`, etc).

#### Logging Slow Queries

To debug performance you'll need to do some profiling. By default, Mongo automatically logs all slow queries (above 100ms) right to the log that mongod writes when you start it up. You'll see the log messages in the console window where you're running mongod.

#### Profiling

Profiler will write documents to `system.profile` for any query that takes longer then some specified time.

There are 3 levels of the profiler: 0, 1, 2

`0` is the default level; means it is **off**

`1` - log my slow queries

`2` - log all my queries. Why do this? During development it's useful to see all query traffic.

Find your current profiler level:

```
db.getProfilingLevel();
```

So use the profiler:

```
mongod --dbpath /usr/local/var --profile 1
```

Then you can read the log:

```
db.system.profile.find().pretty()
```

Or query it:

```
db.system.profile.find({ millis: {$gt:1}}).sort({ts:1}).pretty();
```

>Write the query to look in the system profile collection for all queries that took longer than one second, ordered by timestamp descending.

A. `db.system.profile.find({ millis: {$gt: 1000} }).sort({ts:-1})`

#### Mongotop

Summary so far:

1. Indexes are critical to performance.

2. Use `explain()` method to see what the db is doing for any particular query, in terms of how it's using its indexes.

3. Use `hint()` method to instruct the DB to use a particular index for a query.

4. Use Profiling to to figure out which of our queries are slow to use `explain` and `hint` to possible create new indexes.

`mongoTop` gives us a high-level view of how Mongo is spending its time.

#### Mongostat

Performance tuning command. Simiar to Unix `iostat` command. Samples the DB in 1 sec intervals and gives you a snapshot of what's going on: inserts, queries, updates, deletes.

Will return different data depending on whether you're running MMAPv1 or WiredTiger.

In terminal, run (port number is optional):

```
mongostat
```

This will stream info to console each second.



#### Sharding Overview

A technique for splitting up a large collection among multiple mongo servers. There may come a time when you can't get the performance you want from a single server. So you shard.

When you shard, you deploy multiple mongod servers and in front of them you have a **mongos** - a router.

Your application talks to `mongos`, which then talks to the various servers (the `mongod`s).

Frequently a shard isn't a single server - it will be a replica set: mutiple redundant mongo servers. But logically, each replica set appears as one shard.

The way Mongo shards is you choose a shard key. For ex. `student_id` cound be a shard key. It's a range-based system, so based on the student ID that you query, `mongos` will send the request to the right mongo instance.

This will be covered in more detail in the application development part of this course, but as a dev, need to know:

1. inserts must include the shard key (entire shard key if it's a multipart shard key) in order for the insert to complete.

2. for a find, update or remove, if `mongos` isn't given a shard key it has to broadcast the request to all shards that cover the collection.

3. with updates, if you don't specify the entire shard key you have to make it a multi update so it knows it needs to broadcast it.

#### HW 5.1

>Suppose you have a collection with the following indexes:

```
> db.products.getIndexes()
[
    {
        "v" : 1,
        "key" : {
            "_id" : 1
        },
        "ns" : "store.products",
        "name" : "_id_"
    },
    {
        "v" : 1,
        "key" : {
            "sku" : 1
        },
                "unique" : true,
        "ns" : "store.products",
        "name" : "sku_1"
    },
    {
        "v" : 1,
        "key" : {
            "price" : -1
        },
        "ns" : "store.products",
        "name" : "price_-1"
    },
    {
        "v" : 1,
        "key" : {
            "description" : 1
        },
        "ns" : "store.products",
        "name" : "description_1"
    },
    {
        "v" : 1,
        "key" : {
            "category" : 1,
            "brand" : 1
        },
        "ns" : "store.products",
        "name" : "category_1_brand_1"
    },
    {
        "v" : 1,
        "key" : {
            "reviews.author" : 1
        },
        "ns" : "store.products",
        "name" : "reviews.author_1"
    }
```

>Which of the following queries can utilize at least one index to find all matching documents or to sort? Check all that apply.

Answer:

1. `db.products.find({'brand':'GE'}).sort({price:1})`

2. `db.products.find({ $and : [{price: {$gt:30}}, {price: {$lt:50}}] }).sort({brand:1})`

#### HW 5.2

Suppose you have a collection called tweets whose documents contain information about the `created_at` time of the tweet and the user's `followers_count` at the time they issued the tweet. What can you infer from the following explain output?

```
db.tweets
  .explain("executionStats")
  .find({"user.followers_count":{$gt:1000}})
  .limit(10)
  .skip(5000)
  .sort( { created_at : 1 } );

{
    "queryPlanner" : {
        "plannerVersion" : 1,
        "namespace" : "twitter.tweets",
        "indexFilterSet" : false,
        "parsedQuery" : {
            "user.followers_count" : {
                "$gt" : 1000
            }
        },
        "winningPlan" : {
            "stage" : "LIMIT",
            "limitAmount" : 0,
            "inputStage" : {
                "stage" : "SKIP",
                "skipAmount" : 0,
                "inputStage" : {
                    "stage" : "FETCH",
                    "filter" : {
                        "user.followers_count" : {
                            "$gt" : 1000
                        }
                    },
                    "inputStage" : {
                        "stage" : "IXSCAN",
                        "keyPattern" : {
                            "created_at" : -1
                        },
                        "indexName" : "created_at_-1",
                        "isMultiKey" : false,
                        "direction" : "backward",
                        "indexBounds" : {
                            "created_at" : [
                                "[MinKey, MaxKey]"
                            ]
                        }
                    }
                }
            }
        },
        "rejectedPlans" : [ ]
    },
    "executionStats" : {
        "executionSuccess" : true,
        "nReturned" : 10,
        "executionTimeMillis" : 563,
        "totalKeysExamined" : 251120,
        "totalDocsExamined" : 251120,
        "executionStages" : {
            "stage" : "LIMIT",
            "nReturned" : 10,
            "executionTimeMillisEstimate" : 500,
            "works" : 251121,
            "advanced" : 10,
            "needTime" : 251110,
            "needFetch" : 0,
            "saveState" : 1961,
            "restoreState" : 1961,
            "isEOF" : 1,
            "invalidates" : 0,
            "limitAmount" : 0,
            "inputStage" : {
                "stage" : "SKIP",
                "nReturned" : 10,
                "executionTimeMillisEstimate" : 500,
                "works" : 251120,
                "advanced" : 10,
                "needTime" : 251110,
                "needFetch" : 0,
                "saveState" : 1961,
                "restoreState" : 1961,
                "isEOF" : 0,
                "invalidates" : 0,
                "skipAmount" : 0,
                "inputStage" : {
                    "stage" : "FETCH",
                    "filter" : {
                        "user.followers_count" : {
                            "$gt" : 1000
                        }
                    },
                    "nReturned" : 5010,
                    "executionTimeMillisEstimate" : 490,
                    "works" : 251120,
                    "advanced" : 5010,
                    "needTime" : 246110,
                    "needFetch" : 0,
                    "saveState" : 1961,
                    "restoreState" : 1961,
                    "isEOF" : 0,
                    "invalidates" : 0,
                    "docsExamined" : 251120,
                    "alreadyHasObj" : 0,
                    "inputStage" : {
                        "stage" : "IXSCAN",
                        "nReturned" : 251120,
                        "executionTimeMillisEstimate" : 100,
                        "works" : 251120,
                        "advanced" : 251120,
                        "needTime" : 0,
                        "needFetch" : 0,
                        "saveState" : 1961,
                        "restoreState" : 1961,
                        "isEOF" : 0,
                        "invalidates" : 0,
                        "keyPattern" : {
                            "created_at" : -1
                        },
                        "indexName" : "created_at_-1",
                        "isMultiKey" : false,
                        "direction" : "backward",
                        "indexBounds" : {
                            "created_at" : [
                                "[MinKey, MaxKey]"
                            ]
                        },
                        "keysExamined" : 251120,
                        "dupsTested" : 0,
                        "dupsDropped" : 0,
                        "seenInvalidated" : 0,
                        "matchTested" : 0
                    }
                }
            }
        }
    },
    "serverInfo" : {
        "host" : "generic-name.local",
        "port" : 27017,
        "version" : "3.0.1",
        "gitVersion" : "534b5a3f9d10f00cd27737fbcd951032248b5952"
    },
    "ok" : 1
}
```

Answer:

1. The query uses an index to determine the order in which to return result documents.

2. The query examines 251120 documents.

#### HW 5.3

In this problem you will analyze a profile log taken from a mongoDB instance. To start, import `sysprofile.json` with the following command:

```
mongoimport --drop -d m101 -c profile sysprofile.json
```

Now query the profile data, looking for all queries to the `students` collection in the database `school2`, sorted in order of decreasing `latency`. What is the `latency` of the longest running operation to the collection, in milliseconds?

A: `db.profile.find({ns: 'school2.students'}).sort({millis:-1}).limit(1).pretty()`
