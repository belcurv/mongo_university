# Week 6

The aggregation pipeline; pipeline stages; expressions; accumulators, and best practices

#### Introduction to the Aggregation Framework

Aggregation Framework is a set of analytics tools that allow you to run various types of reports and analysis on documents in one or more MongoDB collections.

Based on the concept of a **pipeline**. Basic idea: we take _input_ from a MongoDB collection and pass it through one or more _stages_, each of which performs a different operation. Each stage receives the output from the preceding stage. The inputs and outputs for all stages are _a stream of documents_.

Each stage of an aggregation pipeline is a data processing unit. A stage takes a stream of input documents and processes then one at a time, and then streams the back out, one at a time. A stage is a generic tool but provides a set of "tunables" to parameterize the stage to perform specific tasks need based on the outputs we want. The "tunables" typically take the form of operators.

It's frequently the case that we'll want to use the same type of stage multiple times within a single pipeline.


#### Familiar Aggregation Operations

Start with the `.aggregate()` method which takes an array (the pipeline) of documents. Each document is a _stage_ and must stipulate a stage operator.

Examples building aggregation pipelines.

**$match** is similar to `.find()` query syntax:

```
db.companies.aggregate([
    { $match: { founded_year: 2004 } },
]);
```

The above works basically just like a `find()` query. And we can chain `.pretty()`.

**$project** is just like projection. Applying `$project` operator to the above to limit fields in the output:

```
db.companies.aggregate([
    { $match: { founded_year: 2004 } },
    { $project: {
        _id: 0,
        name: 1,
        founded_year: 1
    } }
]);
```

**$limit** does what you expect.

```
db.companies.aggregate([
    { $match: { founded_year: 2004 } },
    { $limit: 5 },
    { $project: {
        _id: 0,
        name: 1 } }
]);
```

Why did we `$limit` before `$project`? So that we don't run 1000's of documents through projection stage.

**$sort** works just like `sort` in queries. Note that the order of each stage matters. Sorting before limiting vs limiting before sorting.

```
db.companies.aggregate([
    { $match: { founded_year: 2004 } },
    { $sort: { name: 1} },
    { $limit: 5 },
    { $project: {
        _id: 0,
        name: 1 } }
]);
```

Take care with the order in which you specify sort skip and limit:

```
db.companies.aggregate([
    { $match: { founded_year: 2004 } },
    { $limit: 5 },
    { $sort: { name: 1} },
    { $project: {
        _id: 0,
        name: 1 } }
]);
```

**$skip** works just like it does in queries. Again, pay attention to the order we write stages.

```
db.companies.aggregate([
    { $match: { founded_year: 2004 } },
    { $sort: { name: 1} },
    { $skip: 10 },
    { $limit: 5 },
    { $project: {
        _id: 0,
        name: 1 } },
]);
```

#### Expressions Overview

Different types of expressions.

See MongoDB quick reference for all of them:

https://docs.mongodb.com/manual/meta/aggregation-quick-reference/

1. Boolean expressions - `$and`, `$or`, `$not`

2. Set expressions - allow up to work with arrays

3. Comparison expressions - `$gt`, `$gte`, `$lt`, `$ne`, etc.

4. Arithmetic expressions - `$abs`, `$add`, `$ceil`, `$divide`, etc.

5. String expressions - `$toLower`, `$concat`, `$substr`

6. Text search expressions

7. Array expressions - `$filter`, `$slice`, `$size`, `$concatArrays`

8. Literals

9. Date expressions - `$dayOfYear`, `$dayOfMonth`, `$dayOfWeek`

10. Conditional expressions - `$cond`, `$ifNull`

#### Reshaping Documents in `$project` stages

Have lots of power in `$project` stage. Just about the only thing you can't do is change a field's datatype.

**Common reshaping operations**

Promoting nested fields: taking nested values and setting them as top-level properties of a returned document. The `companies` collection has documents with deeply nested documents. For example, `permalink` is way down in `funding_rounds.investments.financial_org.permalink`. We can return a document with that field "promoted" to a top-level field thusly:

