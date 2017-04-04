
/*jshint esversion: 6 */

const path = require('path');
const express = require('express');
const exphbs = require('express-handlebars');
const app = express();
const assert = require('assert');
const bodyParser = require('body-parser');

var MongoClient = require('mongodb').MongoClient;

MongoClient.connect('mongodb://localhost:27017/local', function (err, db) {

  if (!err) {
    console.log('We are connected');

    collection = db.collection('med_elet').find().toArray();
    console.log(collection);
    collection.then(function (result) {
      // console.log(result)
      console.log(result);
      dataString = dataString + ' ' + result;
      console.log(dataString);
    });

  }
});

app.use(express.static(path.join(__dirname, 'asset')));
app.use(bodyParser.urlencoded({
  extended: true,
}));
app.use(bodyParser.json());

app.use((request, response, next) => {
  console.log(request.headers);
  next();
});

app.use((err, request, response, next) => {
  // log the error, for now just console.log
  console.log(err);
  response.status(500).send('Something broke!');
});

var hbs = exphbs.create({
    // Specify helpers which are only registered on this instance.
    helpers: {

        test: function () { return 'TEST HELPER WORKS!'; },

      },
  });

app.engine('.hbs', exphbs({
  defaultLayout: 'main',
  extname: '.hbs',
  layoutsDir: path.join(__dirname, 'views/layouts'),
}));

app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'views'));

app.get('/product', (request, response, next) => {

  var prodArray = [];

  var order = request.query.order || 'count';
  console.log('hi yall' + request.query.order);

  MongoClient.connect('mongodb://localhost:27017/local', function (err, db) {
    let prodPromise = new Promise((resolve, reject)=> {
      let temp = ' ';
      let cnt = 1;
      let cntResolver = 0;
      let thresString = '';
      let tUp;
      let tDown;
      db.collection('med_elet').find().forEach(function (doc) {

        cntResolver++;
        if (doc.asin == temp) {
          thresString = doc.threshold;
          tUp = doc.up;
          tDown = doc.down;
          cnt++;
        }else {
          if (cnt != 1) {
            console.log(thresString, temp, cnt);
            prodArray.push({ asin: temp, count: cnt, threshold: thresString,
              up: tUp, down: tDown, });
            cnt = 1;
          }

          temp = doc.asin;
        }

        if (cntResolver == 1000) {
          resolve(prodArray);
        }
      });

    });

    prodPromise.then((val)=> {
      if (order == 'count') {
        val = val.sort(function (a, b) {
            return a.count - b.count;
          });
      }

      console.log(val);
      response.render('products',
      { products: val,
        helpers: {

          test: function () { return 'TEST HELPER WORKS!'; },
        },
      });
    }).catch(reason => console.log(reason));

  });
});

let casNum = 2;

app.post('/product/:id', function (res, req, next) {

  console.log('HERERERERE' + req.body);
  console.log(req.body.cascadeNum);
  next();
});

app.get('/product/:id', (request, response, next) => {

  let order = request.query.order || 'time';

  var itemNumber = "'" + request.params.id + "'";
  console.log(itemNumber);

  var query = '{asin :' + "'" + request.params.id + "'" + '}';
  console.log(query);

  var name = 'asin';
  var value1 =  request.params.id;
  var query1 = {};
  query1[name] = value1;
  console.log(query1);

  var dataArray = [];
  var scoreArray = [];

  MongoClient.connect('mongodb://localhost:27017/local', function (err, db) {

    let dbPromise = new Promise((resolve, reject) => {
          let cntResolver = 0;
          db.collection('med_elet').find({ asin: value1 }).forEach(function (doc) {
            cntResolver++;
            console.log('YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY');
            if (doc.overall > 3) {
              doc.revStat = true;
            }else {
              doc.revStat = false;
            }

            dataArray.push(doc);
            scoreArray.push(doc.overall);
            console.log('wtf');
          });

          setTimeout(function () {
                  if (order == 'time') {
                    prodArray = dataArray.sort(function (a, b) {
                        return a.unixReviewTime - b.unixReviewTime;
                      });
                  }

                  if (order == 'score') {
                    prodArray = dataArray.sort(function (a, b) {
                        return a.overall - b.overall;
                      });
                  }

                  // if (order == 'time') {
                  //   prodArray = dataArray.sort(function (a, b) {
                  //       return a.unixReviewTime - b.unixReviewTime;
                  //     });
                  // });

                }, 1000);

          setTimeout(function () {
              resolve(dataArray);
            }, 1000);

        });

    let cntCascade = 0;
    let cascade = false;
    let up;
    let down;
    let goodRev = 0;
    let badRev  = 0;
    let thres = 0;

    dbPromise
    .then((data)=> {

      data.forEach((e, index, arr)=> {
        if (!cascade) {
          if (cntCascade == casNum) {
            cascade = true;
            arr[index].casUp = true;
            arr[index].casHere = true;
            goodRev++;
            up = true;
          }

          if (cntCascade == -(casNum)) {
            cascade = true;
            arr[index].casDown = true;
            arr[index].casHere = true;
            badRev++;
            down = true;
          }

          if (e.overall > 3) {
            console.log('blahblahblue');
            cntCascade = cntCascade + 1;
          }else {
            cntCascade = cntCascade - 1;
          }
        }else {
          if (e.overall > 3) {
            goodRev++;
          }else {
            badRev++;
          }
        }

      });

      let totalAfterCascade =  goodRev + badRev;

      if (cascade && up) {
        thres = parseFloat(badRev / totalAfterCascade).toFixed(4);
      }

      if (cascade && down) {
        thres = parseFloat(goodRev / totalAfterCascade).toFixed(4);
      }

      return data;
    })
    .then((data)=> {
      console.log('hehehe' + data);
      response.render('home', { items: data, threshold: thres, cascading: cascade, direction: up });

      MongoClient.connect('mongodb://localhost:27017/local', function (err, db) {
              db.collection('med_elet').update({ asin: value1 }, { $set: { threshold: thres, up: up, down: down } }, { multi: true });
            });
    })
    .catch(reason => console.log(reason));

  });
});

app.listen(3001);
