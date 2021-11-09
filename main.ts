import { program } from 'commander'
import util from 'util'
import { IGPSState, openGPS, fakeGPS, GPSEmitterEvents } from './gps'
import { play as realPlay, fakePlayer } from './player'
import { states } from './state'
import { polarProgram } from './polar-program'
import printf from 'printf'
import blessed from 'blessed'
import TypedEmitter from 'typed-emitter'

function validateStudio(studio: string) {
    if (studio === 'DDS' || studio === 'AIM') return studio
    throw new Error(`Unknown studio ${studio}`)
}

program
    .requiredOption('--studio [name]', 'Select dance studio (DDS, AIM)', validateStudio)
    .option('--gps-device [name]', 'Set GPS device', '/dev/ttyUSB0')
    .option('--fake-gps [name]', 'Replay GPS from [name]')
    .option('--fake-player', 'Use fake player')
    .option('--speed [speed]', 'Adjust playback/replay speed', parseFloat, 1.0)
    .option('--audio-device', 'Add audio device to mpv calls')
    .parse(process.argv)

const options = program.opts()

const screen = blessed.screen()

const text = blessed.box({
    width: '100%',
    length: '100%',
    content: '',
})

screen.append(text)

function formatDuration(duration: number) {
    return printf('%02d:%02d', Math.floor(duration / 60), duration % 60)
}

let gpsEmitter: TypedEmitter<GPSEmitterEvents>
if (options.fakeGps) {
    gpsEmitter = fakeGPS(options.fakeGps, {
        interval: Math.min(10, 100 / options.speed),
        speed: options.speed,
    })
} else {
    gpsEmitter = openGPS(options.gpsDevice, { log: true })
}

function getState() {
    return new Promise<IGPSState>((resolve, _reject) => {
        gpsEmitter.once('state', resolve)
    })
}

const mpvOptions: string[] = []
if (options.audioDevice) mpvOptions.push(`--audio-device=${options.audioDevice}`)

let play = options.fakePlayer
    ? fakePlayer(getState)
    : (fileName: string[], volume?: number) => realPlay(fileName, { volume, mpvOptions, speed: options.speed })

gpsEmitter.on('state', (gpsState) => {
    const o: string[] = []
    function out(fmt: string, ...args: any) {
        o.push(printf(fmt, ...args))
    }
    const mph = gpsState.speed
    const fps = (mph * 5280) / 3600
    out('%25s %s\n', 'time', gpsState.time.toLocaleTimeString())
    out('%25s %10.2f MPH  %10.2f ft/s\n', 'speed', mph, fps)
    out('%25s %10s\n', 'moving', gpsState.moving)
    out('\n')
    for (let [name, distance] of Object.entries(gpsState.triggerDistances)) {
        const timeUntil = distance / fps
        if (gpsState.moving) {
            out('%25s %10.1f ft  %10.1f s\n', name, distance, timeUntil)
        } else {
            out('%25s %10.1f ft\n', name, distance)
        }
    }
    out('\n')
    for (let state of states) {
        if (state.playing) {
            const idx = state.playlist.indexOf(state.playing)
            out('Playing [%d/%d]: %s\n', idx + 1, state.playlist.length, state.playing)
            const pct = state.position / state.duration
            out(
                '  (%s / %s / %s)  |%s|\n',
                formatDuration(state.position),
                formatDuration(state.duration),
                formatDuration(state.duration - state.position),
                ''.padEnd(Math.round(pct * 50), '-').padEnd(50),
            )
        } else {
            out('%s', util.inspect(state))
        }
        out('\n')
    }
    text.content = o.join('')
    screen.render()
})
;(async () => {
    try {
        while (true) await polarProgram(getState, play, options.studio)
    } catch (e) {
        console.error(e)
        process.exit(1)
    }
})()