```
db.companies.aggregate([
    { $match: {"funding_rounds.investments.financial_org.permalink": "greylock" } },
    { $project: {
        _id: 0,
        name: 1,
        ipo: "$ipo.pub_year",
        valuation: "$ipo.valuation_amount",
        funders: "$funding_rounds.investments.financial_org.permalink"
    } }
])
```

In the above, note how the `$project` stage doesn't need to simply take `1` or `0`? It can also be used to sort of create new fields that get the value of the specified projection doc property value.

Also note the leading `$`'s above (ex. `ipo: "$ipo.pub_year"`) - that means get the _value_ of the `$ipo.pub_year` field and assign it as the `ipo` key in all output documents.

We can also create a new nested documents (`founded`) by aggregating together a bunch of related, separate, top-level fields from the original documents. This is essentially the opposite of what we did above.

```
db.companies.aggregate([
    { $match: {"funding_rounds.investments.financial_org.permalink": "greylock" } },
    { $project: {
        _id: 0,
        name: 1,
        founded: {
            year: "$founded_year",
            month: "$founded_month",
            day: "$founded_day"
        }
    } }
]).pretty()
```

Another example:

```
db.companies.aggregate([
    { $match: {"funding_rounds.investments.financial_org.permalink": "greylock" } },
    { $project: {
        _id: 0,
        name: 1,
        people: "$relationships.person.last_name"
    } }
]).pretty()
```   

#### `$unwind`

When working with array fields, `$unwind` allows us to take documents as input that have an array valued field, and produce output documents such that there's one output document for each element in the array.

`$unwind` produces an exact copy of the input document, with one exception: the array field that is getting unwound.

Example. Given this input document:

```
{
  key1 : "value1",
  key2 : "value2",
  key3 : [ "elem1", "emel2", "elem3" ]
}
```

`$unwind` would produce three output documents:

```
{
  key1 : "value1",
  key2 : "value2",
  key3 : "elem1"
}

{
  key1 : "value1",
  key2 : "value2",
  key3 : "emel2"
}

{
  key1 : "value1",
  key2 : "value2",
  key3 : "elem3"
}
```

The following query produces documents with large array fields for both the `amount` and `year` fields:

```
db.companies.aggregate([
    { $match: {"funding_rounds.investments.financial_org.permalink": "greylock" } },
    { $project: {
        _id: 0,
        name: 1,
        amount: "$funding_rounds.raised_amount",
        year: "$funding_rounds.funded_year"
    } }
]);
```

To fix this, we can add an `$unwind` stage before the `$project` stage, parameterizing the `funding_rounds` field. Note that we have to prefix `funding_rounds` with a `$`:

```
// unwind
db.companies.aggregate([
    { $match: {"funding_rounds.investments.financial_org.permalink": "greylock" } },
    { $unwind: "$funding_rounds" },
    { $project: {
        _id: 0,
        name: 1,
        amount: "$funding_rounds.raised_amount",
        year: "$funding_rounds.funded_year"
    } }
]);
```

OK, in the above ... every company that `$match`-ed the initial stage gets passed to the `$unwind` stage. There, we take each input document and create a number of output documents equal to the number of elements in the `funding_rounds` array. So each company document becomes multiple company documents, each with a unique funding round key. Each of those documents is then passed the the `$project` stage. So a company that has 4 funding rounds will result in `#unwind` creating four documents.

Note that this affects how `$project` works. Originally, `funding_rounds` was an array of documents. After `$unwind` the `$project` stage no longer receives the original array. Now, `funding_rounds` is a document (one of the documents from the original array).

Let's add a `funder` field to the output documents to illustrate a problem with the aggregation query as written.

```
// Add funder to output documents.
db.companies.aggregate([
    { $match: {"funding_rounds.investments.financial_org.permalink": "greylock" } },
    { $unwind: "$funding_rounds" },
    { $project: {
        _id: 0,
        name: 1,
        funder: "$funding_rounds.investments.financial_org.permalink",
        amount: "$funding_rounds.raised_amount",
        year: "$funding_rounds.funded_year"
    } }
]);
```

