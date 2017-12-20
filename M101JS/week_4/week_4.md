# Week 4 - Schema Design

Patterns, Case Studies & Tradeoffs

#### MongoDB Schema Design

The single most important factor in designing your application schema within MongoDB is **matching the data access patterns of your application**.

#### Relational Normalization

In the relational world ... **3rd Normal Form** Ok, in a relational DB table, all non-key fields should be attributes _about the key_. For example:

post_id  |  title        | body | author | author_email
---------|---------------|------|--------|--------------------
1        | 'elvis lives' | '..' | 'jim'  | 'jim@example.com'
2        | 'node rocks'  | '..' | 'bob'  | 'bob@example.com'
3        | 'hello world' | '..' | 'jim'  | 'jim@example.com'

In the above, `post_id` is the key. All the fields describe the key except `author_email`, which describes `author`. This is a broken table - it's non-normalized and violates the 3rd normal form.

Goals of Normalization in the relational world:

1.  free the database of modification anomalies. For example, in the above what it we change jim's email - we might updated it in one row but leave it alone in another - leaving the db inconsistent.

2.  Minimize the redesign when extending the database.

3.  Avoid any bias toward a particular access pattern.

When designing & building schemas in MongoDB, we do not care about the third point above. MongoDB is different in that you're specifically interested in tuning your database to the problem you're trying to solve.

Points 1 & 2 above are important and we need to take care to avoid those issues.

#### Modeling a Blog in Documents

So how would we model the above blog in MongoDB?

We'd first have a `posts` collection, with documents looking like:

```
{
  _id      : '',
  title    : '',
  author   : '',
  content  : '',
  comments : [{ author : '', content: '', date: ''}],
  tags     : ['', ''],
  date:    : ''
}
```

And we'd need an `authors` collection as well.

```
{
  _id      : '',
  name     : '',
  email    : '',
  password : ''  // hashed
}
```

#### Living Without Constraints

One of the good things about relations databases is that they're really good at keeping data consistent within the database. One of the ways it does this is by foreign key constraints. Relational dbs guarantee that, for example, a comment's `post_id` is the same as the posts `_id` that it's related to.

How does Mongo guarantee this? **It doesn't**. It's up to the programmer to makes sure your data is consistent throughout a collection.

How do we live in a world without these constraints? Answer: embedding documents. So, for example, instead of having separate blog post `comments` documents, we just embed comments into the `post` documents. Then we never need to worry if some comment document's `post_id` is wrong - there are no `post_id`s anymore, since comments live inside posts now. Same thing with `tags`.

You should "pre-join" (embed) data if/when it makes sense in your application.

What does Living Without Constraints refer to?  Keeping your data consistent even though MongoDB lacks foreign key constraints.

#### Living Without Transactions

MongoDB lacks transaction support. Transactions offer ACID (Atomicity, Consistency, Isolation, Durability).

Although we don't have transactions in MongoDB we do have atomic operations: when you work on a single document, that work will be completed before anyone else can see the document. Other people will either see all of your changes or none of them.

Atomic operations can often accomplish many of the same things as transactions in a relational database. In a relational db, to update something might require changes to several tables. So you open a transaction, make all your changes, and close the transaction. In MongoDB, since we've embedded documents (there aren't multiple tables) we can achieve roughly the same thing by updating an entire blog post at once.

Three approaches for overcoming lack of transactions in MongoDB:

1. you can restructure your code so that you're working within a single document

2. implement whatever you're looking for in software.

3. many systems can tolerate a little bit of inconsistency temporarily.

Examples of operations that operate atomically within a single document:

1. `update`

2. `findAndModify`

3. `$addToSet` (within an update)

4. `$push` within an update

#### One to One Relations

Definition: relations where each item corresponds to one and only one other item. An employee has one resume & a resume has one employee. A building has a floorplan, and a floorplan has one building. A patient has a medical history, and a medical history has one patient.

You could keep the two collections separate. Or you could embed one doc within another. But which should you pick?

Some considerations:

1. frequency of access. Using the employee-resume example, you might access employee records all the time, but very infrequently access resumes, and you don't want to pull the resume into memory for each query. Might not want to embed in this case.

2. are any of a collection's docs growing all the time? If one grows a lot you might not want to embed because you don't want to pull the other doc into memory each time you add to the growing doc. Keeping them separate reduces the working set sie of your application.

