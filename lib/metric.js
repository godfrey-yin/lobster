var global = require("../global")
	, SimpleOrm = require("../../simpleorm")
	, Model = SimpleOrm.Model
	, DbHelper = SimpleOrm.DbHelper
	, Orms = require("./orms")
	, Q = require("q")
	, EventEmitter = require('events').EventEmitter;

function Metric (info){
	var me = this;
	EventEmitter.call(this);

	this.set = function (metric){
		this.id = metric.id;
		this.name = metric.name;
		this.desc = metric.desc;
		this.ver = metric.ver;
		this.create_time = metric.create_time;
		this.modifiy_time = metric.modifiy_time;

		try {
			this.keys = JSON.parse(metric.keys);
		} 
		catch (err){
			// do nothing
		}		
	}

	this.set(info);
}
require('util').inherits(Metric, EventEmitter);

/*
	metric - {
		"name" : string, metric name, unique,
		"desc" : string,
		"keys" : [
			{
				"name" : string, key name,
				"type" : string, data type,
				"default" : default value
			},
			... ...
		]
	},
	cb - function (err, metric_id)
*/
exports.create = function (metric, cb){
	var metric_ = {
		"name" : metric.name,
		"desc" : metric.desc,
		"keys" : metric.keys ? JSON.stringify(metric.keys) : null
	}

	var dbhelper = new DbHelper(global.DbConnection);
	dbhelper.getConnection(function (err, connection){
		var mdl = new Model(connection,	Orms.metricsOrm, "id");
		mdl.create(metric_, function (err, id){
			if (err == "ER_OBJECT_EXIST")
				cb && cb("ER_METRIC_EXIST");
			else
				cb && cb(err, id);
		});							
	});	
}

/*
	metric_id - number, metric id, required
	fields - {
		["name"] : string, metric name, unique,
		["desc"] : string,
		["keys"] : [
			{
				"name" : string, key name,
				"type" : string, data type,
				"default" : default value
			},
			... ...
		]
	},
	cb - function (err)
*/
exports.set = function (metric_id, fields, cb){
	if (fields.keys)
		fields.keys = JSON.stringify(fields.keys);

	var dbhelper = new DbHelper(global.DbConnection);
	dbhelper.getConnection(function (err, connection){
		var mdl = new Model(connection,	Orms.metricsOrm, "id");
		mdl.set(metric_id, fields, function (err){
			if (err == "ER_OBJECT_NOT_EXIST")
				cb && cb("ER_METRIC_NOT_EXIST");
			else if (err == "ER_DUP_ENTRY")
				cb && cb("ER_RENAME_METRIC_EXIST");
			else
				cb && cb(err)
		});						
	});	
}

exports.setByName = function (metric_name, fields, cb){
	if (fields.keys)
		fields.keys = JSON.stringify(fields.keys);

	var dbhelper = new DbHelper(global.DbConnection);
	dbhelper.getConnection(function (err, connection){
		var mdl = new Model(connection,	Orms.metricsOrm, "name");
		mdl.set(metric_name, fields, function (err){
			if (err == "ER_OBJECT_NOT_EXIST")
				cb && cb("ER_METRIC_NOT_EXIST");
			else if (err == "ER_DUP_ENTRY")
				cb && cb("ER_RENAME_METRIC_EXIST");
			else
				cb && cb(err)
		});						
	});	
}


/*
	metric_id - number, metric id, required
	cb - function (err, metric)
		metric - {
			"id" : number, metric id,
			"name" : string, metric name, unique,
			"desc" : string,
			"keys" : [
				{
					"name" : string, key name,
					"type" : string, data type,
					"default" : default value
				},
				... ...
			],
			"ver" : number,
			"create_time" : DateTime,
			"modifiy_time" : DateTime	
		}
*/
exports.get = function (metric_id, cb){
	var dbhelper = new DbHelper(global.DbConnection);
	dbhelper.getConnection(function (err, connection){
		var mdl = new Model(connection,	Orms.metricsOrm, "id");
		mdl.get(metric_id, function (err, results){
			if (err){
				cb && cb("ER_OBJECT_NOT_EXIST" == err ? "ER_METRIC_NOT_EXIST" : err, null);
			}
			else {
				cb && cb(null, exports.createMetric(results));
			}
		});							
	});	
}