What happens above is that, since `funding_rounds.investments` is itself an array, we get back documents with array fields for funder. Like this:

```
{
	"name" : "Farecast",
	"funder" : [
		"madrona-venture-group",
		"wrf-capital"
	],
	"amount" : 1500000,
	"year" : 2004
}
{
	"name" : "Farecast",
	"funder" : [
		"greylock",
		"madrona-venture-group",
		"wrf-capital"
	],
	"amount" : 7000000,
	"year" : 2005
}
{
	"name" : "Farecast",
	"funder" : [
		"greylock",
		"madrona-venture-group",
		"par-capital-management",
		"pinnacle-ventures",
		"sutter-hill-ventures",
		"wrf-capital"
	],
	"amount" : 12100000,
	"year" : 2007
}

```

Now, the problem is that the 1st document returned **does not** include 'greylock' in its list of funders! Despite the fact that we built our `$match` stage to filter for 'greylock'. The reason for this is, `$match` is looking for any companies with **any** funding round that 'greylock' participated in (aka, where 'greylock' is found in _any_ element of the original `funding_rounds.investments` array). So given the above three documents, we can see that while 'greylock' appeared in the 2nd and 3rd (thus fulfilling the `$match`) it does not appear in the 1st document.

What we'd like to do is constrain our results so we're only seeing output funding rounds that 'greylock' participated in, not all the companies for which 'greylock' participated in at least one. So we'll need to filter this further.

One possibility is to reverse the order of `$unwind` and `$match` - putting `$unwind` first. This guarantees that we'll only match documents coming out of `$unwind` that represent funding rounds that 'greylock' actually participated in.

```
db.companies.aggregate([
  {$unwind: '$funding_rounds'},
  {$match: {'funding_rounds.investments.financial_org.permalink':'greylock'}},
  {$project: {
    _id: 0,
    name: 1,
    fundingOrganization: '$funding_rounds.investments.financial_org.permalink',
    amount: '$funding_rounds.raised_amount',
    year: '$funding_rounds.funded_year'
  }}
]).pretty()
```

We can make the above result easier to see if we add a 2nd `$unwind` so that each of the investors are themselves unwound into separate documents.

```
db.companies.aggregate([
    { $unwind: "$funding_rounds" },
    { $unwind: "$funding_rounds.investments" },
    { $match: {"funding_rounds.investments.financial_org.permalink": "greylock" } },
    { $project: {
        _id: 0,
        name: 1,
        funder: "$funding_rounds.investments.financial_org.permalink",
        amount: "$funding_rounds.raised_amount",
        year: "$funding_rounds.funded_year"
    } },
]);
```

But in the above code, both `$unwind` stages have to run through the entire collection. What we want to do is have out `$match` operation occur as early as possible, so that at each subsequent state in the pipeline we're working with as few documents as possible.

What we can do is use two `$match` stages:

```
db.companies.aggregate([
    { $match: {"funding_rounds.investments.financial_org.permalink": "greylock" } },
    { $unwind: "$funding_rounds" },
    { $unwind: "$funding_rounds.investments" },
    { $match: {"funding_rounds.investments.financial_org.permalink": "greylock" } },
    { $project: {
        _id: 0,
        name: 1,
        individualFunder: "$funding_rounds.investments.person.permalink",
        fundingOrganization: "$funding_rounds.investments.financial_org.permalink",
        amount: "$funding_rounds.raised_amount",
        year: "$funding_rounds.funded_year"
    } },
]).pretty()
```

In the above, the first `$match` stage limits the result set to companies where 'greylock' participated in at least 1 funding round. We then `$unwind` the funding_rounds and funding_rounds investments arrays. And then filter (`$match`) again so that we only get documents where 'greylock' is the funder.

And it turns out that when using two `$match` filters, the 2nd `$unnwind` stage is not strictly necessary:

```
db.companies.aggregate([
    { $match: {"funding_rounds.investments.financial_org.permalink": "greylock" } },
    { $unwind: "$funding_rounds" },
    { $match: {"funding_rounds.investments.financial_org.permalink": "greylock" } },
    { $project: {
        _id: 0,
        name: 1,
        individualFunder: "$funding_rounds.investments.person.permalink",
        fundingOrganization: "$funding_rounds.investments.financial_org.permalink",
        amount: "$funding_rounds.raised_amount",
        year: "$funding_rounds.funded_year"
    } }
]);
```

If we don't care about the funder we can simplify (let's sort as well):

```
db.companies.aggregate([
    { $match: {"funding_rounds.investments.financial_org.permalink": "greylock" } },
    { $unwind: "$funding_rounds" },
    { $match: {"funding_rounds.investments.financial_org.permalink": "greylock" } },
    { $project: {
        _id: 0,
        name: 1,
        amount: "$funding_rounds.raised_amount",
        year: "$funding_rounds.funded_year" } },
    { $sort: { year: 1 } }
]);
```

#### Array Expressions

Using array expression in `$project` stages.

First up, `$filter` - allows us to select a subset of elements in an array based on some criteria. The criteria are paths in the documents passed to the next stage in the aggregation pipeline.

`$filter` works with array fields and requires 3 parameters that we must supply: `input`, `as`, and `cond`.

1. `input` can either be an array literal or a _value_ that we supply using the dollar syntax (`input: "$funding_rounds"`)

2. `as` defines the **variable** name we'd like to use for the input array throughout the rest of the filter expression. We need to specify a name here because we might have spec'd an array literal as `input`

3. `cond` - the criteria use to filter the `input` array, selecting the elements that match some specified criterion.

Example: filter for docs where `raised_amount` is greater than $100 million:

```
db.companies.aggregate([
    { $match: {"funding_rounds.investments.financial_org.permalink": "greylock" } },
    { $project: {
        _id: 0,
        name: 1,
        founded_year: 1,
        rounds: { $filter: {
            input: "$funding_rounds",
            as: "round",
            cond: { $gte: ["$$round.raised_amount", 100000000] } } }
    } },
    { $match: {"rounds.investments.financial_org.permalink": "greylock" } },    
]).pretty()
```

New syntax: `$$` ... we use double dollar to reference the `as` variable defined within the expression we're working in. This is to disambiguate a variable from fields in the input document.

In the above case, the `$gte` operator takes an array of 2 values and will return true if the 1st value provided is greater than or equal to the 2nd value.

Next, `arrayElemAt` - returns the element at the specified array index. Say we want to just pull out the 1st and last funding rounds.

`$arrayElemAt` takes an array of two elements. The 1st element is an array that `$arrayElemAt` should work with, and the 2nd element is the index within that array that we would like to see.

We can specify **negative** array index values to work from the end of the array.

```
db.companies.aggregate([
    { $match: { "founded_year": 2010 } },
    { $project: {
        _id: 0,
        name: 1,
        founded_year: 1,
        first_round: { $arrayElemAt: [ "$funding_rounds", 0 ] },
        last_round: { $arrayElemAt: [ "$funding_rounds", -1 ] }
    } }
]).pretty()
```

The `$slice` array expression returns a subset of an array, beginning at a specified index. `$slice` takes an array of three elements: the array, a start index and the number of elements to 'take' from the array.

```
db.companies.aggregate([
  { $match: { "founded_year": 2010 } },
  { $project: {
    _id: 0,
    name: 1,
    founded_year: 1,
    early_rounds: { $slice: [ "$funding_rounds", 1, 3 ] }
  } }
]).pretty()
```

We can use `$slice` to do the same thing we used `$arrayElemAt`. Instead of passing 3 elements in the `$slice` expression we pass just two (the number of elements is assumed to be 1):

```
db.companies.aggregate([
    { $match: { "founded_year": 2010 } },
    { $project: {
        _id: 0,
        name: 1,
        founded_year: 1,
        first_round: { $slice: [ "$funding_rounds", 1 ] },
        last_round: { $slice: [ "$funding_rounds", -1 ] }
    } }
]).pretty()
```

Finally, `$size` - returns the number of elements in an array. Accepts a single expression as an argument: the array to measure.

