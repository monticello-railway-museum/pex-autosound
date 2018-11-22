const GPS = require('gps');
const gps = new GPS;

const fs = require('fs');
const stream = fs.createReadStream('/dev/ttyUSB0');

const readline = require('readline');

const rl = readline.createInterface({
    input: stream,
});

rl.on('line', (line) => {
    // console.log(line);
    gps.update(line);
});

const triggerLats = {
    wolfTriggerFrontCars: 40.043450,
    wolfTriggerRearCars: 40.044468,
    npTriggerFrontCars: 40.054284,
    santaTriggerFrontCars: 40.055037,
    npTriggerRearCars: 40.055120,
    santaTriggerRearCars: 40.055821,
    npMusicStart: 40.056652,
};

const lat370ft = Math.abs(triggerLats.wolfTriggerRearCars - triggerLats.wolfTriggerFrontCars);

const pad = 25;

const { stdout } = process;

gps.on('data', (parsed) => {
    if (parsed.type === 'VTG') {
        // for (let i = 0; i < 20; ++i) {
        //     console.log('');
        // }
        stdout.write('\x1b[2J\x1b[H');
        // console.log(parsed);
        const { state } = gps;
        console.log(state);
        console.log('');
        console.log('time'.padEnd(pad), new Date(state.time).toLocaleTimeString());
        console.log('speed'.padEnd(pad), (state.speed * 0.6214).toFixed(1).toString().padStart(10));
        if (gps.state.lat) {
            for (let prop in triggerLats) {
                triggerLat = triggerLats[prop];
                const fakeFeet = (triggerLat - gps.state.lat) / lat370ft * 370;
                console.log(prop.padEnd(pad), fakeFeet.toFixed(1).toString().padStart(10));
            }
        }
    }
});

// GPS = 442ft from front of engine
//     = 352ft from front of RI (442 - 50 - 40)
//     = 326ft from end of train

// wolf lead time at 12mph = 8 seconds = 140 ft

// wolf trigger point = 140 + 442 - 90 = 492 ft

// 370 ft = 21 seconds @ 12 mph
