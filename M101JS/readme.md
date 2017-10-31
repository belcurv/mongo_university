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

#### Element Operators

Operators that consider the shape of a document. Operators that detect the presence or absence of a field, or the datatype of a field value.

`$exists` - allows us to match documents for which a given field either exists or doesn't exist.

`$type` -

In our movies collection, many movies predate Rotten Tomatoes. So we might want to test for the existence of review data.

Has tomato reviews:

```
db.movieDetails.find({ "tomato.meter": { $exists: true } })
```

Does not have tomato reviews:

```
db.movieDetails.find({ "tomato.meter": { $exists: false } })
```

A collection might require some cleaning. For example, the `moviesScratch` collection has some documents with an `_id` type of ObjectId, while others have a type of String. Say we want to find all that are type String:

```
// Value of $type may be either a BSON type number or the string alias
// See https://docs.mongodb.org/manual/reference/operator/query/type
db.moviesScratch.find({ _id: { $type: "string" } })
```

#### Logical Operators

`$or` - matches either of two or more values.

`$and` - matches all of two or more values.

```
db.movieDetails.find(
  { $or : [
    { "tomato.meter": { $gt: 99 } },
    { "metacritic": { $gt: 95 } }
  ]}
)
```

Why is there an `$and` operator? Because sometimes you need to specify multiple constraints on the same field:

```
db.movieDetails.find(
  { $and : [
    { "metacritic": { $ne: 100 } },
    { "metacritic" { $exists: true } }
  ]
})
```

#### Regex Operators

```
db.movieDetails.find({
  "awards.text": { $regex: /^Won\s.*/ }
})
```

```
db.movieDetails.find({
  "awards.text": { $regex: /^Won\s.*/ }
},
{
  title: 1, "awards": 1, _id: 0
})
```

#### Array Operators

`$all` - match array fields against an array of elements. For a match, all the elements we're looking for must be included in that array field.

```
db.movieDetails.find({
  genres: {
    $all: ["Comedy", "Crime", "Drama"]
  }
})
```

`$size` - matches docs based on the length of an array. For example, for all documents that were filmed in just 1 country:

```
db.movieDetails.find({
  countries: { $size: 1 }
})
```

`$elemMatch` - selects documents if element in the array field matches all the scpecified `$elemMatch` conditions.

Imagine every doc in our collection has a field called `boxOffice`, an array of countries listing the revenue in millions for each of those countries:

```
boxOffice: [ { "country": "USA", "revenue": 41.3 },
             { "country": "Australia", "revenue": 2.9 },
             { "country": "UK", "revenue": 10.1 },
             { "country": "Germany", "revenue": 4.3 },
             { "country": "France", "revenue": 3.5 } ]
```

`$elemMatch` requires that all criteria be satisfied in a single element of an array field. So, you might think that the following would not return the document:

```
db.movieDetails.find({
  boxOffice: { country: "UK", revenue: { $gt: 15 } }
})
```

But it actually does because there are elements in the `boxOffice` array that satisfy each condition separately. What we want is to match both conditions at the same time. That's where `$elemMatch` comes in. All specified criteria must match an array element:

```
db.movieDetails.find({
  boxOffice: {
    $elemMatch: {
      country: "UK", revenue: { $gt: 15 }
    }
  }
})
```

#### Updating Documents

`updateOne` - updates the first document matching our selector. You MUST apply an update operator in the 2nd argument to `updateOne()`

To update one document:

```
db.movieDetails.updateOne({
  title: "The Martian"
}, {
  $set: {
    poster: "http://ia.media-imdb.com/images/M/MV5BMTc2MTQ3MDA1Nl5BMl5BanBnXkFtZTgwODA3OTI4NjE@._V1_SX300.jpg"
  }
})
```

We get back an acknowledgement:

```
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
```

Let's update the awards:

```
db.movieDetails.updateOne({
  title: "The Martian"
}, {
  $set: {
    "awards": {
      "wins": 8,
      "nominations": 14,
      "text": "Nominated for 3 Golden Globes. Another 8 wins & 14 nominations."
    }
  }
});
```

#### Field Update Operators

`$set` - completely replace a field with a new value

`$unset` - completely removes a field from a document

Updates are used to correct errors and, over time, keep our data current. For movie data, much of what's there is static: directors, authors and the like. Other content such as reviews and ratings will need to be updated as users take action. We could use $set for this purpose, but that's an error prone approach. It's too easy to do the arithmetic incorrectly. Instead, we have a number of operators that support numeric updates of data:
$min, $max, $inc, $mul. Let's look at an example using $inc to update reviews.

Using the `$inc` operator to update increment review counts:

```
db.movieDetails.updateOne({
  title: "The Martian"
}, {
  $inc: {
    "tomato.reviews": 3,
    "tomato.userReviews": 25
  }
})
```

