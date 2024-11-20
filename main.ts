import { program } from 'commander';
import util from 'util';
import { IGPSState, openGPS, fakeGPS, GPSEmitterEvents } from './gps';
import { play as realPlay, fakePlayer } from './player';
import { states } from './state';
import { schedule } from './schedule';
import { polarProgram } from './polar-program';
import { setDebugEnable, debugLog } from './debug';
import printf from 'printf';
import blessed from 'blessed';
import TypedEmitter from 'typed-emitter';
import * as dateFns from 'date-fns';

function validateStudio(studio: string) {
    if (studio === 'DDS' || studio === 'AIM') return studio;
    throw new Error(`Unknown studio ${studio}`);
}

function parseTimes(times: string) {
    if (!times) return [];
    const splitTimes = times.split(',');
    for (let time of splitTimes) {
        const parsed = dateFns.parse(time, 'H:m', new Date());
        if (!dateFns.isValid(parsed)) throw new Error(`Invalid time ${time}`);
    }
    return splitTimes;
}

program
    .option('--year [year]', 'Select schedule year')
    .option('--studio [name]', 'Select dance studio (DDS, AIM)', validateStudio)
    .option('--start-times [times]', 'Set manual start times', parseTimes)
    .option('--gps-device [name]', 'Set GPS device', '/dev/ttyUSB0')
    .option('--time-offset [seconds]', 'Set GPS time offset', (x) => parseFloat(x) * 1000)
    .option('--fake-gps [name]', 'Replay GPS from [name]')
    .option('--fake-player', 'Use fake player')
    .option('--speed [speed]', 'Adjust playback/replay speed', parseFloat, 1.0)
    .option('--audio-device [name]', 'Add audio device to mpv calls')
    .option('--debug', 'Debug mode')
    .parse(process.argv);

const options = program.opts();

setDebugEnable(options.debug);

function* getTimespecs() {
    if (options.startTimes) {
        for (let time of options.startTimes) {
            yield { time, studio: validateStudio(options.studio) };
        }
    } else {
        let now = new Date();
        let sched = schedule[options.year || now.getFullYear()];
        for (let day of sched) {
            for (let time of day.times) {
                yield { time: new Date(`${day.date}T${time}`), studio: day.studio };
            }
        }
    }
}

let updateScreen = (output: string[]) => {};

if (!options.debug) {
    const screen = blessed.screen();
    const text = blessed.box({
        width: '100%',
        length: '100%',
        content: '',
    });
    screen.append(text);
    updateScreen = (output: string[]) => {
        text.content = output.join('');
        screen.render();
    };
}

function formatDuration(duration: number) {
    return printf('%02d:%02d', Math.floor(duration / 60), duration % 60);
}

let gpsEmitter: TypedEmitter<GPSEmitterEvents>;
if (options.fakeGps) {
    gpsEmitter = fakeGPS(options.fakeGps, {
        interval: Math.min(10, 100 / options.speed),
        speed: options.speed,
        timeOffset: options.timeOffset,
    });
} else {
    gpsEmitter = openGPS(options.gpsDevice, {
        log: true,
        timeOffset: options.timeOffset,
    });
}

function getState() {
    return new Promise<IGPSState>((resolve, _reject) => {
        gpsEmitter.once('state', resolve);
    });
}

const mpvOptions: string[] = [];
if (options.audioDevice) mpvOptions.push(`--audio-device=${options.audioDevice}`);

let play = options.fakePlayer
    ? fakePlayer(getState)
    : (fileName: string[], volume?: number) =>
          realPlay(fileName, { volume, mpvOptions, speed: options.speed });

gpsEmitter.on('state', (gpsState) => {
    debugLog(gpsState);
    debugLog(states);
    const o: string[] = [];
    function out(fmt: string, ...args: any) {
        o.push(printf(fmt, ...args));
    }
    const mph = gpsState.speed;
    const fps = (mph * 5280) / 3600;
    out('%25s %s\n', 'time', dateFns.format(gpsState.time, 'yyyy-MM-dd HH:mm:ss'));
    out('%25s %10.2f MPH  %10.2f ft/s\n', 'speed', mph, fps);
    out('%25s %10s\n', 'moving', gpsState.moving);
    out('\n');
    for (let [name, distance] of Object.entries(gpsState.triggerDistances)) {
        const timeUntil = distance / fps;
        if (gpsState.moving) {
            out('%25s %10.1f ft  %10.1f s\n', name, distance, timeUntil);
        } else {
            out('%25s %10.1f ft\n', name, distance);
        }
    }
    out('\n');
    for (let state of states) {
        if (state.playing) {
            const idx = state.playlist.indexOf(state.playing);
            out('Playing [%d/%d]: %s\n', idx + 1, state.playlist.length, state.playing);
            const pct = state.position / state.duration;
            out(
                '  (%s / %s / %s)  |%s|\n',
                formatDuration(state.position),
                formatDuration(state.duration),
                formatDuration(state.duration - state.position),
                ''.padEnd(Math.round(pct * 50), '-').padEnd(50),
            );
        } else {
            out('%s\n', util.inspect(formatDates(state)));
        }
        out('\n');
    }
    if (options.debug) {
        debugLog(o);
        debugLog(states);
    }
    updateScreen(o);
});

function formatDates(state: { [k: string]: any }): { [k: string]: any } {
    let out = {} as { [k: string]: any };
    for (let k in state) {
        if (state[k] instanceof Date) {
            out[k] = dateFns.format(state[k], 'yyyy-MM-dd HH:mm:ss');
        } else {
            out[k] = state[k];
        }
    }
    return out;
}

// blah
(async () => {
    try {
        for (let timespec of getTimespecs()) {
            debugLog(timespec);
            await polarProgram(timespec.time, getState, play, timespec.studio);
        }
        states.push({ programFinished: true });
    } catch (e) {
        debugLog('WTF');
        console.error(e);
        process.exit(1);
    }
})();
