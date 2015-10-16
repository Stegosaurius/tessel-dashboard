 
var Keen = require('keen.io');
var wifi = require('wifi-cc3000');
var keenConfigure = require('./assets/js/keenConfigure.js');
// var wifiSettings = {ssid: 'Hack Reactor', password:'awesomebullets'};
var wifiNetwork = 'Hack Reactor';
var wifiPassword = 'awesomebullets';
var wifiTimeoutTime = 0; //in seconds
var wifiSecurity  = 'wpa2';

var wifiTimeouts = 0;

var keen = Keen.configure(keenConfigure);
// src colony modules tls.js
 
var tessel = require('tessel');

var climatelib = require('climate-si7020');
var ambientlib = require('ambient-attx4');
 
var climate = climatelib.use(tessel.port.A);
var ambient = ambientlib.use(tessel.port.D);

var THLSinterval = 10; //update interval for temperature, humidty, light and sound
var soundTriggerLevel = 0.1;
var lightTriggerLevel = 0.5;
var led1 = tessel.led[0].output(0);
var led2 = tessel.led[1].output(0); //led2 is on when wifi is on

 
//------------------------------------------------
// Climate Temp and Humidity
//------------------------------------------------

climate.on('ready', function () {
  console.log('Connected to si7020');
  ambient.on('ready', function () {
 
    // Loop forever
    setInterval(function () {
      led1.toggle();//toggle LEDs to know its running
      climate.readTemperature('f', function (err, temp) {
        climate.readHumidity(function (err, humid) {
          ambient.getLightLevel( function (err, light) {
            ambient.getSoundLevel( function (err, sound) {
              var date = new Date(Date.now());
              console.log("THLS event at : " + new Date(Date.now));
              console.log('Degrees:', temp.toFixed(4) + 'F', 'Humidity:', humid.toFixed(4) + '%RH');
              console.log("Light level:", light.toFixed(8), " ", "Sound Level:", sound.toFixed(8));
              if (wifi.isConnected()) {
                sendToCloud(temp, humid, light, sound, function(){
                  setTimeout(loop, 10000);
                });

              } else {
                console.log("wifi is not connected");
                setTimeout(loop, 10000);
              }
            });
          });
        });
      });
    }, THLSinterval*1000); //THLS interval is in seconds
    // ambient.setLightTrigger(0.5);
    ambient.setLightTrigger(lightTriggerLevel);

    // Set a light level trigger
    // The trigger is a float between 0 and 1
    ambient.on('light-trigger', function(data) {
      console.log("Our light trigger was hit:", data);
      if (wifi.isConnected()) {
        sendLightTrigger(data);
      } else {
        console.log("wifi is not connected");
      }
      // Clear the trigger so it stops firing
      ambient.clearLightTrigger();
      //After 1.5 seconds reset light trigger
      setTimeout(function () {

          ambient.setLightTrigger(lightTriggerLevel);

      },1500);
    });

    // Set a sound level trigger
    // The trigger is a float between 0 and 1
    // ambient.setSoundTrigger(0.1);
    ambient.setSoundTrigger(soundTriggerLevel);

    ambient.on('sound-trigger', function(data) {
      console.log("Something happened with sound: ", data);
      if (wifi.isConnected()) {
        sendSoundTrigger(data);

      } else {
        console.log("wifi is not connected");
      }
      // Clear it
      ambient.clearSoundTrigger();

      //After 1.5 seconds reset sound trigger
      setTimeout(function () {

          ambient.setSoundTrigger(0.1);

      },1500);

    });
  });
});
 
climate.on('error', function(err) {
  console.log('error connecting module', err);
});

ambient.on('error', function (err) {
  console.log(err);
});

function sendToCloud(tdata, hdata, ldata, sdata, cb){
  keen.addEvent("climate", {  
   "temp": tdata,
   "humidity": hdata,
   "light": ldata,
   "sound": sdata
  }, function(){
    console.log("added THLS event");
    cb();
  });
}

function sendLightTrigger(data){
  keen.addEvent("climate", {
   "light-trigger": data
  }, function(){
    console.log("added Light event");
  });
}

function sendSoundTrigger(data){
  keen.addEvent("climate", {
   "sound-trigger": data
  }, function(){
    console.log("added Sound event");
  });
}

//------------------------------------------------
//  Wifi logic 
//------------------------------------------------

wifi.on('connect', function(data){
  // you're connected
  console.log("wifi connect emitted", data);
  led2 = tessel.led[1].output(1);
});

wifi.on('disconnect', function(data){
  // wifi dropped, probably want to call connect() again
  console.log("wifi disconnect emitted", data);
  led2 = tessel.led[1].output(0);
  wifiConnect();
});

wifi.on('timeout', function(err){
  // tried to connect but couldn't, retry
  console.log("wifi timeout (tried to connect but couldn't) emitted");
  wifiTimeouts++;
  if (wifiTimeouts > 2) {
    // reset the wifi chip if we've timed out too many times
    wifiPowerCycle();
  } else {
    // try to reconnect
    wifiConnect();
  }
});

wifi.on('error', function(err){
  // one of the following happened
  // 1. tried to disconnect while not connected
  // 2. tried to disconnect while in the middle of trying to connect
  // 3. tried to initialize a connection without first waiting for a timeout or a disconnect
  console.log("wifi error emitted", err);
});

// reset the wifi chip progammatically
function wifiPowerCycle(){
  // when the wifi chip resets, it will automatically try to reconnect
  // to the last saved network
  wifi.reset(function(){
    wifiTimeouts = 0; // reset timeouts
    console.log("done power cycling wifi");
    // give it some time to auto reconnect
    setTimeout(function(){
      if (!wifi.isConnected()) {
        // try to reconnect
        wifiConnect();
      }
      }, 20 *1000); // 20 second wait
  })
}

function connectCallback(data) {
  console.log('reconnected to wifi', data);
}

function wifiConnect(){
  console.log('running wifiConnect');
  wifi.connect({
  // security: wifiSecurity, 
  ssid: wifiNetwork
  , password: wifiPassword
  // , timeout: wifiTimeoutTime// in seconds
  }, connectCallback );
}

// connect wifi now, if not already connected
if (!wifi.isConnected()) {
  console.log('running initial wifiConnect');
  wifiConnect();
}else{
  led2 = tessel.led[1].output(1);
}

// // wifi.on('disconnect', function(){
// //   console.log("disconnected, trying to reconnect");
// //   wifi.connect({
// //     ssid: 'Hack Reactor',
// //     password:'awesomebullets'
// //   });
// // });
// wifi.on('connect', function() {
//   console.log('Tessel is connected to wifi');
// });

// wifi.on('disconnect', function (err) {
//   console.log("********** WIFI DISCONNECT ***********");
//   wifi.reset(function() {
//     console.log('reset wifi... attempting reconnect.');
//     wifi.connect(wifiSettings, connectCallback);
//   });
// });

// wifi.on('error', function(err) {
//   console.log('error with wifi', err);
// });

// function connectCallback(data) {
//   console.log('reconnected to wifi', data);
// }

// if (!wifi.isConnected()) {
//   console.log('connecting to wifi...');
//   wifi.connect(wifiSettings, connectCallback);
// }