import GPS from 'gps';
import fs from 'fs';
import readline from 'readline';
import * as turf from '@turf/turf';
import EventEmitter from 'events';
import mapValues from 'lodash/mapValues';
import TypedEmitter from 'typed-emitter';
import Denque from 'denque';
import * as dateFns from 'date-fns';
import { debugLog } from './debug';

const polarPathCollection = JSON.parse(
    fs.readFileSync('pex-path.json', { encoding: 'utf-8' }),
);
const polarPath = polarPathCollection.features[0];

const frontTrainOffset = 442;
const frontCarsOffset = 352;
const rearCarsOffset = -30;
const rearTrainOffset = -326;
const feetPerMeter = ((1 / 2.54) * 100) / 12;

const wolfDelay = 160;

const triggerLocs: { [x: string]: [[number, number], number] } = {
    stationStop: [[-88.570424, 40.026757], -5.5],
    wolves: [[-88.562763, 40.044799], 0],
    ironHorsePlace: [[-88.559919, 40.05421], 0],
    northPoleAnnouncement: [[-88.559084, 40.055055], 0],
    santaAnnouncement: [[-88.558263, 40.055765], 0],
    northPoleStop: [[-88.557219, 40.056607], 0],
};

const triggerDistances: { [x: string]: number } = {};

for (let locKey in triggerLocs) {
    let [loc, offset] = triggerLocs[locKey];
    const snapped = turf.nearestPointOnLine(polarPath, turf.point(loc), {
        units: 'meters',
    });
    triggerDistances[locKey] = snapped.properties.location! * feetPerMeter + offset;
}

const triggers: { [x: string]: [number, number] } = {
    stationStop: [triggerDistances.stationStop, 0],
    wolvesTriggerFrontCars: [triggerDistances.wolves, wolfDelay + frontCarsOffset],
    wolvesTriggerRearCars: [triggerDistances.wolves, wolfDelay + rearCarsOffset],
    santaMusicStart: [triggerDistances.ironHorsePlace, frontTrainOffset + 350],
    npTriggerFrontCars: [triggerDistances.northPoleAnnouncement, frontCarsOffset],
    santaTriggerFrontCars: [triggerDistances.santaAnnouncement, frontCarsOffset],
    npTriggerRearCars: [triggerDistances.northPoleAnnouncement, rearCarsOffset],
    santaTriggerRearCars: [triggerDistances.santaAnnouncement, rearCarsOffset],
    npStop: [triggerDistances.northPoleStop, 0],
    npMusicStart: [triggerDistances.northPoleStop, -15],
};

const pad = 25;

// 1mi  5280ft 1hr
// hr   1mi    3600s

interface IOptions {
    log?: boolean;
    timeOffset?: number;
}

export interface IGPSState {
    time: Date;
    speed: number;
    moving: boolean;
    triggerDistances: { [x: string]: number };
}

export interface GPSEmitterEvents {
    state: (state: IGPSState) => void;
}

export function openGPS(fileName: string, options: IOptions = {}) {
    return openGPSStream(fs.createReadStream(fileName), options);
}

