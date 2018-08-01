# Week 7 - Application Engineerinng

Drivers, Impact Of Replication And Sharding On Design and Development.

#### Introduction

Topics:

1.  durability of writes - how do you know data has been persisted on disk
2.  replication - MongoDB's approach to fault tolerance and availability
3.  sharding - distributing a collection across multiple server for higher throughput

#### Write Concern

How do we make sure writes persist? The DB is mostly writing to memory; in WiredTiger, for example, there's a cache of pages that are periodically written and read from disk depending on memory "pressure".

There's a 2nd structure called a "journal", a log of every single write the DB processes. The journal is in memory too. So, when does the journal get written back to disk? Because that's when the data is really considered to be persistent.

When our Mongo driver sends an `insert` or `update` to the server, the server will process the update and write it into the memory pages. It simultaneously writes the update into the journal. By default in the MongoDB driver, when you do an `update` the client/driver waits for a response ("acknowledged update" or "acknowledged insert") but we don't wait for the journal to be written to disk. The journal might not be written to disk for a while.

Whether we're going to wait for this write to be acknowledge by the server is represented by the value **w**. By default, `w = 1` meaning we're going to wait. There's also **j** which represents whether we're going to wait for the journal to be written to disk before continuing. Default `j = false`.

Implications: write operations to MongoDB are done in memory, not to disk. And periodically the journal is written out to disk. It might e every few seconds, for ex. During the time between when an update was written to memory but the journal had not been written to disk, if the server crashed you could lose the data in memory.

Just because an update or insert was acknowledged, doesn't mean that data was successfully persisted to storage. Whether this is a problem depends on the application.

Together, the `w` and `j` values comprise the **write concern**.

Default: `w = 1, j = false` - this is fast, but there's a small window of vulnerability. We can remove that vulnerability by setting `j = true`, which is doe in the driver at the collection level, the database level or the client level. This is much slower.


#### Network Errors

What are the reasons why an application may receive an error back even if the write was successful:

1. The network TCP connection between the application and the server was reset after the server received a write but before a response could be sent.

2. The MongoDB server terminates between receiving the write and responding to it.

3. The network fails between the time of the write and the time the client receives a response to the write.

#### Introduction to Replication

Availability and fault tolerance.

Get help right in the mongo shell:

```
rs.help()
```

Replica set is a group of MongoDB nodes that mirror each other. One primary and multiple secondaries. Minimum number of nodes is 3.

Data that's written to the primary will asynchronously be written to the secondaries. Your application stays connected to the primary - you can only write to the primary.

If the primary goes down, the remaining nodes perform an election to elect a new primary. After a new primary is elected, your app reconnects to the new primary transparently (all in the driver).

When a downed node comes back up, it would re-join the group as a secondary.

#### Replica Set Elections

Different types of nodes in a replica set:

1. regular - has data, can become primary or secondary

2. arbiter - just there for voting purposes. Why use this? To get an even number of Replica set nodes to ensure a "strict majority" to elect a new leader.

3. delayed/regular - often a disaster recovery node. Can be set to be an hour or 2 hours behind other nodes. Can participate in voting, but cannot become primary (`p = 0`).

4. hidden - often used for analytics. Cannot become a primary( `p = 0` ). Can participate in Elections.

#### Write Consistency

Again, in a replica set there's only a single primary and all writes go to that primary. Reads can go to the secondaries if you like. If your allow the writes to go to the primary, you get **strong consistency** of reads with respect to writes: you won't read stale data.

On the other hand, if you allow your reads to go to your secondaries, you may read stale data from the secondaries because of asynchronous update lag between any two nodes.

Driver read preferences can be set to to decided whether you're willing to accept reads from the secondaries.

When failover occurs, there's a brief time (usually under 3 seconds) when there's no primary and you can't complete a write.

Other database systems have a weaker form of consistency: eventual consistency. Eventually you'll be able to read what you wrote, but there's no guarantee that you'll be able to read it in any particular timeframe. This is hard to reason about.

MongoDB does not offer eventual consistency in its default configuration. But enabling reads from secondaries is sort of a form of eventual consistency.

#### Creating a Replica Set

Normally you would install a separate `mongod` on each of a bunch of separate physical servers and using the default port number. For this lecture, he is creating a replica set on a single machine so he needs to set different port numbers for each of the three nodes.

```
mkdir -p /data/rs1 /data/rs2 /data/rs3
mongod --replSet rs1 --logpath "1.log" --dbpath /data/rs1 --port 27017 --fork
mongod --replSet rs1 --logpath "2.log" --dbpath /data/rs2 --port 27018 --fork
mongod --replSet rs1 --logpath "3.log" --dbpath /data/rs3 --port 27019 --fork
```

