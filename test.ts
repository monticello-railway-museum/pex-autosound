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

import { IGPSState, openGPS, fakeGPS } from './gps'
import { play } from './player'
import moment from 'moment'
import zip from 'lodash/zip'
const sox = require('sox')

const e = openGPS('/dev/ttyUSB0')
// const e = fakeGPS(process.argv[2], {interval: 1})
e.on('state', state => {
    console.log(state)
})

// interface IAppState {
//     gpsState: IGPSState | null
//     tasks: object[]
// }

// const appState: IAppState = { gpsState: null, tasks: [] }

async function identify(fileName: string) {
    return new Promise((resolve, reject) => {
        sox.identify(fileName, (err: any, results: any) => {
            if (err) reject(err)
            resolve(results)
        })
    })
}

// async function play(fileNames: string[]) {
//     const infos: any[] = await Promise.all(fileNames.map(identify))
//     let state = await getState()
//     for (let [fileName, info] of zip(fileNames, infos)) {
//         const finish = moment(state.time).add(info.duration * 1000)
//         console.log(
//             `${fileName} start ${moment(state.time).format()} finish ${finish.format()}`,
//         )
//         while (moment(state.time).isBefore(finish)) {
//             console.log(`${fileName} now ${moment(state.time).format()} finish ${finish.format()}`)
//             state = await getState()
//         }
//         console.log(`${fileName} finish ${finish.format()}`)
//     }
//     return state
// }

function getState() {
    return new Promise<IGPSState>((resolve, _reject) => {
        e.once('state', resolve)
    })
}

async function waitForMoving(moving: boolean) {
    while (true) {
        const state = await getState()
        if (state.moving == moving) return state
    }
}

async function waitForTrigger(trigger: string) {
    while (true) {
        const state = await getState()
        if (state.triggerDistances[trigger] <= 0) return state
    }
}

async function waitForTime(time: string) {
    let state = await getState()
    let now = moment(state.time)
    let today = now.format('YYYY-MM-DD')
    let target = moment(`${today} ${time}`)
    while (now.isBefore(target)) {
        state = await getState()
        now = moment(state.time)
    }
    return state
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
    console.log(state)
    let start = moment(state.time)
    let startTime = start.format('HH:mm:ss')
    let times = allTimes['17:00:00']
    if (startTime > '17:00:00') times = allTimes['18:30:00']
    if (startTime > '18:30:00') times = allTimes['20:00:00']
    if (startTime > '20:00:00') throw new Error('done!')

    for (let [eventTime, event] of Object.entries(times)) {
        console.log(startTime, [eventTime, event])
        if (startTime > eventTime) continue
        await waitForTime(eventTime)
        if (event === 'start') break
        play([event])
    }

    console.log('time', state)

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

    console.log(await waitForTrigger('wolvesTriggerFrontCars'))
    play(['music/a07Fa - Hungry wolves.wav', 'music/a07Fb - Glacier Gulch.wav'], 100)
    console.log(await waitForTrigger('wolvesTriggerRearCars'))
    play(['music/a07Ra - Hungry wolves.wav', 'music/a07Rb - Glacier Gulch.wav'], 100)

    await playing

    console.log(await waitForTrigger('santaMusicStart'))

    playing = play(['music/c08 - Santa Claus is Coming to Town.wav'])

    console.log(await waitForTrigger('npTriggerFrontCars'))
    play(['music/a08Fa - As we round the bend (North Pole).wav'], 100)
    console.log(await waitForTrigger('santaTriggerFrontCars'))
    play(['music/a08Fb - The elves are out this evening.wav'], 100)
    console.log(await waitForTrigger('npTriggerRearCars'))
    play(['music/a08Ra - As we round the bend (North Pole).wav'], 100)
    console.log(await waitForTrigger('santaTriggerRearCars'))
    play(['music/a08Rb - The elves are out this evening.wav'], 100)

    await playing

    console.log(await waitForMoving(false))
    await play(['music/c08a - Brief station stop.wav'])
    console.log(await waitForMoving(true))
    console.log(await waitForTrigger('npMusicStart'))
    await play([
        'music/c09 - Believe (1).wav',
        'music/c10 - We Wish You a Merry Christmas (1).wav',
    ])
    console.log(await waitForMoving(false))
    await play(['music/c10a - Thousands of caribou.wav'])
    console.log(await waitForMoving(true))
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
    ])
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
