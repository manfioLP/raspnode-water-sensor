const GPIO = require('onoff').Gpio;
const awsIot = require('aws-iot-device-sdk')

const testBerryOptions = {
	keyPath: './certs/3be78d97bb-private.pem.key',
	certPath: './certs/3be78d97bb-certificate.pem.crt',
	caPath: './certs/root-CA.pem',
	clientId: 'rasp_policy_test',
	host: 'a276gfbq0dq4uz-ats.iot.us-east-1.amazonaws.com'
}
let clientTokenUpdate;
let prevWet = false;

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
})



device
	.on('connect', () => {
		console.log('connect...');
		device.publish('WaterSensorPolicy', JSON.stringify({message: 'NodeJS server connected...', deviceState}));
		
		thingShadow.register('TestBerry', {}, () => {
			const testBerryState = {"state":{"desired":{"waterSensor": deviceState.waterSensor, "buzzer": deviceState.buzzer, "timestamp": deviceState.timestamp}}};
			
			clientTokenUpdate = thingShadow.update('TestBerry', testBerryState);
			
			if (!clientTokenUpdate) console.log('updating shadow failed...');
		});
		})

device.on('message', (topic, payload) => {
	console.log('message', topic, payload.toString());
});

const wetSensor = new GPIO(18, 'out');

const buzzer = new GPIO(17, 'out');
buzzer.writeSync(0);

// read buzzer state, watersensor and timestamp
const deviceState = {  };
console.log('init device state');
function initDeviceState() {
	deviceState.buzzer = buzzer.readSync() ? 'HIGH' : 'OFF';
	deviceState.waterSensor = wetSensor.readSync() ? 'HIGH' : 'OFF';
	deviceState.timestamp = new Date().getTime();
} initDeviceState();

function updateDeviceState() {
	deviceState.buzzer = buzzer.readSync() ? 'HIGH' : 'OFF';
	deviceState.waterSensor = wetSensor.readSync() ? 'HIGH' : 'OFF';
	deviceState.timestamp = new Date().getTime();
	
	const testBerryState = {"reported":{"desired":{"waterSensor": deviceState.waterSensor, "buzzer": 'DISCONNECTED', "timestamp": deviceState.timestamp}}};		
	clientTokenUpdate = thingShadow.update('TestBerry', testBerryState);
	console.log('UPDATED TOKEN: ', clientTokenUpdate)
}

function sensor(condition) {
	console.log('Attempting to handle sensor');
		if (condition == 'wet') {
			 // do something
			device.publish('WaterSensorHigh', JSON.stringify({message: 'water level rose...', waterSensor: 'HIGH'}));
			console.log('sensor got wet');
			prevWet = true;
			buzzer.writeSync(1);
		}
		if (condition == 'dry') {
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

function checkSensor() {
	const wetReading = wetSensor.readSync();
	if (wetReading) {
		console.log('sensor is still wet');
		clearInterval(checkSensor)
	} else {
		console.log("Sensor is dry again");
		sensor('dry');
		console.log('waiting for wetness...');
		clearInterval(checkSensor)
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
				clearInterval(refresh);
				console.log('waiting for wetness...');
			}
		}, 1000);
	}
}

// Main Loop
console.log('Waiting for wetness');
setInterval(main, 10000)
