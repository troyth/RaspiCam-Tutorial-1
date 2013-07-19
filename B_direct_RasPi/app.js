/**
 * Here we set up the main module dependencies. Node.js uses the Common.js style of Asynchronous Module 
 * Definitions (AMD), which assigns a variable, such as "express" below, to the exported objects of a 
 * module (another javascript file) through the require() function.
**/
var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , path = require('path');

/**
*
* app is the main export of the express module, it exposes the setup and server objects and functions
* that we need to setup and run an Express.js web server.
*
**/
var app = express();

/**
*
* app.set() will set any necessary environment variables for this Express.js app, such as which port
* to listen on, which directory the views are stored in that need to be rendered, and which render
* engine (ejs is used here) is used to convert the views to HTML that can be served to web browsers.
*
**/
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

/**
*
* app.use() sets up the middleware, additional functions that we can take advantage of to make building
* and serving the app easier, such as the Express.js bodyParser, which presents the elements of a POST
* request form as objects that we can easily pull from the request (req) object. It also sets up the
* static directories, which are those that serve static files that don't need to be rendered (eg. anything
* in the public directory).
*
**/
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
app.use(express.session());
app.use(app.router);
app.use(require('less-middleware')({ src: __dirname + '/public' }));
app.use(express.static(path.join(__dirname, 'public')));

/**
*
* Here, we set any additional Express.js app environment variables or middleware that we want to use
* exclusively in our development site, as opposed to the production site. For this tutorial, we will
* only concern ourselves with development, rather than adding special features to improve performance,
* limit logging, etc, that we would want on a production web app.
*
**/
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}


/**
*
* Here we set up the routes: which functions should be called when a user goes to different pages in the app.
* The app.get(param1, param2) function will catch any get request and compare it to param1. If the URL pathname
* matches param1, it will execute param2, which should be a function. In this case, we are routing to a function
* called index that is declared in the index.js file stored in the routes/ directory (the variable routes was set 
* to this file in the module declarations in the top of this file)
*
**/
app.get('/', routes.index);

/**
*
* Set up the Express.js server using the HTTP module provided by Node.js by passing the app variable that you 
* have previously set up (using the set, use and get functions) to the createServer() function of the HTTP module
* and have it listen to the given port, in this case 3000. This will log out a message to the console once the server 
* is live (the second parameter of the listen() function is a callback, so this function will be called once the 
* listen() function is complete).
*
**/
var server = http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

/**
*
* Set up the web socket server by loading the module using require() and have it listen to the http server you just
* set up above.
*
**/
var io = require('socket.io').listen(server);

/**
*
* Set up the Johnny-Five module. This module builds on top of the Serialport module, which allows you to communicate
* using serial ports on the computer it is installed on (in this case, a Raspberry Pi), including the USB port.
* It also builds on the firmata module, which can communicate with an Arduino that has loaded the StandardFirmata
* sketch. Below you will include the johnny-five module (which in turn loads the seriaports and firmata modules),
* and instantiate the other variables you will need.
*
* Note: Johnny-Five has a number of pre-built examples for connecting to well-known sensors and actuators, such as a 
* photoresistor as we are using here. See https://github.com/rwldrn/johnny-five/blob/master/docs/photoresistor.md
*
**/
var five = require("johnny-five-plus-raspicam"),
    camera, filename, filepath;

/**
*
* Here you will set up an event listener on the board. Javascript is an asynchronous language, meaning that at any
* point in time it can respond to inputs, rather than other blocking/synchronous languages that execute from top
* to bottom of the code and cannot handle unexpected purturbations. The way to have javascript respond to an
* unscheduled input is to set a listener, which you can do many ways. Here, we use the on() function.
*
* The board.on(param1, param2) function does the following: upon a param1 type of event, execute the param2 function.
* So, the below code waits for the board to be ready (param1), then executes the anonymous function (param2).
*
**/
  filename = new Date().getTime()+'.jpg';
  filepath = '/home/pi/apps/RaspiCam-Tutorial-1/B_direct_RasPi/public/images/'+filename;

  /**
  *
  * Here you will create a Sensor object defined by the Johnny-Five module and assign it to the photoresistor
  * variable. You will initialize which pin it connects to, and how often it will trigger a "read" event
  * with its value using the freq attribute, which is measured in milliseconds.
  *
  **/
  
  camera = new five.RaspiCam({
    freq: 10000,//update the value every this many milliseconds and trigger a "read" event
    filepath: filepath,
    mode: 'still'
  });

  

  /**
  *
  * Here you will bind an anonymous function to the photoresistor read event that is triggered
  * every N milliseconds, as set up above. The anonymous function has two values passed to it:
  * an error (err), which will be null if there is no error and will contain an error message
  * if there was a problem, and the value of the analog sensor connected to pin A2 (the photoresistor).
  * Each time the value is updated, this function will be called with the new value, or an error.
  *
  **/
  camera.on("read", function( err, imagepath ) {
    /* Here we just log the value to the Raspberry Pi console */
    console.log( "---error from camera: " + err );
    console.log('path to picture: '+ imagepath);

    if(filepath == imagepath){
      setTimeout(function(){
        io.emit('sendIt', filename );
      }, 10000);
      
    }

    /**
    *
    * This is the key bit of the code that connects the "read" event listener of the photoresistor to
    * the websocket that will asynchronously send it to any website that is connected to this server
    * to be updated in real time.
    * 
    * Because both the input from the photoresistor and the output to the web socket are asynchronous,
    * we need to chain up the photoresistor input listener to an emitter that triggers an event
    * for the web socket. So, whenever a new value comes in that triggers a "read" event, the below
    * emit() function triggers a "sendIt" event that carries the value of the input as its payload.
    *
    **/
    
  });



/**
*
* Here we set up a listener on the web socket for any new web browser clients that will connect. The
* "connection" event is triggered each time a new browser navigates to the URL of this app, so the event
* will be triggered many times if many people around the world visit our URL. When this happens, the
* anonymous function will be called with one parameter, the new socket that is set up between this server
* and the new browser client.
*
**/
io.sockets.on('connection', function(socket){
  /**
  *
  * Now that a connection has been made to a new browser client, we begin by sending a test of 123 down
  * the socket, which the client code will log to the console. We also log "Socket connected" to the
  * Raspberry Pi console.
  *
  **/
  console.log("Socket connected"); 
  socket.emit('connected', 'You have successfully connected to server thorugh a web socket'); 

  /**
  *
  * Here we set up the listener for the io "sendIt" event that the photoresistor triggers each time
  * it reads a new value from the physical sensor input. When the io object emits a "sendIt" event,
  * the anonymous function is called, which has access to the payload in the parameter called val.
  *
  **/
  io.on('sendIt', function(val){
    /**
    *
    * We first log a new line and then the data to send along the web socket to the new browser client
    * in the Raspberry Pi console.
    *
    **/
    console.log('');
    console.log('***data to send is '+ val);

    /**
    *
    * Finally, we emit a "sendData" event with the payload of val along the socket to the browser client.
    * The browser can access this value, the value of the analog photoresistor sensor, by listending for
    * and handling the "sendData" event.
    *
    **/
    socket.emit('sendData', val);
  });
});





