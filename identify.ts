import * as child_process from 'child_process'
import { promisify } from 'util'
const execFile = promisify(child_process.execFile)

interface ISoxInfo {
    duration: number
}

export async function identify(fileName: string): Promise<ISoxInfo> {
    const duration = await execFile('sox', ['--info', '-D', fileName])
    return { duration: parseFloat(duration.stdout) }
}
