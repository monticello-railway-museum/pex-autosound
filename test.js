const GPS = require('gps');
const gps = new GPS;

if (false) {
    const fs = require('fs');
    const stream = fs.createReadStream('/home/bdowning/pex-trip.gps');

    const readline = require('readline');

    const rl = readline.createInterface({
        input: stream,
    });

    rl.on('line', (line) => {
        console.log(line);
        gps.update(line);
    });

    gps.on('data', (parsed) => {
        console.log(gps.state);
    });
}

// GPS = 442ft from front of engine
//     = 352ft from front of RI (442 - 50 - 40)
//     = 326ft from end of train

// wolf lead time at 12mph = 8 seconds = 140 ft

// wolf trigger point = 140 + 442 - 90 = 492 ft

// 370 ft = 21 seconds @ 12 mph

const tracks = [
    "c01 - When Christmas Comes to Town.wav",
    "c02 - Spirit of the Season.wav",
    "c03 - Seeing is Believing.wav",
    "c04 - The Polar Express.wav",
    "c04a - Good evening and welcome aboard.wav",
    "c05 - Hot Chocolate (1).wav",
    "c05a - I dont think everybody has had hot chocolate yet.wav",
    "c05b - 5s pause.wav",
    "c06 - Hot Chocolate (2).wav",
    "c06a - And now lets hear the story of the Polar Express.wav",
    "c07 - (Book Reading).wav",
    "c08 - Santa Claus is Coming to Town.wav",
    "c08a - Brief station stop.wav",
    "c09 - Believe (1).wav",
    "c10 - We Wish You a Merry Christmas (1).wav",
    "c10a - Thousands of caribou.wav",
    "c11 - Rudolph the Red-Nosed Reindeer.wav",
    "c12 - Frosty the Snowman.wav",
    "c13 - Believe (2).wav",
    "c14 - We Wish You a Merry Christmas (2).wav",
    "c14a - Please join us in singing.wav",
    "c15 - Twelve Days of Christmas.wav",
    "c16 - Holly Jolly Christmas.wav",
    "c16a - And now for our final number.wav",
    "c17 - Rockin' Around the Christmas Tree.wav",
    "c17a - (AIM) Closing comments.wav",
    "c17a - (DDS) Closing comments.wav",
    "c18 - Suite from The Polar Express.wav",
];

const util = require('util');
const sox = require('sox');
const identify = util.promisify(sox.identify);

(async () => {
    for (let track of tracks) {
        console.log(await identify(`/home/bdowning/projects/mrm/pex-announcements/edited/${track}`));
    }
})();
