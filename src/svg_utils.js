
// Adapted from drawbot: https://github.com/codekitchen/drawbot
import { parseSVG, makeAbsolute } from '../3rd-party/svg-path-parser/index.js'
import cubicCurve from '../3rd-party/adaptive-bezier-curve.js'
import quadraticCurve from '../3rd-party/adaptive-quadratic-curve.js'
import { arcToBezier } from '../3rd-party/svg-arc-to-bezier.js';

const curveScale = 1.0;

const isCurve = (cmd) => {
  return cmd.code == 'C' || cmd.code == 'S' || cmd.code == 'Q' || cmd.code == 'T';
}

function pathFromSVG(svgStr) {
  const parser = new DOMParser();
  const svg = parser.parseFromString(svgStr, "image/svg+xml");
  const pathNodes = svg.querySelectorAll('path');

  if (!pathNodes)
    return null;
  let commands = [];
  for (let pathNode of pathNodes) {
    const path = pathNode.getAttribute('d');
    if (!path)
      continue;
    commands = commands.concat(makeAbsolute(parseSVG(path)));
  }
  return commands;
}

function svgToDrawbot(pathCommands, scale, translation) {
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
module.exports = {
  isCurve,
  svgToDrawbot,
  pathFromSVG  
}
