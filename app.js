var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const apiRouter = require('./routes/api');


var app = express();

// variable to enable global error logging
const enableGlobalErrorLogging = process.env.ENABLE_GLOBAL_ERROR_LOGGING === 'true';


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api', apiRouter);


app.use((req, res, next) => {
  const err = new Error();
  res.locals.errMsg = "Route doesn't exist";
  res.locals.errStatus = 404;
  next(err);
});

app.use((err, req, res, next) => {
  res.status(res.locals.errStatus || err.status || 500);
  err.message = res.locals.errMsg || err.message || "an has error occurred";
  res.json({
    error: {message: err.message}
  });
});



module.exports = app;