3. atomicity of data - if your app absolutely cannot stand inconsistency - say you need to update the employee & resume docs at the same time all the time - you should probably embed one in the other to guarantee they remain consistent through updates.

#### One to Many Relations

Example: city : person. One city, many persons. How would you model this? Maybe a `city` collection:

```
{ name : '',
  area : '',
  people : [
    {
      name : ''
    }
  ]
}
```

But that won't work - there could be way too many people to fit inside a single document.

What about a `people` collection with nested `city`

```
{
  name: ''
  city: {
    name: '',
    area: ''
  }
}
```

The problem with this design is that we're duplicating city info across all people who live in that city. Opens us up to inconsistencies.

So best way to do **one to many** is probably 'true linking' with two collections. So we'd have a `people` collection with people attributes:

```
{
  _id  : ''
  name : 'Andrew',
  city : 'NYC'  // identical to city `name`
}
```

And a `city` collection with city attributes:

```
{
  _id  : '',
  name : 'NYC'  // identical to people `city`
}
```

Since MongoDB has no foreign key constraints, we have to be careful to remain consistent between a person's `city` and the city's `name` field.

What about **one to few**? For example, blog posts and comments. There are multiple comments per blog post, but not very many of them. So in this case, it's feasible to have a single post collection with nested array of comment documents.

#### Many to Many Relations

Examples:

1. books : authors. Each book could have more than one author, and each athor could have more than one book.

2. students : teachers. A student has multiple teachers, and a teacher has multiple students.

Although these are many to many relations, in many real-world cases these tend to be "few to few". That allows us to use MongoDB rich document structure whereas true many-to-many would not.

Using the authors:books example ... two collections: `books` and `authors`. `authors` contains a nested array of book `_id`s and `books` could have a nested array of author `_id`s:

```
// authors
{
  _id : '27',
  author_name : 'Margaret Mitchell',
  books : [12, 7, 8, 24, 64]
}
```

```
// books
{
  _id : 12
  title: 'Gone With the Wind',
  authors: [27]
}
```

Whether it makes sense to maintain arrays of the other collection's `_id`s will depend on your application's access patterns.

Having the linked in both directions creates the opportunity for data to become inconsistent. Another option is to just embed books into authors:

```
// authors
{
  _id : '27',
  author_name : 'Margaret Mitchell',
  books : [{
    _id : 12
    title: 'Gone With the Wind'
  }]
}
```

But this also opens us up to modification anomalies and data inconsistencies. But if your application depends on embedded books for performance reasons, OK to do it.

The lecture author would make `books` and `authors` separate first class objects.

Next, the students:teachers example. Lecture author would handle this the same as above: two separate collections, with arrays of the other collection's object ids.

```
// students
{
  _id : '27',
  name : 'Margaret Mitchell',
  teachers : [12, 7, 8, 24, 64]
}
```

```
// teachers
{
  _id : 12
  name: 'Mistress Montessori',
  students: [27, 43, 45, 65]
}
```

#### Multikeys

Linking and embedding work efficiently in MongoDB because of **Multikey Indexes**.

Consider the students:teachers relationship from above, using 2 collections:

```
// students
{
  _id      : 0,
  name     : 'Andrew',
  teachers : [1, 7, 10, 23]
}

// teachers
{
  _id  : 10,
  name : 'Tony Stark'
}
```

Two obvious queries:

1. how can I find all the teachers a particular student has had?

   This one is easier. `db.students.find({  })`, specify the student I'm looking for and return the `teachers` key with all its values.

2. how can I find all the students who have had a particular teacher?

   This one is trickier and uses _set operators_ and **to be efficient, will use a multi-key index**.

   If we want to add a multikey index on the `teachers` key in the students collection, we can do that as follows:

   ```
   db.students.ensureIndex({ 'teachers' : 1})
   ```

   Now the collection has 2 indexes: `_id` and `teachers`. Indexes make queries against their keys more efficient. A query for all students who have had teachers with `_id`s `0` and `1` would look like this:

   ```
   db.students.find({ 'teackers' : { $all : [0, 1] } })
   ```

   How can we know that the above query used our new index? WIth the `.explain()` query method:

   ```
   db.students.find({ 'teackers' : { $all : [0, 1] } }).explain()
   ```

   That will give us a bunch of information, including info about the cursor and `"isMultiKey" : true`.

#### Benefits of Embedding

The main benefit of embedding data from two different collections into one collection is performance:

