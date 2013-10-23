var express = require('express'),
	app = express(),
	server = require('http').createServer(app).listen(8070),
	fs = require('fs'),
	io = require('socket.io').listen(server);

var _freeswitch = require('./refLib/freeswitch');
var _dataCollection = require('./refLib/DataCollection').DataCollection;

var freeswitch = new _freeswitch.client('172.16.1.100', 8021, 'ClueCon');
//var datacoll = new _dataCollection('172.16.1.100',3306);


var accessLogFile = fs.createWriteStream('access.log',{flags: 'a'});
var errorLogFile  = fs.createWriteStream('error.log', {flags: 'a'});

app.use("/styles", express.static(__dirname + '/public/styles'));
app.use("/scripts", express.static(__dirname + '/public/scripts'));
app.use("/images", express.static(__dirname + '/public/images'));

app.use(express.logger({stream: accessLogFile}));

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler());
  app.error(function (err,reg,res,next){
  	var meta = '[' + new Date() + '] ' + req.url + '\n';
  	errorLogFile.write(meta + err.stack + '\n');
  	next();
  }); 
});


io.set('log level', 3);
io.set('transports', [ 'websocket', 'xhr-polling' ]);

app.get("/agentmap",function(req,res){

	res.sendfile(__dirname+'/public/agentmap.html');

});

app.get('/tests',function(req,res){
    res.sendfile(__dirname+'/public/tests.html');
});
app.get('/time',function(req,res){
    res.sendfile(__dirname+'/public/time.html');
});
app.get('/date',function(req,res){
    res.sendfile(__dirname+'/public/date.html');
});


freeswitch.connect();
var datacoll;
io.sockets.on('connection', function(socket){

	socket.on('connect',function(data){
		console.log("connected\n");
        datacoll = new _dataCollection('172.16.1.100',3306);
		connect(socket, data);
	});

	freeswitch.on('CUSTOM', function(event){
		if(event['Event-Subclass'] === 'sofia::register'){
			console.log(1);
			socket.emit('register',{u_id: event['from-user'], u_ip: event['network-ip'], u_agent: event['user-agent']});
			socket.broadcast.emit('register',{u_id: event['from-user'], u_ip: event['network-ip'], u_agent: event['user-agent']});
		}else if(event['Event-Subclass'] === 'sofia::unregister'){
			console.log(2);
			socket.emit('unregister',{u_id: event['from-user']});
			socket.broadcast.emit('unregister',{u_id: event['from-user']});
		}else{
			console.log(event);
		}
	});

	freeswitch.on('CHANNEL_CREATE', function(event){
		console.log('Channel created!\n');
		//fs generates two channel_create messages
		//inbound message
		if(event['Call-Direction'] == 'inbound'){
			socket.emit('ch_create', {call_id: event['Caller-Caller-ID-Number'], uuid: event['Unique-ID'],
				leg_ctime: event['Event-Date-Local'], message: "OUT ", state: "RINGING", callee_id: event['Caller-Destination-Number']});
			socket.broadcast.emit('ch_create', {call_id: event['Caller-Caller-ID-Number'], uuid: event['Unique-ID'],
				leg_ctime: event['Event-Date-Local'], message: "OUT ", state: "RINGING", callee_id: event['Caller-Destination-Number']});
		}else{
			//outbound 
			socket.emit('ch_create', {call_id: event['Caller-Callee-ID-Number'], uuid: event['Unique-ID'],
				leg_ctime: event['Event-Date-Local'], message: "IN ", state: "RINGING", callee_id: event['Caller-Caller-ID-Number']});
			socket.broadcast.emit('ch_create', {call_id: event['Caller-Callee-ID-Number'], uuid: event['Unique-ID'],
				leg_ctime: event['Event-Date-Local'], message: "IN ", state: "RINGING", callee_id: event['Caller-Caller-ID-Number']});
		}
	});
	freeswitch.on('CHANNEL_ANSWER', function(event){
		console.log('Channel answered!\n');
		if(event['Call-Direction'] == 'inbound'){
            socket.emit('ch_answer',{call_id: event['Caller-Caller-ID-Number'], uuid: event['Unique-ID'],state: "ANSWERED"});
			socket.broadcast.emit('ch_answer', {call_id: event['Caller-Caller-ID-Number'], uuid: event['Unique-ID'],state: "ANSWERED"});
		}else {
            socket.emit('ch_answer',{call_id: event['Caller-Callee-ID-Number'], uuid: event['Unique-ID'], state: "ANSWERED"});
			socket.broadcast.emit('ch_answer', {call_id: event['Caller-Callee-ID-Number'], uuid: event['Unique-ID'], state: "ANSWERED"});
		}
	});
	freeswitch.on('CHANNEL_DESTROY', function(event){
		console.log('Channel  destoryed\n');
		if(event['Call-Direction'] == 'inbound'){
            //socket.emit('ch_destory',{call_id: event['Caller-Caller-ID-Number'], uuid: event['Unique-ID']});
            //io.sockets.emit('ch_destory',{call_id: event['Caller-Caller-ID-Number'], uuid: event['Unique-ID']});
			socket.emit('ch_destroy', {call_id: event['Caller-Caller-ID-Number'], uuid: event['Unique-ID']});
			socket.broadcast.emit('ch_destroy', {call_id: event['Caller-Caller-ID-Number'], uuid: event['Unique-ID']});
		}else {
            //io.sockets.emit('ch_destory',{call_id: event['Caller-Callee-ID-Number'], uuid: event['Unique-ID']});
			socket.emit('ch_destroy', {call_id: event['Caller-Callee-ID-Number'], uuid: event['Unique-ID']});
			socket.broadcast.emit('ch_destroy', {call_id: event['Caller-Callee-ID-Number'], uuid: event['Unique-ID']});
		}
	});	

	socket.on('disconnect',function(){
        datacoll.CloseConn();
		disconnect(socket);
        
	});
});

freeswitch.on('connect', function(){
	freeswitch.event('CHANNEL_CREATE CHANNEL_ANSWER CHANNEL_DESTROY CUSTOM sofia::register sofia::unregister');
	console.log('Connected to freeswitch\n');
});



//template functions
function connect(socket,data){

	//freeswitch.connect();
	datacoll.QueryCurRegs(function(err,results,fields){
		if(err){
			throw err;
		}else{
			console.log("serve emit registrations event:\n");
			console.log(results);
			socket.emit('registrations',results);
		}
	});
	datacoll.QueryCurCalls(function(err,results,fields){
		if(err){
			throw err;
		}else{
			console.log("server emit curCalls:\n");
			console.log(results);
			if(results.length == 0){
				console.log("no curCalls\n");
			}else{
				socket.emit('curCalls',results);
			}
		}
	});
    //datacoll.CloseConn();
}

function disconnect(socket){
	console.log(socket.id + ' disconneted\n');
}


console.log("server running at localhost:8070");
