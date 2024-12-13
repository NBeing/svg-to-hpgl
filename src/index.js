import { optimize } from 'svgo/dist/svgo.browser.js';

import {svgToDrawbot, pathFromSVG} from './svg_utils'

import svgString from '../assets/logo-recursebot.svg'

console.log("RAW SVG!", svgString)

// getPaths(parsedSvg)


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
// console.log("Commands!", commands)

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



// const input_textarea = document.getElementById('input')
// input_textarea.innerText = svgString


// const output_textarea = document.getElementById('output')
// output_textarea.innerText = optimizedSvgString

function downloadBlob(blob, filename) {
  // Create an object URL for the blob object
  const url = URL.createObjectURL(blob);

  // Create a new anchor element
  const a = document.createElement('a');

  // Set the href and download attributes for the anchor element
  // You can optionally set other attributes like `title`, etc
  // Especially, if the anchor element will be attached to the DOM
  a.href = url;
  a.download = filename || 'download';

  // Click handler that releases the object URL after the element has been clicked
  // This is required for one-off downloads of the blob content
  const clickHandler = () => {
    setTimeout(() => {
      URL.revokeObjectURL(url);
      removeEventListener('click', clickHandler);
    }, 150);
  };

  // Add the click event listener on the anchor element
  // Comment out this line if you don't want a one-off download of the blob content
  a.addEventListener('click', clickHandler, false);

  // Programmatically trigger a click on the anchor element
  // Useful if you want the download to happen automatically
  // Without attaching the anchor element to the DOM
  // Comment out this line if you don't want an automatic download of the blob content
  a.click();

  // Return the anchor element
  // Useful if you want a reference to the element
  // in order to attach it to the DOM or use it in some other way
  return a;
}
download.ondragover = (ev) => {
  console.log("File(s) in drop zone");

  // Prevent default behavior (Prevent file from being opened)
  ev.preventDefault();
}

download.ondrop = (ev) => {
  console.log("File(s) dropped");
  
  // Prevent default behavior (Prevent file from being opened)
  ev.preventDefault();
  
  if (ev.dataTransfer.items) {
    // Use DataTransferItemList interface to access the file(s)
    [...ev.dataTransfer.items].forEach((item, i) => {
      // If dropped items aren't files, reject them
      if (item.kind === "file") {
        const file = item.getAsFile();
        const text = file.text().then( x => {
          try{
          // first optimize the svg to only include "paths" rather than predefined svg "shapes"
          const optimized = optimize(x, {
            path: 'path-to.svg', // recommended
            multipass: true, // all other config fields are available here
          });
          
          const optimizedSvgString = optimized.data;
          // Now we parse the SVG to coordinates
          let path = pathFromSVG(optimizedSvgString)
          const commands = svgToDrawbot(path, 200, { x: 0, y: 0 });
          // once we have the coordinates, we can translate to hpgl 
          const result = returnHPGLFromCommands(commands)
          console.log("Result", result)
          const blob = new Blob([result], { type: "image/hpgl" });
          console.log("Download blob now plzzzz")
          downloadBlob(blob, "fuckinwerrrrrrrrque.hpgl")

          // const url = URL.createObjectURL(blob);
          // window.open(url, '_blank');

          }catch(e){
            console.log("ERROR : ", e)
          }
        })
        console.log("File!", )
        console.log(`… file[${i}].name = ${file.name}`);
      }
    });
  } else {
    // Use DataTransfer interface to access the file(s)
    [...ev.dataTransfer.files].forEach((file, i) => {
      console.log(`… file[${i}].name = ${file.name}`);
    });
  }
};


download.onclick = () => {
  if(optimizedSvgString){
    const blob = new Blob([optimizedSvgString], { type: 'text/plain' });
    downloadBlob(blob, 'test.hpgl');  
  } else {
    console.log("Nothing in the dragon drop bro")
  }
}
