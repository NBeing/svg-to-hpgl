// Adapted from drawbot: https://github.com/codekitchen/drawbot
import { parseSVG, makeAbsolute } from '../3rd-party/svg-path-parser/index.js'
import cubicCurve from '../3rd-party/adaptive-bezier-curve.js'
import quadraticCurve from '../3rd-party/adaptive-quadratic-curve.js'
import arcToBezier from '../3rd-party/svg-arc-to-bezier.js';

const curveScale = 1.0;
import { parse } from 'svg-parser';
import svgString from '../assets/statue_of_liberty_svg_omg.svg'
console.log("RAW SVG!", svgString)

// getPaths(parsedSvg)

export function pathFromSVG(svgStr) {
  const parser = new DOMParser();
  const svg = parser.parseFromString(svgStr, "image/svg+xml");
  const pathNodes = svg.querySelectorAll('path');
  console.log("Path nodes", pathNodes)
  if (!pathNodes)
    return null;
  let commands = [];
  for (let pathNode of pathNodes) {
    const path = pathNode.getAttribute('d');
    if (!path)
      continue;
    commands = commands.concat(makeAbsolute(parseSVG(path)));
  }
  console.log("Intermediate commands", commands)
  return commands;
}

export function svgToDrawbot(pathCommands, scale, translation) {
  let drawCommands = [];
  let prevCmd = { x: 0, y: 0, code: '' };
  let pts, cp;

  function t(inp) {
    if (inp instanceof Array) {
      inp = { x: inp[0], y: inp[1] };
    }
    return {
      x: inp.x * scale + translation.x,
      y: inp.y * scale + translation.y,
    }
  }

  for (let p of pathCommands) {
    switch (p.code) {
      case 'M':
        drawCommands.push({ command: 'moveTo', pen: false, ...t(p) });
        break;
      case 'L':
      case 'H':
      case 'V':
      case 'Z':
        // makeAbsolute lets us treat these all the same
        drawCommands.push({ command: 'moveTo', pen: true, ...t(p) });
        break;
      case 'C':
        pts = cubicCurve()([p.x0, p.y0], [p.x1, p.y1], [p.x2, p.y2], [p.x, p.y], curveScale);
        for (let pt of pts) {
          drawCommands.push({ command: 'moveTo', pen: true, ...t(pt) });
        }
        break;
      case 'S':
        cp = [p.x0, p.y0];
        if (isCurve(prevCmd)) {
          cp = [p.x0 + (p.x0 - prevCmd.x2), p.y0 + (p.y0 - prevCmd.y2)];
        }
        pts = cubicCurve()([p.x0, p.y0], cp, [p.x2, p.y2], [p.x, p.y], curveScale);
        for (let pt of pts) {
          drawCommands.push({ command: 'moveTo', pen: true, ...t(pt) });
        }
        break;
      case 'Q':
        pts = quadraticCurve()([p.x0, p.y0], [p.x1, p.y1], [p.x, p.y], curveScale);
        for (let pt of pts) {
          drawCommands.push({ command: 'moveTo', pen: true, ...t(pt) });
        }
        break;
      case 'T':
        cp = [p.x0, p.y0];
        if (isCurve(prevCmd)) {
          cp = [p.x0 + (p.x0 - prevCmd.x1), p.y0 + (p.y0 - prevCmd.y1)];
        }
        pts = quadraticCurve()([p.x0, p.y0], cp, [p.x, p.y], curveScale);
        for (let pt of pts) {
          drawCommands.push({ command: 'moveTo', pen: true, ...t(pt) });
        }
        break;
      case 'A':
        let curves = arcToBezier({ px: p.x0, py: p.y0, cx: p.x, cy: p.y, rx: p.rx, ry: p.ry, xAxisRotation: p.xAxisRotation, largeArcFlag: p.largeArc, sweepFlag: p.sweep });
        for (let curve of curves) {
          pts = cubicCurve()([p.x0, p.y0], [curve.x1, curve.y1], [curve.x2, curve.y2], [curve.x, curve.y], 1);
          for (let pt of pts) {
            drawCommands.push({ command: 'moveTo', pen: true, ...t(pt) });
          }
        }
        break;
      default:
        throw new Error(`don't know command: ${p.code}`)
    }
  }
  return drawCommands;
}

function isCurve(cmd) {
  return cmd.code == 'C' || cmd.code == 'S' || cmd.code == 'Q' || cmd.code == 'T';
}

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
const download = document.getElementById('download')
console.log("Download", download)
download.onclick = () => {
  const textarea = document.getElementById('output')
  console.log("Textarea", textarea)
  textarea.innerHTML = result
}