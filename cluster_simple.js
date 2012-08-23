/*

Simple try out to see how the cluster module is working. Also it should find
a list of of primes.

TODO:
1. add some parameter to be the max boundary
2. output the list of primes after interupt

*/

var cluster = require('cluster');
var http = require('http');
var os = require('os');
var util = require('util');
var numCPUs = os.cpus().length;
var primes = [];
var last = 2;

function eachWorker(callback) {
  for (var id in cluster.workers) {
    callback(cluster.workers[id]);
  }
}

var toJson = JSON.stringify;
var fromJson = JSON.parse;

// Loging function which prefixes M for master or W for worker
// and a process.pid
function log(text){
  if(!(typeof text === 'string')){
    text = util.inspect(text);
  }
  console.log((cluster.isMaster?'M':'W') + process.pid + '> ' + text);
}

// Handler for master. gets a replys from workers with prime results and stores
// them in primes array
function messageHandlerMaster (message){
  message = fromJson(message);
  log(message);
  if(message.type === 'reply'){
    if(message.prime){
      primes[primes.length] = message.num;
    }
    // limit the numbers to test
    // TODO 1 use a cmd parameter
    if(last < 10000000){
      cluster.workers[message.worker]
        .send(toJson({type: 'test', num : ++last}));
    }else{
      cluster.workers[message.worker].destroy();
      if(!Object.keys(cluster.workers).length){
        // TODO 2 do this also after interupt
        log('primes: ');
        log(primes);
      }
    }
  }
}

// handles two types of messages. 'id' sets the id of the worker (do not know
// a better way, see below). 'test' or else branch test number for primality
// with the simplest algorithm
function messageHandlerWorker (message){
  message = fromJson(message);
  log(message);
  if(message.type === 'test'){

    var sqrt = Math.ceil(Math.sqrt(message.num));
    var prime = true;
    for(var i = 2; i <= sqrt; i++){
      if(message.num % i ===0){
        prime = false;
        break;
      }
    }
    process.send(toJson({
      type : 'reply',
      prime : prime,
      num : message.num,
      worker : cluster.worker.id
    }));
  }
}

if(cluster.isMaster){

  // fork workers
  for(var i = 0; i < numCPUs; i++){
    cluster.fork().on('message', messageHandlerMaster);
  }

  // exit handler from node.js example
  cluster.on('exit', function (worker, code, signal){
    log('worker ' + worker.process.pid + ' died');
  });

  // start each worker
  eachWorker(function (worker){
    worker.on('online', function() {
      log('sending ask message to ' + worker.process.pid);
      // send the first task to the worker. afterwards they will get tasks from
      // the message handler itself
      worker.send(toJson({type: 'test', num : ++last}));
    });
  });

}else{

  log('worker started ' + process.pid);
  process.on('message', messageHandlerWorker);
}