In the aobve, `rs1` is the name of the replica set. We declare that to make sure each node is part of the same replica set. `--fork` allows shell commands to return, so he doesn't have to run 3 separate shells.

So the above will launch three servers. But they don't yet know about each other - they can't act in concert yet. To tie them together we have to issue a Mongo Shell command. The following script sets up a configuration and, initiates that configuration and reports on its status:

```
// init_replica.js

config = {
    _id: "m101",
    members: [
        { _id : 0, host : "localhost:27017", priority: 0, slaveDelay: 5 },
        { _id : 1, host : "localhost:27018"},
        { _id : 2, host : "localhost:27019"}
    ]
};

rs.initiate(config); // initiates the replica set
rs.status(); // to see what's going on
```

Have to name it the same as the `replSet` we gave to the `mongod` nodes (`rs1`). And in the above, the 1st node has a delay of 5 seconds. And in order to do that, we can't allow it to become a primary node (so, `priority: 0`).

To connect to our replica set, we'll have to use a non-default port number because 27017 is associated with our delayed node, and our delayed node can never become a primary. To actually create it, we :

```
mongo --port 27018 < init_replica.js
```

Then we can connect to it:

```
mongo --port 27018
```

The mongo shell prompt is now different. For example:

```
rs1:PRIMARY>
```

`rs.status()` gives us information about our replica set.

On the primary you can now do all the things you're used to (inserts, finds, etc). But you can't query secondaries by default. You have to enable that **on each secondary** with:

```
rs.slaveOk()
```

#### Replica Set Internals

Consider a three node replica set. Each `mongod` has an **oplog**. And the oplog is going to be kept in sync by mongo. The secondaries are constantly reading the oplog of the other nodes and applying those same operations to themselves. The oplog entries originally come from the primary, but secondaries can sync from another secondary, as long as there is a chain of oplog syncs that leads back to the primary.

A replica set's oplog is a collection (`oplog.rs`) i the `local` database. So we can see what's in it: `db.oplog.rs.find().pretty()`. The documents are a list of commands.

Oplogs:

1.  are capped collections. Meaning they'll "roll off" at a certain point. So you need to have a large enough oplog to deal with times when the secondaries can't see the primary.

2.  update themselves based on checking for new operations. They use `optime` and `optimeDate` to check newness.

3.  becuase oplog uses the statement-based approach using documents, it doesn't matter which storage engine you use or which version of MongoDB you're using. So you can have mixed mode replica sets. This allows you to do rolling upgrades of a system - upgrade parts of it at a time.

#### Failover and Rollback

Consider a situation. Three servers. Writes are going to the primary and they're getting replicated out, but the secondaries are lagging behind for a few seconds and all of a sudden the primary goes down. So a new election will be triggered, but there are writes on the failed primary that the secondaries don't have yet.

And then say the old primary comes back online, becoming a secondary. It queries the new primary and discovers that it has writes that don't exist on the new primary. So it **rolls them back**. It puts them into a file so you can apply them manually if needed, but they won't be part of the dataset.

You can overcome this by waiting until, when writing to the primary initially, you wait until a majority of the nodes have the data ? What the fuck does that mean? You set `w` (write concern) so that a majority of nodes have the data before writing?

While it is true that a replica set will never rollback a write if it was performed with w=majority and that write successfully replicated to a majority of nodes, it is possible that a write performed with w=majority gets rolled back. Here is the scenario: you do write with w=majority and a failover over occurs after the write has committed to the primary but before replication completes. You will likely see an exception at the client. An election occurs and a new primary is elected. When the original primary comes back up, it will rollback the committed write. However, from your application's standpoint, that write never completed, so that's ok.

What happens if a node comes back up as a secondary after a period of being offline and the oplog has "looped" on the primary (looped = so much time has passed that all operations in the oplog are different)?

A: The entire dataset will be copied from the primary.

#### Connecting to a Replica Set from the Node Driver

Give the driver a connection string just like before with the hostnames and ports of the nodes you want to connect to. You can either give each of the hostnames and ports - or - give the drive one hostname and port and the driver will automatically discover that th node is part of a replica set.

To connect to the replica set in Node, we pass a single connection string to the `.connect()` function, where each node in the replica set is separated by a coma.

Again, you can pass only a single node into `.connect()` and it will find the whole replica set. Assuming the one node is actually up.