exports.getByName = function (metric_name, cb){
	var dbhelper = new DbHelper(global.DbConnection);
	dbhelper.getConnection(function (err, connection){
		var mdl = new Model(connection,	Orms.metricsOrm, "name");
		mdl.get(metric_name, function (err, results){
			if (err){
				cb && cb("ER_OBJECT_NOT_EXIST" == err ? "ER_METRIC_NOT_EXIST" : err, null);
			}
			else {
				cb && cb(null, exports.createMetric(results));
			}
		});							
	});	
}

exports.createMetric = function (results){
	return new Metric(results);
}

/*
	metric_id - number, metric id, required
	cb - function (err)
*/
exports.drop = function (metric_id, cb){
	var dbhelper = new DbHelper(global.DbConnection);
	dbhelper.execTransactionSeries(function (connection, commit, rollback){
		var mdl = new Model(connection,	Orms.metricsOrm, "id");
		mdl.setTransactionFlag();

		Q.fcall(function (){
			return Q.Promise(function (resolve, reject, notify){
				mdl.getForUpdate(metric_id, function (err, results){
					if (err)
						reject("ER_OBJECT_NOT_EXIST" == err ? "ER_METRIC_NOT_EXIST" : err);
					else
						resolve();
				})
			})
		}).then(function (){
			return Q.Promise(function (resolve, reject, notify){
				mdl.drop(metric_id, function (err, results){
					if (err)
						reject(err);
					else {
						commit(function (err){
							if (err)
								reject(err.code);
							else{
								cb && cb(null);
								resolve();
							}
						});
					}
				})
			})
		}).catch(function (err){
			rollback();
			cb && cb(err);
		})
	});	
}

exports.dropByName = function (metric_name, cb){
	var dbhelper = new DbHelper(global.DbConnection);
	dbhelper.execTransactionSeries(function (connection, commit, rollback){
		var mdl = new Model(connection,	Orms.metricsOrm, "name");
		mdl.setTransactionFlag();

		Q.fcall(function (){
			return Q.Promise(function (resolve, reject, notify){
				mdl.getForUpdate(metric_name, function (err, results){
					if (err)
						reject("ER_OBJECT_NOT_EXIST" == err ? "ER_METRIC_NOT_EXIST" : err);
					else
						resolve();
				})
			})
		}).then(function (){
			return Q.Promise(function (resolve, reject, notify){
				mdl.drop(metric_name, function (err, results){
					if (err)
						reject(err);
					else {
						commit(function (err){
							if (err)
								reject(err.code);
							else{
								cb && cb(null);
								resolve();
							}
						});
					}
				})
			})
		}).catch(function (err){
			rollback();
			cb && cb(err);
		})
	});	
}

exports.find = function (conditions, options, cb){
	switch (arguments.length){
		case 1:
			return exports.find(null, {}, arguments[0]);
		case 2:
			return exports.find(arguments[0], {}, arguments[1]);
		case 3:
		default:
			var conditions = arguments[0];
			var options = arguments[1];
			var cb = arguments[2];

			break;
	}

	var dbhelper = new DbHelper(global.DbConnection);
	dbhelper.getConnection(function (err, connection){
		var mdl = new Model(connection,	Orms.metricsOrm, "id");
		var finder = mdl.Finder();

		if (conditions)
			finder.addConditions(finder.parseQuery(conditions));

		finder.find(options, function (err, results){
			if (err)
				cb && cb(err);
			else{
				var ret = [];
				results.forEach(function (result){
					ret.push(exports.createMetric(result))
				});

				cb && cb(null, ret);
			}
		});					
	});		
}