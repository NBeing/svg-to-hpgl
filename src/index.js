import {parseSVG, makeAbsolute} from 'svg-path-parser'
import { parse } from 'svg-parser';
import svg from '../assets/sample1proc.svg'
console.log("RAW SVG!", svg)

const svgString = svg;
const parsedSvg = parse(svgString);
const getPaths = (parsedSvg) => {
  let paths = parsedSvg.children[0].children
  console.log("Paths", paths);
  const commands = parseSVG(paths[0].properties.d)
  const result = makeAbsolute(commands) // Note: mutates the commands in place!
  console.log("Result", commands)
} 
getPaths(parsedSvg)