```
var MongoClient = require('mongodb').MongoClient;

MongoClient.connect("mongodb://localhost:30001,localhost:30002,localhost:30003/course", function(err, db) {
    if (err) throw err;

    db.collection("repl").insert({ 'x' : 1 }, function(err, doc) {
        if (err) throw err;

        db.collection("repl").findOne({ 'x' : 1 }, function(err, doc) {
            if (err) throw err;

            console.log(doc);
            db.close();
        });
    });
});
```

#### Failover in the Node.js Driver

What actually happens when a node goes down. How do we need to respond? How does the driver respond?

In the driver:

1.  writes received from our application and reads that can't yet be sent to a primary are **buffered** by the drier. From the application perspective you see that you're dispatching all these reads and writes, but you don't see them complete. The driver will buffer them until the failover completes and you have a new primary. Then the driver will send all the buffered operations, the reads/writes will complete as they normally would, and the client will get responses.

Example to demo failover: this is similar to a for loop, dispatching insert operations.

```
// app.js
var MongoClient = require('mongodb').MongoClient;

MongoClient.connect("mongodb://localhost:30001,localhost:30002,localhost:30003/course", function(err, db) {
    if (err) throw err;

    var documentNumber = 0;

    // "loop" to insert one document per second
    function insertDocument() {

        db.collection("repl")
          .insert({ 'documentNumber' : documentNumber++ }, function(err, doc) {
            if (err) throw err;
            console.log(doc);
        });

        console.log("Dispatched insert");

        // calls itself again after 1 second
        setTimeout(insertDocument, 1000);
    }

    insertDocument();
});
```

So, with a replica set running, run `node app.js` to execute the above. It will log the result of each round of insert operations.

```
"Dispatched insert"
[ { documentNumber: 1, _id: 0asd908dg098ad098sd098asd908 }]
"Dispatched insert"
[ { documentNumber: 2, _id: 9asd8asd98asd09usdklasdpulka }]
"Dispatched insert"
[ { documentNumber: 3, _id: 90byyqglknksdpvjalknqepojsdl }]
```

If we then log into the primary and shut it down (have to be in the `admin` database):

```
use admin
db.shutdownServer()
```

What we'll see logged to console:

```
"Dispatched insert"
"Dispatched insert"
"Dispatched insert"
"Dispatched insert"
"Dispatched insert"
"Dispatched insert"
```

No errors, but no insert result docs either. But we're still dispatching inserts. And eventually, once the failover completes we see a huge batch of inserts come through before it goes back to normal operation:

```
"Dispatched insert"
"Dispatched insert"
"Dispatched insert"
"Dispatched insert"
[ { documentNumber: 78, _id: 0asd908dg098ad098sd098asd908 }]
[ { documentNumber: 79, _id: 9asd8asd98asd09usdklasdpulka }]
[ { documentNumber: 80, _id: 9asd8asd98asd09usdklasdpulka }]
[ { documentNumber: 81, _id: 0asd908dg098ad098sd098asd908 }]
[ { documentNumber: 82, _id: 9asd8asd98asd09usdklasdpulka }]
[ { documentNumber: 83, _id: 0asd908dg098ad098sd098asd908 }]
[ { documentNumber: 84, _id: 9asd8asd98asd09usdklasdpulka }]
[ { documentNumber: 85, _id: 90byyqglknksdpvjalknqepojsdl }]
"Dispatched insert"
[ { documentNumber: 86, _id: 90byyqglknksdpvjalknqepojsdl }]
```

That's the driver sending out all the buffered operations once the primary election is done.

When an insert happens during a primary election, the insert will be buffered until the election completes, then the callback will be called after the operation is sent and the response is received.

#### Write Concern Revisited

Three values are collectively referred to as "write concern":

`w` parameter - how many nodes you wait for before you move on when you do an insert. In the case of 3 node replica set, setting `w = 1` will just wait for the primary to acknowledge the write. Setting `w = 2` will wait for the primary and one other node to acknowledge the write. `w = 3` waits for all three to acknowledge the write. Setting `w` to a value greater than the available number of nodes will result in an immediate error.

`j` parameter - setting (journal) `j = 1` will wait for the write to be written all the way to disk. **Note** you're only waiting for the write to be written to disk on the primary, not he secondaries. There's no guarantee that data is written to the secondaries here.

How long you wait is called `wtimeout` - how long are you willing to wait for your writes to be acknowledged.

You can set these values in 3 different places:

1.  on a connection

2.  on a collection

3.  in the configuration of a replica set - probably the safest thing to do.

Other ways to use `w`:

1.  `w: 'majority'` - will wait for a majority of nodes to replicate. THis is also needed to avoid "rollbacks" when failover.

