var EventEmitter = require('events').EventEmitter
	, co = require('co')
	, Q = require('q')
	, config = require('../config.json');

function Scheduler(queue){
	var me = this;
	EventEmitter.call(this);

	this.doAJob = function (worker){
		return Q.Promise(function (resolve, reject){
			worker.on('completed', function (){
				resolve("ok");
			});

			worker.on('error', function (err){
				resolve("reject");
			});

			worker.work();
		});
	}

	this.run = function (){
		if (!queue || !queue.size()){
			return me.emit('completed');
		}

		var parallel = 0;
		var run_ = function (){
			while(queue.size() && parallel < config.aggregation.parallel_jobs){
				/*
					注意:
					不要将parallel++放在while(queue.size() && ...)中, 因为我们需要确保parallel++的执行
				*/
				parallel++;
				(function (the_worker){
					co(function *(){
						var state = yield me.doAJob(the_worker);
						if (state != "ok"){
							if (the_worker.getRetryTimes() < config.aggregation.max_retry_times){
								the_worker.addRetryTimes();
								queue.add(the_worker);
								me.emit('job', the_worker.getJob(), "retry");
							}
							else{
								me.emit('job', the_worker.getJob(), "drop")
							}
						}
						else{
							me.emit('job', the_worker.getJob(), "finish");
						}

						if (--parallel == 0){
							if (queue.size()){
								setImmediate(run_);
							}
							else{
								me.emit('completed');
							}
						}
					});

				})(queue.next());
			}			
		}

		run_();
	}
}
require('util').inherits(Scheduler, EventEmitter);

module.exports = Scheduler;