var g = require('../../global')
	, response = require('./response')
	, escape_array = require('../../utils/escape_array');

module.exports = function (router){
	router.get("/topics/:topic_name/readaggregation", function (req, res, next){
		req.query.fields = escape_array(req.query.tag);
		g.getApp().readAggregation(req.params.topic_name, req.query, function (err, results){
			response(res, err, results);
		});
	})
}