2.  setting `w` to a tag value.

If you set `w = 1` and `j = 1`, it **is** possible to wind up rolling back a committed write to the primary on failover. The primary goes down before it propagates to the secondary and the secondary becomes the primary, then when the original primary returns he's going to roll himself back because he's ahead of the secondary.

#### Read Preferences

By default, reads and writes both go the primary. That's a good thing because you're guaranteed to read what you wrote.

Setting read preference option enables reading from secondaries. Several options:

1.  Primary - the default - only read from primary
2.  Primary preferred - read from the primary if it's up. If it's down, read from secondary
3.  Secondary - rotate reads from my secondaries only (not primary)
4.  Secondary preferred - prefer reads from secondaries, send to primary if no secondary available.
5.  Nearest - read from `mongod` that has shorted ping time

If you choose to read from a secondary, you have an "eventually consistent" read instead of a "stringly consistent" read. Meaning, eventually the data will show up on the secondary but it won't necessarily be the data you wrote (WTF does this mean?). Have to be ready to accept data that's potentially "stale".

Reason you would **not** want to configure your app & the driver to read from secondary nodes:

1.  if your write traffic is great enough, and the secondary is less powerful than the primary, you may overwhelm the secondary, which must process all the writes as well as the reads. Replication lag can result

2.  You may not read what you previously wrote to MongoDB on a secondary because it will lag behind by some amount

3.  If the secondary hardware has insufficient memory to keep the read working set in memory, directing reads to it will likely slow it down.

#### Review of Implications of Replication

The idea behind using replica sets is that they're transparent to the application developer and you don't really have to understand that they're there. They just create greater availability and fault tolerance and not get in your way.

But a few things you need to remember:

* Seed lists - drivers need to know about at least 1 member of a replica set for any of this to work

* Write Concern - in a distributed environment, need to understand the idea of write concern. Waiting for some number of nodes to acknowledge writes (`w` param), or waiting for the primary node to acknowledge writes to journal/disk (`j` param), and how long to wait for `w` (`wtimeout` param).

* Read Preferences - have to make a choice that suits your applications needs.

* Errors can still happen - transient failover errors, network errors, violations of unique key constraints or other syntax errors. Def need to check for exceptions when reading and writing to any database.

#### Introduction to Sharding

Sharding is Mongo's approach to horizontal scalability. "Scaling out". Idea: splitting data in a collection across multiple separate databases. Raid 0 for Mongo. Querying a sharded database should be transparent to the application.

Shards are typically themselves replica sets. There might be three physical hosts within a shard. So if you have 5 identical shards where each is a 3-node replica set, you could have 15 total hosts.

How does this work? Mongo includes a router! `mongos` - the binary came with the MongoDB archive we downloaded. The router takes care of the distribution / knowledge of the different shards/hosts and route queries properly.

Once you have a sharding environment you no longer connect directly to your replica sets. You may, for maintenance, etc. But you typically connect to `mongos`

Sharding used to use a range-based approach with a shard key (some key from the documents).  So for an `orders` collection, you could imaging sharding on the order `_id`. The `mongos` router would have some notion of the ranges of order numbers that are assigned to each shard. This is done through a mapping of chunks.

As of MongoDB 2.4, MongoDB also offers hash-based sharding, which offers a more even distribution of data as a function of shard key, at the expense of worse performance for range-based queries. For more information, see the documentation at http://docs.mongodb.org/manual/core/sharding-introduction/

The `orders` collection is broken up into `chunks`, those chunks have `homes`, and those chunks could be potentially migrated by a balancer.

If a query **does** include the shard key, `mongos` will check the map and route the query to the specific shard that has the document(s). If a query **does not** include the shard key, `mongos` has to scatter the request to all the shards.

Additionally, in a sharded environment you have to include the shard key on all inserts - `mongos` needs to know where to put the thing.

Sharding is at a database level, and a collection level. You can choose to shard or not shard a collection within a sharded database. A non-sharded collection in a sharded database will live in the "left-most" shard 0.

#### Building a Sharded Environment

Lots of servers ...

1.  Three shards with a three-node `mongod` replica set each.
2.  One `mongos` router
3.  Three config servers, each also a `mongod` holding info about the way your data is distributed across the shards. Config servers know how chunks are assigned to shards. `mongos` asks the config servers for this info.

So for a production system with two shards, each one a replica set with three nodes, a total of 9 `mongod` processes will be started.

See file: `init_sharded_env__m101p.sh`

When you create a brand new sharded system, and index is automatically created on the shard key.

