// import { promises as fs } from 'fs'
// import * as util from 'util'
// import * as child_process from 'child_process'

// const kid = child_process.spawn('mpv', [
//     'music/c11 - Rudolph the Red-Nosed Reindeer.wav',
//     'music/c12 - Frosty the Snowman.wav',
// ])
// // kid.stdout.pipe(process.stdout);
// // kid.stderr.pipe(process.stderr);

// kid.stdout.on('data', data => console.log('got stdout:\n', data.toString()))
// kid.stderr.on('data', data => console.log('got stderr:\n', data.toString()))
// kid.on('exit', (code, signal) => console.log('got exit:\n', code, signal))

// setTimeout(() => kid.kill(), 3000)

// {
//   duration: 210.066667,
//   sampleCount: 9263940,
//   channelCount: 2,
//   sampleRate: 44100,
//   format: 'wav',
//   bitRate: 1
// }

import util from 'util'
import { IGPSState, openGPS, fakeGPS } from './gps'
import { play as realPlay, fakePlayer } from './player'
import moment from 'moment'
import { states, withStateAsync } from './state'
import printf from 'printf'
import blessed from 'blessed'
const screen = blessed.screen()

const text = blessed.box({
    width: '100%',
    length: '100%',
    content: ''
})

screen.append(text)

function formatDuration(duration: number) {
    return printf('%02d:%02d', Math.floor(duration / 60), duration % 60)
}

// const e = openGPS('/dev/ttyUSB0')
const e = fakeGPS(process.argv[2], { interval: 1 })
const { stdout } = process
e.on('state', gpsState => {
    const o: string[] = []
    function out(fmt: string, ...args: any) {
        o.push(printf(fmt, ...args))
    }
    const mph = gpsState.speed
    const fps = (mph * 5280) / 3600
    out('%25s %s\n', 'time', gpsState.time.toLocaleTimeString())
    out('%25s %10.2f %10.2f\n', 'speed', mph, fps)
    out('%25s %10s\n', 'moving', gpsState.moving)
    out('\n')
    for (let [name, distance] of Object.entries(gpsState.triggerDistances)) {
        const timeUntil = distance / fps
        if (gpsState.moving) {
            out('%25s %10.1f %10.1f\n', name, distance, timeUntil)
        } else {
            out('%25s %10.1f\n', name, distance)
        }
    }
    out('\n')
    for (let state of states) {
        if (state.playing) {
            const idx = state.playlist.indexOf(state.playing)
            out(
                'Playing [%d/%d]: %s\n',
                idx + 1,
                state.playlist.length,
                state.playing,
            )
            const pct = state.position / state.duration
            out(
                '  (%s / %s / %s)  |%s|\n',
                formatDuration(state.position),
                formatDuration(state.duration),
                formatDuration(state.duration - state.position),
                ''.padEnd(Math.round(pct * 50), '-').padEnd(50),
            )
        } else {
            out("%s", util.inspect(state))
        }
        out('\n')
    }
    text.content = o.join('')
    screen.render()
})

const play = fakePlayer(getState)
// const play = realPlay

function getState() {
    return new Promise<IGPSState>((resolve, _reject) => {
        e.once('state', resolve)
    })
}

async function waitForMoving(moving: boolean) {
    return await withStateAsync({ waitForMoving: moving }, async () => {
        while (true) {
            const state = await getState()
            if (state.moving == moving) return state
        }
    })
}

async function waitForTrigger(trigger: string) {
    return await withStateAsync({ waitForTrigger: trigger }, async () => {
        while (true) {
            const state = await getState()
            if (state.triggerDistances[trigger] <= 0) return state
        }
    })
}

async function waitForTime(time: string) {
    return await withStateAsync({ waitForTime: time }, async () => {
        let state = await getState()
        let now = moment(state.time)
        let today = now.format('YYYY-MM-DD')
        let target = moment(`${today} ${time}`)
        while (now.isBefore(target)) {
            state = await getState()
            now = moment(state.time)
        }
        return state
    })
}

