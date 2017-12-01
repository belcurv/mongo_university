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

Consider a 3-node replica set. Each node has an **oplog** that is kept in sync with each other's.

Writes go to primaries and are written to the primary's oplog. Secondaries constantly query the primary's oplog and apply those same operations themselves.


#### Failover and Rollback



#### Connecting to a Replica Set from the Node Driver



#### Write Concern Revisited



#### Read Preferences



#### Review of Implications of Replication



#### Introduction to Sharding



#### Building a Sharded Environment



#### Implications of Sharding



#### Sharding + Replication



#### Choosing a Shard Key