```
db.companies.aggregate([
    { $match: { "founded_year": 2004 } },
    { $project: {
        _id: 0,
        name: 1,
        founded_year: 1,
        total_rounds: { $size: "$funding_rounds" }
    } }
]).pretty()
```

#### Accumulators

Involve calculating values from fields in multiple documents. Sounds a lot like javascript `reduce()`...

When used in the `$group` stage, accumulators take as input a single expression, evaluating the expression once for each input document, and maintain their state for the group of documents that share the same group key.

`$sum` - returns a sum of numerical values. Ignores non-numeric values.

`$avg` - returns an average of numerical values. Ignores non-numeric values.

`$first` - returns a value from the 1st document for each group. Order is only defined if the documents are in a defined order.

`$last` - returns a value from the last document for each group. Order is only defined if the documents are in a defined order.

`$max` - returns the highest expression value for each group.

`$min` - returns the lowest expression value for each group.

`$push` - returns an array of expression values for each group.

`$addToSet` - returns an array of _unique_ expression values for each group. Order of the array elements is undefined. Available in `$group` stage only.

Prior to MongoDB 3.2 accumulators were only available in the `$group` stage. Starting in 3.2, some accumulators are available in the `$project` stage. The main difference is that accumulators like `$sum` and `$avg` must operate on arrays within a single document.  

#### Using Accumulators in `$project` Stages

Continuing with the discussion of funding rounds ... an example. Because `funding_rounds` is an array in each input document, we can use accumulators to perform calculations on the values in that array. In the following, we create a new value (`largest_round`) using the `$max` accumulator.

```
db.companies.aggregate([
    { $match: { "funding_rounds": { $exists: true, $ne: [ ]} } },
    { $project: {
        _id: 0,
        name: 1,
        largest_round: { $max: "$funding_rounds.raised_amount" }
    } }
])
```

Or we could use the `$sum` accumulator to calculate the total funding for each company in the collection where `funding_rounds` exists:

```
db.companies.aggregate([
    { $match: { "funding_rounds": { $exists: true, $ne: [ ]} } },
    { $project: {
        _id: 0,
        name: 1,
        total_funding: { $sum: "$funding_rounds.raised_amount" }
    } }
])
```

#### Introduction to `$group`

Similar to the SQL `groupBy` command. In a `$group` stage we can aggregate together values from multiple documents and perform some type of aggregate operation on them, such as calculating an average.

Ex. first group together companies by `founded_year`, then calculate the average number of employees for each group.

```
db.companies.aggregate([
    { $group: {
        _id: { founded_year: "$founded_year" },
        average_number_of_employees: { $avg: "$number_of_employees" }
    } },
    { $sort: { average_number_of_employees: -1 } }
])
```

Note that **we have to specify an `_id` field**. That's the `_id` for the resulting new `$group` document! `_id` is how we define/tune what the `$group` stage uses to organize the documents that it sees.

In the above, groups are created that consist of companies with the same founding year, and then the average number of employees is calculated for each group.

Another example, let's find all documents where `relationships.person` is not null, unwind the relationships array to get documents for each relationship, and then group documents by `relationships.person`.

```
db.companies.aggregate( [
    { $match: { "relationships.person": { $ne: null } } },
    { $project: { relationships: 1, _id: 0 } },
    { $unwind: "$relationships" },
    { $group: {
        _id: "$relationships.person",
        count: { $sum: 1 }
    } },
    { $sort: { count: -1 } }
] )
```

#### `_id` in `$group` Stages

Some best practices when constructing `_id` fields in `$group` stages.

1. Explicitly give `_id` a **document**. In the following we could have just done `_id: ""$founded_year"` but in the resulting documents, we might not know what `_id: 2013`, for example, means. Better to embed a document with a key:

```
db.companies.aggregate([
    { $match: { founded_year: { $gte: 2010 } } },
    { $group: {
        _id: { founded_year: "$founded_year"},
        companies: { $push: "$name" }
    } },
    { $sort: { "_id.founded_year": 1 } }
]).pretty()
```

We might also need to create our `_id` field out of a document composed of multiple fields. In the following eample, we're groupoing documents based on their founded year and their category code:

```
db.companies.aggregate([
    { $match: { founded_year: { $gte: 2010 } } },
    { $group: {
        _id: { founded_year: "$founded_year", category_code: "$category_code" },
        companies: { $push: "$name" }
    } },
    { $sort: { "_id.founded_year": 1 } }
]).pretty()
```

Grouping documents based on the year they IPO'd, where that year is a field in an embedded documents:

```
db.companies.aggregate([
    { $group: {
        _id: { ipo_year: "$ipo.pub_year" },
        companies: { $push: "$name" }
    } },
    { $sort: { "_id.ipo_year": 1 } }
]).pretty()
```

**Note** - the above use the `$push` accumulator. As the `$group` stage sees additional values, `$push` will add these values to a running array that it generates.

Using a 'scalar' that resolves to a document to define `_id`:

```
db.companies.aggregate( [
    { $match: { "relationships.person": { $ne: null } } },
    { $project: { relationships: 1, _id: 0 } },
    { $unwind: "$relationships" },
    { $group: {
        _id: "$relationships.person",
        count: { $sum: 1 }
    } },
    { $sort: { count: -1 } }
] )
```

Just like we can specify an `_id` that is a document, we can specify an expression that resolves to a document that we construct earlier from other values.

#### `$group` vs `$project`

Some accumulators that are not available in the `$project` stage.

`$push` is available in `$group` stages but not in `$project` stages. `$group` stages are designed to take a sequence of documents and accumulate values based on the stream of documents. `$project` takes one document at a time.  

```
db.companies.aggregate([
    { $match: { funding_rounds: { $ne: [ ] } } },
    { $unwind: "$funding_rounds" },
    { $sort: { "funding_rounds.funded_year": 1,
               "funding_rounds.funded_month": 1,
               "funding_rounds.funded_day": 1 } },
    { $group: {
        _id: { company: "$name" },
        funding: {
            $push: {
                amount: "$funding_rounds.raised_amount",
                year: "$funding_rounds.funded_year"
            } }
    } },
] ).pretty()
```

A more complicated example. Can't use `$first` and `$last` in `$project` stages, again because `$project` stages are not designed to accumulate values based on multiple documents streaming through them. Rather, `$project` stages are designed to reshape documents one at a time as they pass through.

```
db.companies.aggregate([
    { $match: { funding_rounds: { $exists: true, $ne: [ ] } } },
    { $unwind: "$funding_rounds" },
    { $sort: { "funding_rounds.funded_year": 1,
               "funding_rounds.funded_month": 1,
               "funding_rounds.funded_day": 1 } },
    { $group: {
        _id: { company: "$name" },
        first_round: { $first: "$funding_rounds" },
        last_round: { $last: "$funding_rounds" },
        num_rounds: { $sum: 1 },
        total_raised: { $sum: "$funding_rounds.raised_amount" }
    } },
    { $project: {
        _id: 0,
        company: "$_id.company",
        first_round: {
            amount: "$first_round.raised_amount",
            article: "$first_round.source_url",
            year: "$first_round.funded_year"
        },
        last_round: {
            amount: "$last_round.raised_amount",
            article: "$last_round.source_url",
            year: "$last_round.funded_year"
        },
        num_rounds: 1,
        total_raised: 1,
    } },
    { $sort: { total_raised: -1 } }
] ).pretty()
```

Note the `$sum: 1` in the above aggregate query's `$group` stage `num_rounds` ... whenever you see `$sum: 1` that just means "count up by 1".


```
db.companies.find({ name: "Fox Interactive Media" })
```

#### Homework 6.1

Starting with the example we looked at for calculating the total number of relationships individuals have participated in (in the CrunchBase data set):

```
db.companies.aggregate( [
    { $match: { "relationships.person": { $ne: null } } },
    { $project: { relationships: 1, _id: 0 } },
    { $unwind: "$relationships" },
    { $group: {
        _id: "$relationships.person",
        count: { $sum: 1 }
    } },
    { $sort: { count: -1 } }
] )
```