async function sleep(msec: number) {
    return new Promise((resolve, _reject) => {
        setTimeout(resolve, msec)
    })
}

const allTimes: { [x: string]: { [x: string]: string } } = {
    '17:00:00': {
        '16:29:00': 'music/b29 - 29,59 (20m) boarding countdown.wav',
        '16:34:00': 'music/b34 - 34,04 (15m) boarding countdown.wav',
        '16:39:00': 'music/b39 - 39,09 (10m) boarding countdown.wav',
        '16:44:00': 'music/b44 - 44,14 (5m) boarding countdown.wav',
        '16:46:00': 'music/b46 - 46,16 (3m) boarding countdown.wav',
        '16:47:00': 'music/b47 - 47,17 (2m) boarding countdown.wav',
        '16:48:00': 'music/b48 - 48,18 (1m) boarding countdown.wav',
        '16:49:00': 'start',
    },
    '18:30:00': {
        '17:59:00': 'music/b29 - 29,59 (20m) boarding countdown.wav',
        '18:04:00': 'music/b34 - 34,04 (15m) boarding countdown.wav',
        '18:09:00': 'music/b39 - 39,09 (10m) boarding countdown.wav',
        '18:14:00': 'music/b44 - 44,14 (5m) boarding countdown.wav',
        '18:16:00': 'music/b46 - 46,16 (3m) boarding countdown.wav',
        '18:17:00': 'music/b47 - 47,17 (2m) boarding countdown.wav',
        '18:18:00': 'music/b48 - 48,18 (1m) boarding countdown.wav',
        '18:19:00': 'start',
    },
    '20:00:00': {
        '19:29:00': 'music/b29 - 29,59 (20m) boarding countdown.wav',
        '19:34:00': 'music/b34 - 34,04 (15m) boarding countdown.wav',
        '19:39:00': 'music/b39 - 39,09 (10m) boarding countdown.wav',
        '19:44:00': 'music/b44 - 44,14 (5m) boarding countdown.wav',
        '19:46:00': 'music/b46 - 46,16 (3m) boarding countdown.wav',
        '19:47:00': 'music/b47 - 47,17 (2m) boarding countdown.wav',
        '19:48:00': 'music/b48 - 48,18 (1m) boarding countdown.wav',
        '19:49:00': 'start',
    },
}

async function program() {
    let state = await getState()
    let start = moment(state.time)
    let startTime = start.format('HH:mm:ss')
    let times = allTimes['17:00:00']
    if (startTime > '17:00:00') times = allTimes['18:30:00']
    if (startTime > '18:30:00') times = allTimes['20:00:00']
    if (startTime > '20:00:00') throw new Error('done!')

    for (let [eventTime, event] of Object.entries(times)) {
        if (startTime > eventTime) continue
        await waitForTime(eventTime)
        if (event === 'start') break
        play([event])
    }

    let playing = play([
        'music/c01 - When Christmas Comes to Town.wav',
        'music/c02 - Spirit of the Season.wav',
        'music/c03 - Seeing is Believing.wav',
        'music/c04 - The Polar Express.wav',
        'music/c04a - Good evening and welcome aboard.wav',
        'music/c05 - Hot Chocolate (1).wav',
        'music/c05a - I dont think everybody has had hot chocolate yet.wav',
        'music/c05b - 5s pause.wav',
        'music/c06 - Hot Chocolate (2).wav',
        'music/c06a - And now lets hear the story of the Polar Express.wav',
        'music/c07 - (Book Reading Short).wav',
    ])

    await waitForTrigger('wolvesTriggerFrontCars')
    play(['music/a07Fa - Hungry wolves.wav', 'music/a07Fb - Glacier Gulch.wav'], 100)
    await waitForTrigger('wolvesTriggerRearCars')
    play(['music/a07Ra - Hungry wolves.wav', 'music/a07Rb - Glacier Gulch.wav'], 100)

    await playing.wait()

    await waitForTrigger('santaMusicStart')

    playing = play(['music/c08 - Santa Claus is Coming to Town.wav'])

    await waitForTrigger('npTriggerFrontCars')
    play(['music/a08Fa - As we round the bend (North Pole).wav'], 100)
    await waitForTrigger('santaTriggerFrontCars')
    play(['music/a08Fb - The elves are out this evening.wav'], 100)
    await waitForTrigger('npTriggerRearCars')
    play(['music/a08Ra - As we round the bend (North Pole).wav'], 100)
    await waitForTrigger('santaTriggerRearCars')
    play(['music/a08Rb - The elves are out this evening.wav'], 100)

    await playing.wait()

    await waitForMoving(false)
    await play(['music/c08a - Brief station stop.wav']).wait()
    await waitForMoving(true)
    await waitForTrigger('npMusicStart')
    await play([
        'music/c09 - Believe (1).wav',
        'music/c10 - We Wish You a Merry Christmas (1).wav',
    ]).wait()
    await waitForMoving(false)
    await play(['music/c10a - Thousands of caribou.wav']).wait()
    await waitForMoving(true)
    await play([
        'music/c11 - Rudolph the Red-Nosed Reindeer.wav',
        'music/c12 - Frosty the Snowman.wav',
        'music/c13 - Believe (2).wav',
        'music/c14 - We Wish You a Merry Christmas (2).wav',
        'music/c14a - Please join us in singing.wav',
        'music/c15 - Twelve Days of Christmas.wav',
        'music/c16 - Holly Jolly Christmas.wav',
        'music/c16a - And now for our final number.wav',
        "music/c17 - Rockin' Around the Christmas Tree.wav",
        'music/c17a - (AIM) Closing comments.wav',
        'music/c18 - Suite from The Polar Express.wav',
    ]).wait()
}