export function openGPSStream(stream: fs.ReadStream, options: IOptions = {}) {
    const gps = new GPS();
    const log = fs.openSync(
        options.log ? `gps-${new Date().toISOString()}.log` : '/dev/null',
        'w',
    );
    const rl = readline.createInterface(stream);
    rl.on('line', (line) => {
        debugLog('line', line);
        if (line) fs.writeSync(log, `${line}\n`);
        try {
            gps.update(line);
        } catch (e) {
            debugLog('fuck', e);
            /* KLUDGE but barfing here does no one any good */
        }
    });

    let time: Date | undefined = undefined;
    let avgSpeedSamples: number[] = [];
    function avgSpeed(speed: number) {
        if (avgSpeedSamples.length >= 10) avgSpeedSamples = avgSpeedSamples.slice(1);
        avgSpeedSamples.push(speed);
        let sum = 0;
        for (let spd of avgSpeedSamples) sum += spd;
        return sum / avgSpeedSamples.length;
    }

    let moving = false;

    const emitter = new EventEmitter() as TypedEmitter<GPSEmitterEvents>;

    gps.on('data', (parsed) => {
        debugLog('parsed', parsed);
        if (parsed.type === 'RMC' && parsed.status === 'active') {
            const { state } = gps;
            time = state.time;
            while (time && time.getFullYear() < 2015) {
                const week = 7 * 24 * 60 * 60 * 1000;
                time = new Date(time.getTime() + 1024 * week);
            }
            if (time && options.timeOffset != null) {
                time = new Date(time.getTime() + options.timeOffset);
            }
            if (
                state.speed == null ||
                state.time == null ||
                state.alt == null ||
                state.lat == null ||
                state.lon == null ||
                time == null
            )
                return;
            const speed = avgSpeed(state.speed) * 0.6214;
            if (speed > 1.0) moving = true;
            if (speed < 0.5) moving = false;

            const point = turf.point([state.lon, state.lat]);
            const snapped = turf.nearestPointOnLine(polarPath, point, {
                units: 'meters',
            });
            const curDistance = snapped.properties.location! * feetPerMeter;

            const triggerDistances = mapValues(
                triggers,
                ([distance, offset]) => distance - offset - curDistance,
            );

            emitter.emit('state', {
                time,
                speed,
                moving,
                triggerDistances,
            });
        }
    });

    return emitter;
}

interface IFakeGPSOptions {
    speed?: number;
    interval?: number;
    timeOffset?: number;
}

export function fakeGPS(fileName: string, options: IFakeGPSOptions = {}) {
    const speed = options.speed ?? 1.0;

    let firstStateTime: Date | undefined;
    let firstNowTime: Date | undefined;

    const stream = fs.createReadStream(fileName);
    const rawEmitter = openGPSStream(stream, { ...options, log: false });

    const emitter = new EventEmitter() as TypedEmitter<GPSEmitterEvents>;

    const states = new Denque<IGPSState>();
    rawEmitter.on('state', (state) => {
        states.push(state);
        if (states.length > 10) stream.pause();
    });

    setInterval(() => {
        const now = new Date();
        const state = states.peekFront();
        if (state) {
            if (!firstStateTime || !firstNowTime) {
                firstStateTime = state.time;
                firstNowTime = now;
            }
            const stateDelta = state.time.getTime() - firstStateTime.getTime();
            const nowDelta = now.getTime() - firstNowTime.getTime();
            const diff = stateDelta - nowDelta * speed;
            if (diff > 100000) {
                // handle time jumps
                firstStateTime = new Date(state.time.getTime() - nowDelta * speed);
            }
            debugLog({
                stateDelta,
                nowDelta_x_Speed: nowDelta * speed,
                diff: stateDelta - nowDelta * speed,
            });
            if (stateDelta <= nowDelta * speed) {
                emitter.emit('state', state);
                states.shift();
            }
        }
        if (states.length <= 10) stream.resume();
    }, options.interval || 10);

    return emitter;
}

// GPS = 442ft from front of engine
//     = 352ft from front of RI (442 - 50 - 40)
//     = 326ft from end of train

// wolf lead time at 12mph = 8 seconds = 140 ft

// wolf trigger point = 140 + 442 - 90 = 492 ft

// 370 ft = 21 seconds @ 12 mph

// const triggerLats = {
//     wolfTriggerFrontCars: 40.043450,
//     wolfTriggerRearCars: 40.044468,
//     npTriggerFrontCars: 40.054284,
//     santaTriggerFrontCars: 40.055037,
//     npTriggerRearCars: 40.055120,
//     santaTriggerRearCars: 40.055821,
//     npMusicStart: 40.056652,
// };

// const lat370ft = Math.abs(triggerLats.wolfTriggerRearCars - triggerLats.wolfTriggerFrontCars);

//             for (let prop in triggerLats) {
//                 triggerLat = triggerLats[prop];
//                 const fakeFeet = (triggerLat - gps.state.lat) / lat370ft * 370;
//                 debugLog(prop.padEnd(pad), fakeFeet.toFixed(1).toString().padStart(10));
//             }

//             debugLog('');
