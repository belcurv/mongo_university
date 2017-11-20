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

stopped at 1:54

#### Index Creation, Background


#### Using Explain


#### Explain: Verbosity


#### Covered Queries


#### When is an Index Used?


#### How Large is Your Index?


#### Number of Index Entries


#### Geospatial indexes


#### Geospatial Spherical


#### Text indexes


#### Efficiency of Index Use


#### Efficiency of Index Use Example


#### Logging Slow Queries


#### Profiling


#### Mongotop


#### Mongostat


#### Sharding Overview