Updating array fields - `$push`

```
var reviewText1 = [
  "The Martian could have been a sad drama film, instead it was a ",
  "hilarious film with a little bit of drama added to it. The Martian is what ",
  "everybody wants from a space adventure. Ridley Scott can still make great ",
  "movies and this is one of his best."
].join()

db.movieDetails.updateOne({
  title: "The Martian"
}, {
  $push: {
    reviews: {
      rating: 4.5,
      date: ISODate("2016-01-12T09:00:00Z"),
      reviewer: "Spencer H.",
      text: reviewText1
    }
  }
})
```

Adding multiple array elements - `$each` (push on each document as an individual element of the reviews array):

```
var reviewText2 = [
  "i believe its ranked high due to its slogan 'Bring him Home' there is nothi",
  "ng in the movie, nothing at all ! Story telling for fiction story !"
].join()

var reviewText3 = [
  "This is a masterpiece. The ending is quite different from the book - the mo",
  "vie provides a resolution whilst a book doesn't."
].join()

var reviewText4 = [
  "There have been better movies made about space, and there are elements of t",
  "he film that are borderline amateur, such as weak dialogue, an uneven tone,",
  " and film cliches."
].join()

var reviewText5 = [
  "This novel-adaptation is humorous, intelligent and captivating in all its v",
  "isual-grandeur. The Martian highlights an impeccable Matt Damon, power-stac",
  "ked ensemble and Ridley Scott's masterful direction, which is back in full ",
  "form."
].join()

var reviewText6 = [
  "A declaration of love for the potato, science and the indestructible will t",
  "o survive. While it clearly is the Matt Damon show (and he is excellent), t",
  "he supporting cast may be among the strongest seen on film in the last 10 y",
  "ears. An engaging, exciting, funny and beautifully filmed adventure thrille",
  "r no one should miss."
].join()

var reviewText7 = [
  "The Martian could have been a sad drama film, instead it was a hilarious fi",
  "lm with a little bit of drama added to it. The Martian is what everybody wa",
  "nts from a space adventure. Ridley Scott can still make great movies and th",
  "is is one of his best."
].join()

db.movieDetails.updateOne({
  title: "The Martian"
}, {
  $push: {
    reviews: {
      $each: [{
        rating: 0.5,
        date: ISODate("2016-01-12T07:00:00Z"),
        reviewer: "Yabo A.",
        text: reviewText2
      }, {
        rating: 5,
        date: ISODate("2016-01-12T09:00:00Z"),
        reviewer: "Kristina Z.",
        text: reviewText3
      }, {
        rating: 2.5,
        date: ISODate("2015-10-26T04:00:00Z"),
        reviewer: "Matthew Samuel",
        text: reviewText4
      }, {
        rating: 4.5,
        date: ISODate("2015-12-13T03:00:00Z"),
        reviewer: "Eugene B",
        text: reviewText5
      }, {
        rating: 4.5,
        date: ISODate("2015-10-22T00:00:00Z"),
        reviewer: "Jens S",
        text: reviewText6
      }, {
        rating: 4.5,
        date: ISODate("2016-01-12T09:00:00Z"),
        reviewer: "Spencer H.",
        text: reviewText7
      }
      ]
    }
  }
})
```

Push on a new element but keep only some number of the existing elements - `$slice` and `$position`. If `$slice` is a positive integer keep the 1st # of elements. If `$slice` is negative, keep just the last # of elements. In the following we keep the first 5 elements. To ensure the value we push on goes on the front of the array, we have to use the `$position` modifier for `$push`.

```
// push a new review but keep only the first 5
db.movieDetails.updateOne({
  title: "The Martian"
}, {
  $push: {
    reviews: {
      $each: [{
        rating: 0.5,
        date: ISODate("2016-01-13T07:00:00Z"),
        reviewer: "Shannon B.",
        text: "Enjoyed watching with my kids!"
      }],
      $position: 0,
      $slice: 5
    }
  }
})
```

`updateMany` - Apply the same update to all documents matching a query. Same principles apply to updating multiple documents as `updateOne`.

Could do this, but it's probably the wrong semantics:

```
db.movieDetails.updateMany({
  rated: null
}, {
  $set: {
    rated: "UNRATED"
  }
})
```

Because "UNRATED" probably means something other than "it hasn't been rated" - it likely means some uncut or director's cut or otherwise non-theatrical release. Better to remove the `rated` field entirely:

```
db.movieDetails.updateMany({
  rated: null
}, {
  $unset: {
    rated: ""
  }
})
```

Unexpectedly, if we now search for  `db.movieDetails.find({rated: null}).count()` we'll get back almost 1600 docs - the same number as if we hand't removed the `rated` field. This is because documents that don't have a field count as `null`. This is one way we can query for documents that don't actually have a specified field.

