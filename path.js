let turf = require('@turf/turf');
let fs = require('fs');

let polarPath = JSON.parse(fs.readFileSync('pex-path.json'));

console.log(polarPath);
console.log(turf.length(polarPath, {units: 'feet'}));