Write an aggregation query that will determine the number of unique companies with which an individual has been associated. To test that you wrote your aggregation query correctly, from the choices below, select the number of unique companies that Eric Di Benedetto (eric-di-benedetto) has been associated with.

Answer:

```
db.companies.aggregate( [
    { $match: { "relationships.person.permalink": "eric-di-benedetto" } },
    { $project: { name: 1, relationships: 1, _id: 0 } },
    { $unwind: "$relationships" },
    { $match: { "relationships.person.permalink": "eric-di-benedetto" } },
    { $group: {
        _id: "$relationships.person",
        count: { $sum: 1 },
        companies: { $addToSet : '$name' }
    } },
    { $project: {
        _id: 1,
        count: 1,
        uniques: { $size: "$companies" } }
    }
] ).pretty()
```

Result:

```
{
	"_id" : {
		"first_name" : "Eric",
		"last_name" : "Di Benedetto",
		"permalink" : "eric-di-benedetto"
	},
	"count" : 23,
	"uniques" : 15
}
```

#### Homework 6.2

Who is the easiest grader on campus?

Download the handout and import the grades collection using the following command.

```
mongoimport --drop -d test -c grades grades.json
```

Documents in the grades collection look like this.

```
{
    "_id" : ObjectId("50b59cd75bed76f46522c392"),
    "student_id" : 10,
    "class_id" : 5,
    "scores" : [
        {
            "type" : "exam",
            "score" : 69.17634380939022
        },
        {
            "type" : "quiz",
            "score" : 61.20182926719762
        },
        {
            "type" : "homework",
            "score" : 73.3293624199466
        },
        {
            "type" : "homework",
            "score" : 15.206314042622903
        },
        {
            "type" : "homework",
            "score" : 36.75297723087603
        },
        {
            "type" : "homework",
            "score" : 64.42913107330241
        }
    ]
}
```

There are documents for each student (student_id) across a variety of classes (class_id). Note that not all students in the same class have the same exact number of assessments. Some students have three homework assignments, etc.

Your task is to calculate the class with the best average student performance. This involves calculating an average for each student in each class of all non-quiz assessments and then averaging those numbers to get a class average. To be clear, each student's average should include only exams and homework grades. Don't include their quiz scores in the calculation.

What is the class_id which has the highest average student performance? Choose the correct class_id below.

```
db.grades.aggregate([
  { $project: {
      _id: 0,
      student_id: 1,
      class_id: 1,
      scores: {
        $filter: {
          input: "$scores",
          as: "score",
          cond: { $ne: [ "$$score.type", "quiz" ] }
        }
      }
  }},
  { $project: {
      _id: 0,
      student_id: 1,
      class_id: 1,
      avgScore: { $avg: "$scores.score" }
  }},
  { $group: {
    _id: "$class_id",
    numStudents: { $sum: 1 },
    avgGrades: { $addToSet: "$avgScore" }
  }},
  { $project: {
    _id: 1,
    numStudents: 1,
    avgGrade: { $avg: "$avgGrades" }
  }},
  { $sort: { avgGrade: -1 }}
]).pretty()
```

Answer: 1

#### Homework 6.3

For companies in our collection founded in 2004 and having 5 or more rounds of funding, calculate the average amount raised in each round of funding. Which company meeting these criteria raised the smallest average amount of money per funding round? You do not need to distinguish between currencies. Write an aggregation query to answer this question.

As a check on your solution, Facebook had the largest funding round average.

```
db.companies.aggregate([
  { $project: {
    _id: 0, name: 1, founded_year: 1,
    funding_rounds: 1,
    num_funding_rounds: { $size: "$funding_rounds" }
  }},
  { $match: {
    founded_year: 2004,
    num_funding_rounds: { $gte: 5 }
  }},
  { $project: {
    _id: 0, name: 1, founded_year: 1,
    num_funding_rounds: 1,
    total_funding: { $sum: "$funding_rounds.raised_amount" },
    avg_raised: { $avg: "$funding_rounds.raised_amount"}
  }},
  { $sort: { avg_raised: 1 }}
]).pretty()
```

Answer: Nimbit
