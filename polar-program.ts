import { IGPSState } from './gps';
import { withStateAsync } from './state';
import { Player } from './player';
import { debugLog } from './debug';
import * as dateFns from 'date-fns';

async function waitFor(
    getState: () => Promise<IGPSState>,
    name: keyof IGPSState,
    value: boolean,
) {
    return await withStateAsync({ waitFor: [name, value] }, async () => {
        while (true) {
            const state = await getState();
            if (state[name] == value) return state;
        }
    });
}

async function waitForTrigger(getState: () => Promise<IGPSState>, trigger: string) {
    return await withStateAsync({ waitForTrigger: trigger }, async () => {
        while (true) {
            const state = await getState();
            if (state.triggerDistances[trigger] <= 0) return state;
        }
    });
}

async function waitForTime(getState: () => Promise<IGPSState>, target: Date) {
    debugLog('waitForTime', target);
    return await withStateAsync({ waitForTime: target }, async () => {
        let state = await getState();
        while (dateFns.isBefore(state.time, target)) {
            state = await getState();
        }
        return state;
    });
}

const boardingAnnouncements: [number, string][] = [
    [20, 'music/b29 - 29,59 (20m) boarding countdown.wav'],
    [15, 'music/b34 - 34,04 (15m) boarding countdown.wav'],
    [10, 'music/b39 - 39,09 (10m) boarding countdown.wav'],
    [5, 'music/b44 - 44,14 (5m) boarding countdown.wav'],
    [3, 'music/b46 - 46,16 (3m) boarding countdown.wav'],
    [2, 'music/b47 - 47,17 (2m) boarding countdown.wav'],
    [1, 'music/b48 - 48,18 (1m) boarding countdown.wav'],
];

const boardingSongs: [number, string][] = [
    [253, 'music/c01 - When Christmas Comes to Town.wav'],
    [159, 'music/c02 - Spirit of the Season.wav'],
    [232, 'music/c03 - Seeing is Believing.wav'],
];

export async function polarProgram(
    startTime: Date,
    getState: () => Promise<IGPSState>,
    play: (fileNames: string[], volume?: number) => Player,
    studio: string,
) {
    await withStateAsync({ startTime, studio }, async () => {
        debugLog('polarProgram', startTime, studio);
        let state = await getState();
        debugLog('post getstate', state);
        const startDate = startTime;
        const boardingStartDate = dateFns.sub(startDate, { minutes: 11 });

        debugLog('boardingStartDate', boardingStartDate);
        for (let [minutesBefore, file] of boardingAnnouncements) {
            const announcementDate = dateFns.sub(boardingStartDate, {
                minutes: minutesBefore,
            });
            if (dateFns.isAfter(state.time, announcementDate)) {
                continue;
            }
            debugLog('announcementDate', announcementDate);
            state = await waitForTime(getState, announcementDate);
            play([file]);
        }

        let adjustedStartDate = boardingStartDate;
        let boardingSongsToPlay = [];
        for (let [duration, file] of boardingSongs) {
            if (dateFns.isAfter(state.time, adjustedStartDate)) {
                adjustedStartDate = dateFns.add(adjustedStartDate, { seconds: duration });
            } else {
                boardingSongsToPlay.push(file);
            }
        }

        debugLog(startDate, adjustedStartDate);
        if (dateFns.isAfter(state.time, dateFns.add(startDate, { minutes: 5 }))) {
            // Too late, go to next show
            return;
        }
        await waitForTime(getState, adjustedStartDate);

        let playing = play([
            ...boardingSongsToPlay,
            'music/c04 - The Polar Express.wav',
            'music/c04a - Good evening and welcome aboard.wav',
            'music/c05 - Hot Chocolate (1).wav',
            'music/c05a - I dont think everybody has had hot chocolate yet.wav',
            'music/c05b - 5s pause.wav',
            'music/c06 - Hot Chocolate (2).wav',
            'music/c06a - And now lets hear the story of the Polar Express.wav',
            //'music/c07 - (Book Reading Short).wav',
            'music/CVA Story only.wav',
        ]);

        await waitForTrigger(getState, 'wolvesTriggerFrontCars');
        play(['music/a07Fa - Hungry wolves.wav', 'music/a07Fb - Glacier Gulch.wav'], 100);
        await waitForTrigger(getState, 'wolvesTriggerRearCars');
        play(['music/a07Ra - Hungry wolves.wav', 'music/a07Rb - Glacier Gulch.wav'], 100);

        await playing.wait();

        await waitForTrigger(getState, 'santaMusicStart');

        playing = play(['music/c08 - Santa Claus is Coming to Town.wav']);

        await waitForTrigger(getState, 'npTriggerFrontCars');
        play(['music/a08Fa - As we round the bend (North Pole).wav'], 100);
        await waitForTrigger(getState, 'santaTriggerFrontCars');
        play(['music/a08Fb - The elves are out this evening.wav'], 100);
        await waitForTrigger(getState, 'npTriggerRearCars');
        play(['music/a08Ra - As we round the bend (North Pole).wav'], 100);
        await waitForTrigger(getState, 'santaTriggerRearCars');
        play(['music/a08Rb - The elves are out this evening.wav'], 100);

        await playing.wait();

        await waitFor(getState, 'moving', false);
        await play(['music/c08a - Brief station stop.wav']).wait();
        await waitFor(getState, 'movingNorth', true);
        await waitForTrigger(getState, 'npMusicStart');
        await play([
            'music/c09 - Believe (1).wav',
            'music/c10 - We Wish You a Merry Christmas (1).wav',
        ]).wait();
        await waitFor(getState, 'movingNorth', false);
        await play(['music/c10a - Thousands of caribou.wav']).wait();
        await waitFor(getState, 'movingSouth', true);
        await play([
            'music/c11 - Rudolph the Red-Nosed Reindeer.wav',
            'music/c12 - Frosty the Snowman.wav',
            'music/c13 - Believe (2).wav',
            'music/Sleigh Ride.wav',
            'music/c14 - We Wish You a Merry Christmas (2).wav',
            'music/c14a - Please join us in singing.wav',
            'music/c15 - Twelve Days of Christmas.wav',
            'music/c16 - Holly Jolly Christmas.wav',
            'music/c16a - And now for our final number.wav',
            "music/c17 - Rockin' Around the Christmas Tree.wav",
            `music/c17a - (${studio}) Closing comments.wav`,
            'music/c18 - Suite from The Polar Express.wav',
        ]).wait();
    });
}
