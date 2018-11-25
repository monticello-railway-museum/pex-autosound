const GPS = require('gps');
const gps = new GPS;

const fs = require('fs');
const stream = fs.createReadStream('/dev/ttyUSB0');

const readline = require('readline');

const turf = require('@turf/turf');

const polarPathCollection = JSON.parse(fs.readFileSync('pex-path.json'));
const polarPath = polarPathCollection.features[0];

const rl = readline.createInterface({
    input: stream,
});

rl.on('line', (line) => {
    // console.log(line);
    gps.update(line);
});

const frontCarsOffset = 352;
const rearCarsOffset = -30;

const triggerLocs = {
    stationStop: [ [ -88.570424, 40.026757 ], -5.5 ],
    wolvesAnnouncement: [ [ -88.562763, 40.044799 ], 0 ],
    ironHorsePlace: [ [ -88.559919, 40.054210 ], 0 ],
    northPoleAnnouncement: [ [ -88.559084, 40.055055 ], 0 ],
    santaAnnouncement: [ [ -88.558263, 40.055765 ], 0 ],
    northPoleStop: [ [ -88.557219, 40.056607 ], 0 ],
};

const triggerDistances = { };

for (let locKey in triggerLocs) {
    let [ loc, offset ] = triggerLocs[locKey];
    const snapped = turf.nearestPointOnLine(polarPath, turf.point(loc), { units: 'feet' });
    triggerDistances[locKey] = snapped.properties.location + offset;
}

const triggers = {
    stationStop: [ triggerDistances.stationStop, 0 ],
    wolvesTriggerFrontCars: [ triggerDistances.wolvesAnnouncement, frontCarsOffset ],
    wolvesTriggerRearCars: [ triggerDistances.wolvesAnnouncement, rearCarsOffset ],
    santaMusicStart: [ triggerDistances.ironHorsePlace, 350 ],
    npTriggerFrontCars: [ triggerDistances.northPoleAnnouncement, frontCarsOffset ],
    santaTriggerFrontCars: [ triggerDistances.santaAnnouncement, frontCarsOffset ],
    npTriggerRearCars: [ triggerDistances.northPoleAnnouncement, rearCarsOffset ],
    santaTriggerRearCars: [ triggerDistances.santaAnnouncement, rearCarsOffset ],
    npStop: [ triggerDistances.northPoleStop, 0 ],
    npMusicStart: [ triggerDistances.northPoleStop, -30 ],
};

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

// 1mi  5280ft 1hr
// hr   1mi    3600s


let avgSpeedSamples = [];
function avgSpeed(speed) {
    if (avgSpeedSamples.length >= 10) {
        avgSpeedSamples = avgSpeedSamples.slice(1);
    }
    avgSpeedSamples.push(speed);
    let sum = 0;
    for (let spd of avgSpeedSamples)
        sum += spd;
    return sum / avgSpeedSamples.length;
}

const { stdout } = process;

gps.on('data', (parsed) => {
    if (parsed.type === 'VTG') {
        // for (let i = 0; i < 20; ++i) {
        //     console.log('');
        // }
        stdout.write('\x1b[2J\x1b[H');
        // console.log(parsed);
        const { state } = gps;
        const mph = avgSpeed(state.speed * 0.6214);
        const ftPerSec = mph * 5280 / 3600;
        // console.log(state);
        // console.log('');
        console.log('time'.padEnd(pad), new Date(state.time).toLocaleTimeString());
        console.log('speed'.padEnd(pad),
                    mph.toFixed(2).toString().padStart(10),
                    ftPerSec.toFixed(2).toString().padStart(10));
        console.log('');
        if (gps.state.lat) {
            for (let prop in triggerLats) {
                triggerLat = triggerLats[prop];
                const fakeFeet = (triggerLat - gps.state.lat) / lat370ft * 370;
                console.log(prop.padEnd(pad), fakeFeet.toFixed(1).toString().padStart(10));
            }

            console.log('');

            const point = turf.point([gps.state.lon, gps.state.lat]);
            const snapped = turf.nearestPointOnLine(polarPath, point, { units: 'feet' });
            const curDistance = snapped.properties.location;

            for (let name in triggers) {
                const [ distance, offset ] = triggers[name];
                const diff = distance - offset - curDistance;
                const timeTill = diff / ftPerSec;
                if (mph > 0.5) {
                    console.log(name.padEnd(pad),
                                diff.toFixed(1).toString().padStart(10),
                                timeTill.toFixed(1).toString().padStart(10));
                } else {
                    console.log(name.padEnd(pad),
                                diff.toFixed(1).toString().padStart(10));
                }
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