`sh.status()` = status of a sharded system

#### Implications of Sharding

With sharding, devs don't need to think about collections being horizontally split among different nodes. But there are some things you need to remember when working with sharded systems:

1.  every document needs to contain the shard key now
2.  the shard key is immutable
3.  index that starts with the shard key
4.  when you do an update, have to specify a shard key or specify that multi is true (will send update to all nodes)
5.  no shard key = scatter query operation (could be expensive)
6.  can't have a unique shard key

If you want to shard a zip code collection after importing it, and you want to shard on zip code, you would index on `zip` or a non-multi-key index that starts with `zip`.

#### Sharding + Replication

Sharding and Replication are almost always done together. Each shard is always a replica set because otherwise they wouldn't be reliable.

There's still a concept of write concern (`w`, `j` and `wtimeout`) and they're passed right through from the application. The `mongos` is going to route that write to the apporpriate shard and replica set node, and the write concern will get reflected in the final write.

In a multi update to multiple nodes, with `w = majority, j = 1`, then `mongos` wouldn't get an acknowledgement that the write completed until all the different shards completed the write to a majority of their nodes, and that it was committed to the journal on the primary of each replica set.

Usually `mongos` is replicated itself. Typically you run them on the same box as the application server itself. Just like the driver can take multiple hosts for a replica set, it can take multiple `mongos`s. And if it can't connect to one `mongos` it will try to connect to another one.

Suppose you want to run multiple `mongos` routers for redundancy. The driver assures that you can failover to a different `mongos` from within your application.

#### Choosing a Shard Key

Shard key choice affects performance of a sharded configuration.

1.  Need sufficient cardinality (sufficient variety of values). Bad example: sharding on something where there's only 3 possible values - no way for mongo to spread that across 100 shards.

2.  Want to avoid hot spotting in writes. Hotspotting will occur for anything that's monotonically increasing. BSON `_id`s increase more or less monotonically, because the last part of it is a timestamp. So every `_id` ends up being the largest possilble thing ever stored, and ends up hammering the uppermost / last chunk. So most writes happen in that chunk = hotspotting.

Examples:

1.  sharding an order collection. Billions of orders and `order_id` is monotonically increasing:

    ```
    {
      order_id: '',
      order_date: '',
      vendor: ''
    }
    ```

    Probably don't want to shard on `order_id` or `order_date`. Could potentially shard on `vendor` if it has enough cardinality. You could shard on [vendor, order_date], might work well. Prob has a lot of cardinality.

2.  photo sharing system. Each user has photos and you track info in the users collection: user name, list of albums.

    Could you use `username` as a shard key? Yes, and it probably has a lot of good properties to it. `username: 'Joe'` maps to one shard, `username: 'Bob'` maps to another shard.

Think if the problem is "naturally parallel", and if it naturally parallel against some particular characteristic that might be a good property to shard against.

You have to select a shard key carefully because you can't re-do it! And they're immutable! So think about it hard before you do it. Might make sense to set up a separate machine and do some testing and access pattern analysis before you finally commit to one.

Quiz:

>You are building a facebook competitor called footbook that will be a mobile social network of feet. You have decided that your primary data structure for posts to the wall will look like this:

```
{'username':'toeguy',
     'posttime':ISODate("2012-12-02T23:12:23Z"),
     "randomthought": "I am looking at my feet right now",
     'visible_to':['friends','family', 'walkers']
 }
```

>Thinking about the tradeoffs of shard key selection, select the true statements below.

1. Chooing `posttime` as the shard key will cause hotspotting, because it's monotonically increasing.

2. Choosing `username` as the shard key will distribute posts to the wall across the shards.

3. Choosing `visible_to` as a shard key is illegal because you need an index that is going to be either on the shard key or the start of the shard key and `visible_to` will require a multi-key index which is illegal.

#### HW 7.1

>Which of the following statements are true about replication in MongoDB? Check all that apply.

1.  The minimum sensible number of voting nodes to a replica set is three.

2.  The `oplog` utilizes a called collection.

#### HW 7.2

>Let's suppose you have a five member replica set and want to assure that writes are committed to the journal and are acknowledged by at least 3 nodes before you proceed forward. What would be the appropriate settings for w and j?

A: `w = "majority", j = 1`

#### HW 7.3

>Which of the following statements are true about choosing and using a shard key? Check all that apply.

1.  There must be an index on the collection that starts with the shard key.

2.  MongoDB cannot enforce unique index on a sharded collection other than the shard key itself or indexes prefixed by the shard key.

3.  And single update that does not contain the shard key or `_id` field will result in an error.
