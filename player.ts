import * as child_process from 'child_process'
import { withState, withStateAsync } from './state'
import { IGPSState } from './gps'
const sox = require('sox')
import zip from 'lodash/zip'
import moment from 'moment'

interface IPlayerState {
    playlist: string[]
    playing: string
    position: number
    duration: number
}

class Player {
    constructor(public state: IPlayerState, public endPromise: Promise<void>) {}
    async wait() {
        const state = { waitForSongFinish: this.state.playlist.slice(-1)[0] }
        return await withStateAsync(state, async () => await this.endPromise)
    }
}

const mpvOptions: string[] = [
    '--audio-device=pulse/alsa_output.usb-Burr-Brown_from_TI_USB_Audio_CODEC-00.analog-stereo',
]

export function play(fileNames: string[], volume: number = 80) {
    const state: IPlayerState = {
        playlist: fileNames,
        playing: fileNames[0],
        position: 0,
        duration: 0,
    }
    return new Player(
        state,
        withStateAsync(
            state,
            async () =>
                await new Promise<void>((resolve, _reject) => {
                    const kid = child_process.spawn('mpv', [
                        ...mpvOptions,
                        `--volume=${volume}`,
                        ...fileNames,
                    ])
                    // kid.stdout.pipe(process.stdout);
                    // kid.stderr.pipe(process.stderr);

                    kid.stdout.on('data', (data: Buffer) => {
                        const m = data.toString().match(/Playing: (.*)/)
                        if (m) {
                            state.playing = m[1]
                        }
                        // console.log('got stdout:\n', data.toString())
                    })
                    kid.stderr.on('data', (data: Buffer) => {
                        const m = data
                            .toString()
                            .match(/A: (\d+:\d+:\d+) \/ (\d+:\d+:\d+)/)
                        if (m) {
                            state.position = moment.duration(m[1]).asSeconds()
                            state.duration = moment.duration(m[2]).asSeconds()
                        }
                        // console.log('got stderr:\n', data.toString())
                    })
                    kid.on('exit', (_code, _signal) => resolve())
                }),
        ),
    )
}

async function identify(fileName: string) {
    return new Promise((resolve, reject) => {
        sox.identify(fileName, (err: any, results: any) => {
            if (err) reject(err)
            resolve(results)
        })
    })
}

export function fakePlayer(getState: () => Promise<IGPSState>) {
    function play(fileNames: string[], _volume: number = 80) {
        const pstate: IPlayerState = {
            playlist: fileNames,
            playing: fileNames[0],
            position: 0,
            duration: 0,
        }
        return new Player(
            pstate,
            withStateAsync(pstate, async () => {
                const infos: any[] = await Promise.all(fileNames.map(identify))
                let state = await getState()
                for (let [fileName, info] of zip(fileNames, infos)) {
                    const start = moment(state.time)
                    const finish = start.clone().add(info.duration * 1000)
                    pstate.playing = fileName!
                    pstate.duration = info.duration
                    // console.log(
                    //     `${fileName} start ${moment(
                    //         state.time,
                    //     ).format()} finish ${finish.format()}`,
                    // )
                    let now = moment(state.time)
                    while (now.isBefore(finish)) {
                        pstate.position = now.diff(start) / 1000
                        // console.log(
                        //     `${fileName} now ${moment(
                        //         state.time,
                        //     ).format()} finish ${finish.format()}`,
                        // )
                        state = await getState()
                        now = moment(state.time)
                    }
                    // console.log(`${fileName} finish ${finish.format()}`)
                }
            }),
        )
    }

    return play
}
