'use strict';

/*jshint esversion: 6 */

const path = require('path');
const express = require('express');
const exphbs = require('express-handlebars');
const app = express();
const bodyParser = require('body-parser');

var MongoClient = require('mongodb').MongoClient;
var db;

//getProducts(function (results) {});

// Connect to the database
function getProducts(callback) {
	MongoClient.connect('mongodb://localhost:27017/reviews', function (err, reviewsDB) {
		db = reviewsDB;
		if (!err) {
			reviewsDB.collection('ranged', function (err, collection) {
				// create an object from the database
				collection.find().toArray(function (err, results) {
					checkCascading(results, function (cascadingObject) {
						if (typeof callback === 'function') {
							callback(cascadingObject);
						}
					});
				});
			});
		}
	});
}

// Check the cascading effect of each product
function checkCascading(products, callback) {
	var cascadedObject = [];

	for (var i = 0; i < products.length; i++) {
		var product = products[i],
			cascade = false,
			cascadingDown = false,
			cascadingUp = false,
			cascadeNumber = 2,
			cascadeCount = 0,
			goodReviewCount = 0,
			badReviewCount = 0,
			threshold,
			cascadeDirection = 'No cascading';

		for (var j = 0; j < product.reviews.length; j++) {
			var review = product.reviews[j];

			if (!cascade) {
				if (cascadeCount == cascadeNumber) {
					cascade = true;
					cascadingUp = true;
					goodReviewCount++;
				}

				if (cascadeCount == -(cascadeNumber)) {
					cascade = true;
					cascadingDown = true;
					badReviewCount++;
				}

				if (review.score > 3) {
					cascadeCount++;
				} else {
					cascadeCount--;
				}
			} else {
				if (review.score > 3) {
					goodReviewCount++;
				} else {
					badReviewCount++;
				}
			}
		};

		if (cascade && cascadingUp) {
			threshold = parseFloat(badReviewCount / product.count).toFixed(4);
			cascadeDirection = 'Up';
		} else if (cascade && cascadingDown) {
			threshold = parseFloat(goodReviewCount / product.count).toFixed(4);
			cascadeDirection = 'Down';
		}

		var document = {
			_id: product._id,
			score: product.score.toFixed(2),
			reviewCount: product.count,
			cascadeDirection: cascadeDirection,
			threshold: threshold,
			reviews: product.reviews
		};

		cascadedObject.push(document);

		db.collection('cascade', function (err, collection) {
			collection.insert(document, { w: 1 }, function (err, records) {
				console.log("Record added.");
			});
		});

		if (typeof callback === 'function') {
			callback(cascadedObject);
		}
	}
}

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

app.get('/', (request, response, next) => {
	MongoClient.connect('mongodb://localhost:27017/reviews', function (err, db) {
		db.collection('cascade', function (err, collection) {
			// create an object from the database
			collection.find().toArray(function (err, results) {
				var averageScore = 0,
					averageThreshold = 0,
					brackets = [0,0,0,0,0,0,0,0,0,0],
					averageOffset = 0,
					thresholdVariation = 0;

				for (var i = 0; i < results.length; i++) {
					var product = results[i];
					var thisThreshold = parseFloat(product.threshold);
					averageScore += parseFloat(product.score);
					averageThreshold += thisThreshold;

					var index = thisThreshold.toFixed(1) * 10;
					brackets[index]++;

					var helpful = findMostHelpful(product);
					averageOffset += (helpful.index / product.reviews.length);
					var difference = thisThreshold - helpful.threshold;
					thresholdVariation += difference > 0 ? difference : -difference;

					results[i].helpfulIndex = (helpful.index / product.reviews.length * 100).toFixed(2);
				}

				averageScore = (averageScore / results.length).toFixed(2);
				averageThreshold = (averageThreshold / results.length).toFixed(4);
				thresholdVariation = (thresholdVariation / results.length).toFixed(4);
				averageOffset = (averageOffset / results.length * 100).toFixed(2);

				response.render('products', {
					products: results,
					averageScore: averageScore,
					averageThreshold: averageThreshold,
					brackets: brackets,
					count: results.length,
					thresholdVariation: thresholdVariation,
					averageOffset: averageOffset
				});
			});
		});
	});
});

app.get('/:id', (request, response, next) => {
		MongoClient.connect('mongodb://localhost:27017/reviews', function (err, db) {
		db.collection('cascade', function (err, collection) {
			// create an object from the database
			collection.find({ "_id": request.params.id }).toArray(function (err, results) {
				var product = results[0];
				if (product !== undefined) {
					product.helpful = findMostHelpful(product);
					response.render('home', product);
				}
			});
		});
	});
});

function findMostHelpful(singleProduct, callback) {
	var max = 0,
		offset = 0,
		score,
		helpfulness,
		highScores = 0,
		lowScores = 0;

	for (var i = 0; i < singleProduct.reviews.length; i++) {
		var review = singleProduct.reviews[i],
		    helpful = review.helpful[0];

		if (helpful > max) {
			max = helpful;
			helpfulness = helpful;
			offset = i;
			score = review.score
		}
		if (review.score > 3)
			highScores++;
		else
			lowScores++;
	}

	var helpfulReview = helpfulCascade(offset, singleProduct);
	helpfulReview.score = score;
	helpfulReview.helpfulness = helpfulness;
	helpfulReview.offset = offset;
	helpfulReview.high = highScores;
	helpfulReview.low = lowScores;

	return helpfulReview;
}

function helpfulCascade(offset, product) {
	var reviews = product.reviews,
		threshold,
		cascade = false,
		cascadingDown = false,
		cascadingUp = false,
		cascadeNumber = 2,
		cascadeCount = 0,
		goodReviewCount = 0,
		badReviewCount = 0,
		cascadeDirection = 'No cascading';

	for (var j = offset; j < reviews.length; j++) {
		var review = reviews[j];

		if (!cascade) {
			if (cascadeCount >= cascadeNumber) {
				cascade = true;
				cascadingUp = true;
				goodReviewCount++;
			}

			if (cascadeCount <= -(cascadeNumber)) {
				cascade = true;
				cascadingDown = true;
				badReviewCount++;
			}

			if (review.score > 3) {
				cascadeCount++;
			} else {
				cascadeCount--;
			}
		} else {
			if (review.score > 3) {
				goodReviewCount++;
			} else {
				badReviewCount++;
			}
		}
	};

	if (cascade && cascadingUp) {
		threshold = parseFloat(badReviewCount / product.reviewCount).toFixed(4);
		cascadeDirection = 'Up';
	} else if (cascade && cascadingDown) {
		threshold = parseFloat(goodReviewCount / product.reviewCount).toFixed(4);
		cascadeDirection = 'Down';
	}

	return {
		index: (offset + 1),
		threshold: threshold,
		cascadeDirection: cascadeDirection
	}
}

app.listen(3001);
