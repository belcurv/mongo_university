# Week 7 - Application Engineerinng

Drivers, Impact Of Replication And Sharding On Design and Development.

#### Introduction

Topics:

1.  durability of writes - how do you know data has been persisted on disk
2.  replication - MongoDB's approach to fault tolerance and availability
3.  sharding - distributing a collection across multiple server for higher throughput

#### Write Concern

How do we make sure writes persist? The DB is mostly writing to memory; in WiredTiger, for example, there's a cache of pages that are periodically written and read from disk depending on memory "pressure".

There's a 2nd structure called a "journal", a log of every single write the DB processes. The journal is in memory too. So, when does the journal get written back to disk? Becuase that's when the data is really considered to be persistent.

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



#### Creating a Replica Set



#### Replica Set Internals



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
