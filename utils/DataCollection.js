var tmysql = require('mysql');


//var HOST = '172.16.1.100';
//var PORT = 3306;
var MYSQL_USER = 'chesh';
var MYSQL_PASS = 'amt123';
var DATABASE = 'freeswitch_db';
var iHost;
var iPort;

function HandleDisconnection(connection){
    connection.on('error', function(err){
        if( !err.fatal){
            return;
        }

        if( err.code !== 'PROTOCOL_CONNECTION_LOST'){
            throw err;
        }

        console.log('Re-connecting lost connection: ' + err.stack);
        //connection = _mysql.createConnection(connection.config);
	    connection = tmysql.createConnection({
		    host: iHost,
		    port: iPort,
		    user: MYSQL_USER,
		    password: MYSQL_PASS,
		    insecureAuth: true,
            database: DATABASE,
	    });
        HandleDisconnection(connection);
        connection.connect();
        //connection.query('use' + DATABASE );
    });
}


DataCollection = function(ihost,iport){

    iHost = ihost;
    iPort = iport;
	this.mysql = tmysql.createConnection({
		host: ihost,
		port: iport,
		user: MYSQL_USER,
		password: MYSQL_PASS,
		insecureAuth: true,
        database: DATABASE,
	});
    
    /*
	this.mysql = tmysql.createPool({
		host: ihost,
		port: iport,
		user: MYSQL_USER,
		password: MYSQL_PASS,
		insecureAuth: true,
        database: DATABASE,
        debug:true
    });
    */
    //function handleDisconnect(connection)
    HandleDisconnection(this.mysql);
    
	this.mysql.connect(function(err) {
		if(err) {
			throw err;
		} else {
			console.log('Connected to database');
	        //this.mysql.query('use '+ DATABASE);
           //HandelDisconnection(this.mysql);
		}
	});
	//this.mysql.query('use '+ DATABASE);

};

DataCollection.prototype.QueryCurRegs = function(callback) {
    
    /*
    this.mysql.getConnection(function(err,connection){
        if(err){
            callback(err);
        }else{
            connection.query('SELECT a.sip_user, a.network_ip, a.user_agent FROM sip_registrations a',
                function(err,results,fields){
                    if(err){
                        callback(err);
                    }else{
                        callback(null,results,fields);
                        connection.end();
                    }
            });
        }
    });
    */
    
    
	this.mysql.query('SELECT a.sip_user, a.network_ip, a.user_agent FROM sip_registrations a', 
		function(err, results, fields){
			if(err){
				callback(err);
			}else{
				callback(null, results,fields);
			}
	});
    
    
};

DataCollection.prototype.QueryCurCalls = function(callback){

    /*  
    this.mysql.getConnection(function(err,connection){
        if(err){
            callback(err);
        }else{
            connection.query('SELECT a.cid_num, a.dest, a.created,a.uuid, a.direction ,a.callstate FROM channels a',
                function(err,results,fields){
                    if(err){
                        callback(err);
                    }else{
                        callback(null,results,fields);
                        connection.end();
                    }
            });    
        }    
    });
    */
    
    
	this.mysql.query('SELECT a.cid_num, a.dest, a.created,a.uuid, a.direction ,a.callstate FROM channels a',
		function(err,results,fields){
			if(err){
				callback(err);
			}else{
				callback(null,results,fields);
			}
	});
    

};


DataCollection.prototype.CloseConn = function() {
	this.mysql.end(function(err){
		if(err){
			throw err;
		}else{
			console.log('Disconnected from database\n!');
		}
	});
};

exports.DataCollection = DataCollection;
