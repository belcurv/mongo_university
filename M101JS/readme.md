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
