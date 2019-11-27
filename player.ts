import { promises as fs } from 'fs'
import * as util from 'util'
import * as child_process from 'child_process'

class Player {}

const mpvOptions = [
    '--audio-device=pulse/alsa_output.usb-Burr-Brown_from_TI_USB_Audio_CODEC-00.analog-stereo',
]

export function play(fileNames: string[], volume: number = 80) {
    return new Promise((resolve, _reject) => {
        const kid = child_process.spawn('mpv', [
            ...mpvOptions,
            `--volume=${volume}`,
            ...fileNames,
        ])
        // kid.stdout.pipe(process.stdout);
        // kid.stderr.pipe(process.stderr);

        kid.stdout.on('data', data => console.log('got stdout:\n', data.toString()))
        kid.stderr.on('data', data => console.log('got stderr:\n', data.toString()))
        kid.on('exit', (_code, _signal) => resolve())
    })
}
