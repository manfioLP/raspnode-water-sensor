const GPIO = require('onoff').Gpio;
const awsIot = require('aws-iot-device-sdk');

const testBerryOptions = require('./config/deviceOptions');

// aux variables
let clientTokenUpdate;
let prevWet = false;

// setting sdk
const device = awsIot.device(testBerryOptions);
const thingShadow = awsIot.thingShadow(testBerryOptions);

thingShadow.on('status', (thingName, stat, clientToken, stateObject) => {
	console.log(`received ${stat} on ${thingName}: ${JSON.stringify(stateObject)}`);
});

thingShadow.on('delta', (thingName, stateObject) => {
	console.log(`received delta on ${thingName}: ${JSON.stringify(stateObject)}`);
});

thingShadow.on('timeout', (thingName, clientToken) => {
	console.log(`received timeout on ${thingName} with token: ${clientToken}`);
});



device
	.on('connect', () => {
		console.log('connect...');
		device.publish('WaterSensorPolicy', JSON.stringify({message: 'NodeJS server connected...', deviceState}));
		
		thingShadow.register('TestBerry', {}, () => {
			const testBerryState = {"state":{"desired":{"waterSensor": deviceState.waterSensor, "buzzer": deviceState.buzzer, "timestamp": deviceState.timestamp}}};
			
			clientTokenUpdate = thingShadow.update('TestBerry', testBerryState);
			
			if (!clientTokenUpdate) console.log('updating shadow failed...');
		});
	});

device.on('message', (topic, payload) => {
	console.log('message', topic, payload.toString());
});

// settings GPIOS
const wetSensor = new GPIO(18, 'out');
const buzzer = new GPIO(17, 'out');
buzzer.writeSync(0);

// read buzzer state, water sensor and timestamp
const deviceState = {  };
function initDeviceState() {
	deviceState.buzzer = buzzer.readSync() ? 'HIGH' : 'OFF';
	deviceState.waterSensor = wetSensor.readSync() ? 'HIGH' : 'OFF';
	deviceState.timestamp = new Date().getTime();
}

function updateDeviceState() {
	deviceState.buzzer = buzzer.readSync() ? 'HIGH' : 'OFF';
	deviceState.waterSensor = wetSensor.readSync() ? 'HIGH' : 'OFF';
	deviceState.timestamp = new Date().getTime();
	
	const testBerryState = {"reported":{"desired":{"waterSensor": deviceState.waterSensor, "buzzer": 'DISCONNECTED', "timestamp": deviceState.timestamp}}};

	// TODO: verify why not updating
	clientTokenUpdate = thingShadow.update('TestBerry', testBerryState);
	console.log('UPDATED TOKEN: ', clientTokenUpdate);
}

function sensor(condition) {
	console.log('Attempting to handle sensor');
		if (condition === 'wet') {
			device.publish('WaterSensorHigh', JSON.stringify({message: 'water level rose...', waterSensor: 'HIGH'}));
			console.log('sensor got wet');
			prevWet = true;
			buzzer.writeSync(1);
		}
		if (condition === 'dry') {
			// do something
			console.log('sensor got dry or not sufficiently wet.');
			prevWet = false;
			buzzer.writeSync(0);
			updateDeviceState('HIGH', 'OFF')
		}
		updateDeviceState();
}

function RCtime () {
    let reading = 0
    while(true) {
        if (wetSensor.readSync() === 0)
            reading += 1
        if (reading >= 1000)
            return 0
        if (wetSensor.readSync() != 0)
            return 1
		}
}

function main() {
	initDeviceState();
	if (RCtime() === 1 && !prevWet) {
		sensor('wet');
		const refresh = setInterval( () => {
			if (wetSensor.readSync())
				console.log('sensor is still wet');
			else {
				sensor('dry');
				// TODO: verify need of clearInterval
				// clearInterval(refresh);
				console.log('waiting for wetness...');
			}
		}, 1000);
	}
}

// Main Loop
initDeviceState();
console.log('Waiting for wetness');
setInterval(main, 10000);
