/* jshint esversion:6 */

const express = require('express');
const app     = express();
const engines = require('consolidate');

app.engine('html', engines.nunjucks);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

app.get('/', (req, res) => {
  res.render('hello', { 'name' : 'Templates' });
});

app.use( (req, res) => {
  res.sendStatus(404);
});

const server = app.listen(3000, () => {
  let port = server.address().port;
  console.log('Server listening on port %s', port);
});
