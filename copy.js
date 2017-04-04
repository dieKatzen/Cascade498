const path = require('path');
const express = require('express');
const exphbs = require('express-handlebars');
const app = express();
const Promise = require('bluebird');
const assert = require('assert');
// var Chart = require('chart.js')
// var ctx = document.getElementById("myChart");

// var data = {
//     labels: ["January", "February", "March", "April", "May", "June", "July"],
//     datasets: [
//         {
//             label: "My First dataset",
//             fill: false,
//             lineTension: 0.1,
//             backgroundColor: "rgba(75,192,192,0.4)",
//             borderColor: "rgba(75,192,192,1)",
//             borderCapStyle: 'butt',
//             borderDash: [],
//             borderDashOffset: 0.0,
//             borderJoinStyle: 'miter',
//             pointBorderColor: "rgba(75,192,192,1)",
//             pointBackgroundColor: "#fff",
//             pointBorderWidth: 1,
//             pointHoverRadius: 5,
//             pointHoverBackgroundColor: "rgba(75,192,192,1)",
//             pointHoverBorderColor: "rgba(220,220,220,1)",
//             pointHoverBorderWidth: 2,
//             pointRadius: 1,
//             pointHitRadius: 10,
//             data: [65, 59, 80, 81, 56, 55, 40],
//             spanGaps: false,
//         }
//     ]
// };
//
// var myLineChart = new Chart(ctx, {
//     type: 'line',
//     data: data,
//     options: options
// });

Handlebars.registerHelper('debug', function (optionalValue) {
  console.log('Current Context');
  console.log('====================');
  console.log(this);

  if (optionalValue) {
    console.log('Value');
    console.log('====================');
    console.log(optionalValue);
  }
});

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

app.use((request, response, next) => {
  console.log(request.headers);
  next();
});

app.use((request, response, next) => {
  request.chance = Math.random();
  next();
});

app.use((err, request, response, next) => {
  // log the error, for now just console.log
  console.log(err);
  response.status(500).send('Something broke!');
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

  MongoClient.connect('mongodb://localhost:27017/local',function(err,db){
let prodPromise = new Promise((resolve, reject)=>{
  let temp = ' ';
  let cnt = 1;
  let cntResolver =0;
  db.collection('med_elet').find().forEach(function(doc){
    cntResolver++;
    if(doc.asin == temp){
      cnt++;
    }else{
      temp = doc.asin;
      if(cnt !=1){
       prodArray.push({asin: temp,count: cnt});
        // console.log(dataArray);
        cnt=1;
      }
    }
    if(cntResolver==1000){
      resolve(prodArray);
    }
  })

});

prodPromise.then((val)=>{
  console.log(val);
  response.render('products', {products: val})
// response.render('home', {items: dataArray})
}).catch(reason => console.log(reason));

  })
})


app.get('/product/:id', (request, response, next) => {

  var itemNumber = "'"+ request.params.id +"'";
  console.log(itemNumber);

var query = "{asin :"+"'"+ request.params.id +"'"+ "}";
  console.log(query);


    var name = "asin";
      var value1 =  request.params.id ;
    var query1 = {};
    query1[name] = value1;
    console.log(query1);


  var dataArray =[];
    var scoreArray =[];

  MongoClient.connect("mongodb://localhost:27017/local",function(err,db){


let dbPromise = new Promise((resolve, reject) =>{
  let cntResolver = 0;
  db.collection('med_elet').find({ asin:value1}).forEach(function(doc){
    cntResolver++;
    console.log("YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY")

      dataArray.push(doc);
      scoreArray.push(doc.overall);
        console.log("wtf")
  });



setTimeout(function () {
    resolve(dataArray)
}, 1000);

setTimeout(function () {
    resolve(dataArray)
}, 1000);

})


dbPromise.then((data)=>{
response.render('home', {items: data});
})
.catch(reason => console.log(reason));

  })
})

app.listen(3001)