1.  Improved read performance (main benefit). Spinning HDDs take a long time to get to the first byte of data (high latency) but then it's fast to get to subsequent bytes (high bandwidth). Embedding "colocates" data from separate docs in a single document.
2.  One round-trip to the database. Reads and writes benefit.

Lecture author again stresses that it all comes down to your access patterns.

#### Trees

Classic problem in schema design: how do you represent a tree in the database? For example, what if we want a list of all the parents of some category, for displaying bread crumbs in a UI? Consider the following two collections: `products` and `categories`

```
// products
{
  _id      : '',
  name     : 'Leaf Blower',
  category : 7
}

// categories
{
  _id    : 7,
  name   : 'outdoors',
  parent : 6         // parent category?
}
```

In the above, we're keeping the category's parent category `_id` (might be 'outdoors' for example). But that doesn't make it easy to get **all** the parents of the parents - we'd have to iteratively find each parent of the parent of the parent, etc.

Alternatively, we could maintain a list of ancestors or children (in an array). If we want the entire subtree that's above a certain tree, we would want a list (array) of the ancestors.

```
// categories
{
 _id       : 7,
 name      : 'outdoors',
 ancestors : [3, 7, 5, 8, 9]
}
```

Expressing rich data is one of the things MongoDB excels at. And is very difficult to do in a relational database. In terms of _how_ you structure it, it all depends on how you believe you'll need to access and display the data for your users.

Given the following document in a `categories` collection:

```
{
 _id: 34,
 name: "Snorkeling",
 parent_id: 12,
 ancestors: [12, 35, 90]
}
```

What query would find all _descendants_ of the above snorkeling category?

```
// find all categories who have _id 34 as an ancestor
db.categories.find({ ancestors: 34 })
```

#### When to Denormalize

Remember: 1 reason we normalize data in the relational db world is to avoid modification anomalies due to duplicate data.

MongoDB's rich documents might make us assume that we're "denormalizing" data. Which is true to a certain extend.  But as long as we don't duplicate data, we don't open ourselves up to modification anomalies.

So looking back at our relationships:

1.  **one to one**: OK to embed. No risk of modification anomalies when we combine two "tables" into one.

2.  **one to many**: embedding can also work well as long as you're embedding from the many to the one. But if you want to go from the one to the many, then **linking** will avoid duplication of data.

3.  **many to many**: linking avoids modification anomalies.

#### Homework 4.1

>Review the data model for the Crunchbase companies data set (see Facebook document from this collection in `hw4-1` folder). Documents in this collection contain several array fields including one for "milestones".

>Suppose we are building a web site that will display companies data in several different views. Based on the lessons in this module and ignoring other concerns, which of the following conditions favor embedding milestones (as they are in the facebook.json example) over maintaining milestones in a separate collection. Check all that apply.

A: The number of milestones for a company rarely exceeds 10 per year, and one frequently displayed view of our data displays company details such as 'name', 'founded_year', 'twitter_username', as well as milestones.

#### Homework 4.2

>Suppose you are working with a set of categories defined using the following tree structure. "Science" is a sub-category of "Books"; "Chemistry" and "Physics" are sub-categories of "Science"; and "Classical Mechanics" and "Quantum Mechanics" are sub categories of "Physics".

```
Books
    Science
        Chemistry
        Physics
            Classical Mechanics
            Quantum Mechanics
```

>For this tree, each node is represented by a document in a collection called categories.

>Which of the following schemas will make it possible to find() all descendant documents of a category using a single query. For example, all descendants of "Science" are "Chemistry", "Physics", "Classical Mechanics", and "Quantum Mechanics".

A:

```
db.categories.insertOne({"_id": "Quantum Mechanics", "ancestors": ["Books", "Science", "Physics"], "parent": "Physics"})
db.categories.insertOne({"_id": "Classical Mechanics", "ancestors": ["Books", "Science", "Physics"], "parent": "Physics"})
db.categories.insertOne({"_id": "Physics", "ancestors": ["Books", "Science"], "parent": "Science"})
db.categories.insertOne({"_id": "Chemistry", "ancestors": ["Books", "Science"], "parent": "Science"})
db.categories.insertOne({"_id": "Science", "ancestors": ["Books"], "parent": "Books"})
db.categories.insertOne({"_id": "Books", "ancestors": [], "parent": null})
```

#### Homework 4.3