;(async () => {
    while (true) await program()
})()

// ;[
//     'music/a07Fa - Hungry wolves.wav',
//     'music/a07Fb - Glacier Gulch.wav',
//     'music/a07Ra - Hungry wolves.wav',
//     'music/a07Rb - Glacier Gulch.wav',
//     'music/a07a - Hungry wolves.wav',
//     'music/a07b - Glacier Gulch.wav',
//     'music/a08Fa - As we round the bend (North Pole).wav',
//     'music/a08Fb - The elves are out this evening.wav',
//     'music/a08Ra - As we round the bend (North Pole).wav',
//     'music/a08Rb - The elves are out this evening.wav',
//     'music/c01 - When Christmas Comes to Town.wav',
//     'music/c02 - Spirit of the Season.wav',
//     'music/c03 - Seeing is Believing.wav',
//     'music/c04 - The Polar Express.wav',
//     'music/c04a - Good evening and welcome aboard.wav',
//     'music/c05 - Hot Chocolate (1).wav',
//     'music/c05a - I dont think everybody has had hot chocolate yet.wav',
//     'music/c05b - 5s pause.wav',
//     'music/c06 - Hot Chocolate (2).wav',
//     'music/c06a - And now lets hear the story of the Polar Express.wav',
//     'music/c07 - (Book Reading).wav',
//     'music/c08 - Santa Claus is Coming to Town.wav',
//     'music/c08a - Brief station stop.wav',
//     'music/c09 - Believe (1).wav',
//     'music/c10 - We Wish You a Merry Christmas (1).wav',
//     'music/c10a - Thousands of caribou.wav',
//     'music/c11 - Rudolph the Red-Nosed Reindeer.wav',
//     'music/c12 - Frosty the Snowman.wav',
//     'music/c13 - Believe (2).wav',
//     'music/c14 - We Wish You a Merry Christmas (2).wav',
//     'music/c14a - Please join us in singing.wav',
//     'music/c15 - Twelve Days of Christmas.wav',
//     'music/c16 - Holly Jolly Christmas.wav',
//     'music/c16a - And now for our final number.wav',
//     "music/c17 - Rockin' Around the Christmas Tree.wav",
//     'music/c17a - (AIM) Closing comments.wav',
//     'music/c18 - Suite from The Polar Express.wav',
// ]