#### Upserts

Upserts are a third way to create documents in MongoDB. If no document is found during an update query, the document is inserted into the collection.


```
var detail = {
  imdb.id: '...',
  /* ... */
};


db.movieDetails.updateOne({
  "imdb.id": detail.imdb.id
}, {
  $set: detail
}, {
  upsert: true   // <-- upsert option
});
```

#### Replace One

`replaceOne` takes a filter and does a wholesale document replacement.

```
db.movies.replaceOne({
    "imdb": detail.imdb.id
  },
  detail);
```

#### Homework 2.1

>What is the title of a movie from the year 2013 that is rated PG-13 and won no awards? Please query the `video.movieDetails` collection to find the answer.

```
// "A Decade of Decadence, Pt. 2: Legacy of Dreams"

db.movieDetails.find({
  rated:'PG-13', year: 2013, 'awards.wins': 0
},{
  _id:0, title:1, rated:1, awards:1, year:1
}).pretty()
```

#### Homework 2.2

>Using the `video.movieDetails` collection, which of the queries below would produce output documents that resemble the following. Check all that apply.
>
>  { "title" : "P.S. I Love You" }
>  { "title" : "Love Actually" }
>  { "title" : "Shakespeare in Love" }

```
db.movieDetails.find({}, { _id: 0, title: 1 })
```

#### Homework 2.3

>Using the `video.movieDetails` collection, how many movies list "Sweden" second in the the list of countries.

```
// 6

db.movieDetails.find({
  'countries.1': "Sweden"
},{
  _id: 0, title:1, countries: 1
}).count()
```

#### Homework 2.4

>How many documents in our `video.movieDetails` collection list just the following two genres: "Comedy" and "Crime" with "Comedy" listed first.

```
// 20

db.movieDetails.find({
  genres: ['Comedy', 'Crime']
},{
  _id: 0, title:1, genres: 1
}).count()
```

#### Homework 2.5

>As a follow up to the previous question, how many documents in the `video.movieDetails` collection list both "Comedy" and "Crime" as genres regardless of how many other genres are listed?

```
// 56

db.movieDetails.find({
  $and: [
    { genres: 'Comedy' },
    { genres: 'Crime' }
  ]
},{
  _id: 0, title:1, genres: 1
}).count()
```

#### Homework 2.6

>Suppose you wish to update the value of the "plot" field for one document in our "movieDetails" collection to correct a typo. Which of the following update operators and modifiers would you need to use to do this?

A: `$set`

#### Quiz: Challenge Problem: Arrays with Nested Documents

Suppose our movie details documents contain an `awards` field structured as follows:

```
"awards" : {
    "oscars" : [
        {"award": "bestAnimatedFeature", "result": "won"},
        {"award": "bestMusic", "result": "won"},
        {"award": "bestPicture", "result": "nominated"},
        {"award": "bestSoundEditing", "result": "nominated"},
        {"award": "bestScreenplay", "result": "nominated"}
    ],
    "wins" : 56,
    "nominations" : 86,
    "text" : "Won 2 Oscars. Another 56 wins and 86 nominations."
}
```

What query would we use in the Mongo shell to return all movies in the `video.movieDetails` collection that either won or were nominated for a best picture Oscar? You may assume that an award will appear in the oscars array only if the movie won or was nominated. You will probably want to create a little sample data for yourself in order to work this problem.

HINT: For this question we are looking for the simplest query that will work. This problem has a very straightforward solution, but you will need to extrapolate a little from some of the information presented in the "Reading Documents" lesson.

```
db.movieDetails.find({
  'awards.oscars.award' : 'bestPicture'
})
```

#### Quiz: Challenge Problem: Updating Based on Multiple Criteria

Write an update command that will remove the "tomato.consensus" field for all documents matching the following criteria:

    The number of imdb votes is less than 10,000
    The year for the movie is between 2010 and 2013 inclusive
    The tomato.consensus field is null

How many documents required an update to eliminate a "tomato.consensus" field?

```
// just counting them, no updates ... Total docs = 13

db.movieDetails.find({
  'imdb.votes' : { $lt : 10000 },
  year : { $gte: 2010, $lte: 2013 },
  $and: [
    { 'tomato.consensus': { $exists : true } },
    { 'tomato.consensus': null }
  ]
},{
  _id:0, title:1, 'tomato.consensus':1, 'imdb.votes':1, year:1
}).count()
```

The actual update would be:

```
db.movieDetails.find({
  'imdb.votes' : { $lt : 10000 },
  year : { $gte: 2010, $lte: 2013 },
  $and: [
    { 'tomato.consensus': { $exists : true } },
    { 'tomato.consensus': null }
  ]
},{
  $unset: { 'tomato.consensus': '' }
}).count()
```
