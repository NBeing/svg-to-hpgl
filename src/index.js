import { optimize } from 'svgo/dist/svgo.browser.js';

import {svgToDrawbot, pathFromSVG} from './svg_utils'

import svgString from '../assets/logo-recursebot.svg'

console.log("RAW SVG!", svgString)

// getPaths(parsedSvg)

let path = pathFromSVG(svgString)
const commands = svgToDrawbot(path, 200, { x: 0, y: 0 });

// We know we have this structure, (an array of these bad bois)
// command: "moveTo"
// ​​​pen: false
// ​​x: 277.71
// y: 158.52

// PA x,y{,x,y{...}} 	Plot absolute [i] 
// PD 	Pen down
// PU 	Pen up 
// AP 	Automatic pen pickup [i]
// DF 	Set default values
// IM e{,s{,p}} 	Input e, s and p masks [i]
// IN 	Initialize
// OE 	Output error [i]
// OS 	Output status [i] 


// The full set of supported commands is: PA, PR, PU, PD, CA, CP, CS, DI, DR, LB, SA, SI, SL, SM, SP, SR, SS, UC, LT, TL, VS, XT, YT, DF, DT, IM, IN, SC, DC, DP, OA, OC, OD, OE, OF, OH, OI, OO, OP, OS, OW, IP, IW.
console.log("Commands!", commands)

const initialize = "IN;"
const selectPen = (penNumber) => `SP${penNumber};`
const penDown = () => `PD;`
const penUp = () => `PU;`
const moveToAbsolute = (x,y) =>{
  return `PA${x},${y};\n`
}

const commandsToPath = (commands) => commands.map( command  => {
  const penState = command.pen ? "PD;" : "PU;"
  const cmd = `${penState}${moveToAbsolute(command.x, command.y)}`
  return cmd
}).join("")

const returnHPGLFromCommands = (commands) => {
  return `
    ${initialize}
    ${selectPen(3)}
    ${commandsToPath(commands)}
    ${penUp()}
    ${selectPen(0)}
  `
}

const result = returnHPGLFromCommands(commands)
console.log("Result", result)

// ui
// const download = document.getElementById('download')
// console.log("Download", download)

// download.onclick = () => {
//   const textarea = document.getElementById('output')
//   console.log("Textarea", textarea)
//   textarea.innerHTML = result
// }

const download = document.getElementById('drop_zone')
console.log("Download", download)

download.ondrop = dropHandler;

const optimized = optimize(svgString, {
  path: 'path-to.svg', // recommended
  multipass: true, // all other config fields are available here
});

const optimizedSvgString = optimized.data;

console.log("Optimized!", optimizedSvgString)

const input_textarea = document.getElementById('input')
input_textarea.innerText = svgString


const output_textarea = document.getElementById('output')
output_textarea.innerText = optimizedSvgString

function dropHandler(ev) {
  console.log("File(s) dropped");

  // Prevent default behavior (Prevent file from being opened)
  ev.preventDefault();

  if (ev.dataTransfer.items) {
    // Use DataTransferItemList interface to access the file(s)
    [...ev.dataTransfer.items].forEach((item, i) => {
      // If dropped items aren't files, reject them
      if (item.kind === "file") {
        const file = item.getAsFile();
        console.log(`… file[${i}].name = ${file.name}`);
      }
    });
  } else {
    // Use DataTransfer interface to access the file(s)
    [...ev.dataTransfer.files].forEach((file, i) => {
      console.log(`… file[${i}].name = ${file.name}`);
    });
  }
}
