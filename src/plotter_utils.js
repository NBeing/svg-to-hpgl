import { optimizeWithSVGO } from './svg_utils'
import { svgToDrawbot, pathFromSVG } from '../3rd-party/codekitchens_svg_to_drawbot'

const PLOTTER_X_MAX = 10900
const PLOTTER_Y_MAX = 7650

const initialize = "IN;"
const selectPen = (penNumber) => `SP${penNumber};`
const penDown = () => `PD;`
const penUp = () => `PU;`
const moveToAbsolute = (x, y) => {
  return `PA${x},${y};\n`
}

const commandsToPath = (commands) => commands.map(command => {
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

const getBoundsFromCommands = (commands) => {
  const bounds = commands.reduce((acc, cur) => {
    if (cur.x < acc.lowest_x) {
      acc.lowest_x = cur.x
    }
    if (cur.y < acc.lowest_y) {
      acc.lowest_y = cur.y
    }

    if (cur.x > acc.highest_x) {
      acc.highest_x = cur.x
    }
    if (cur.y > acc.highest_y) {
      acc.highest_y = cur.y
    }
    return acc
  }, { lowest_x: 1000000000, lowest_y: 1000000000, highest_x: 0, highest_y: 0 })
  console.log("bounds are:", bounds)
  return bounds
}

const getNewImageSize = (img) => {
  // The plotter dimensions are as follows
  // x: 10900            y : 7650
  // but clearly, x is the long way on the paper
  // and y is the short way so it no match
  // we dont want to make the canvas 10900 x 7650 because
  // that would be too big
  // so we're going to try to make it 1090 x 765 so that we can keep it reasonable
  // Right now the range of your image goes from 
  // (0.057,0.0003) to (1082.6571777343747,1200.3227490234376)
  // The maximum range for the plotter is: X: 0 --> 10900 units, and Y : 0 --> 7650 units
  let plotter_x = 10900
  let plotter_y = 7650

  let plotter_aspect = plotter_x / plotter_y
  console.log("plotter_aspect: ", plotter_aspect)
  // 1.42 , meaning it is 1.42 times wider than it is long

  let image_x = img.width// 1200
  let image_y = img.height // 1082
  console.log("Img x y", image_x, image_y)
  let image_aspect = image_x / image_y

  console.log("Image aspect: ", image_aspect)
  // 0.90, meaning the width is .90 of the length
  // ok so the image is longer than it is wide,
  // doesn't that mean we can scale up using the y coordinate?
  let scaled_x, scaled_y, ratio
  if (plotter_aspect > image_aspect) {
    ratio = plotter_y / image_y
    scaled_x = image_x * ratio
    scaled_y = image_y * ratio - 0.1 //computer math lol
    if(scaled_x > plotter_x || scaled_y > plotter_y){
      console.log(scaled_x < plotter_x)
      console.log(scaled_y < plotter_y)
      throw new Error("There was an issue")
    }

  } else {
    ratio = plotter_x / image_x
    scaled_x = image_x * ratio - 0.1
    scaled_y = image_y * ratio - 0.1 //computer math lol

    if(scaled_x > plotter_x || scaled_y > plotter_y){
      console.log(scaled_x < plotter_x)
      console.log(scaled_y < plotter_y)
      console.log("Ratio: ", ratio)
      throw new Error("There was an issue")
    }

  }
  console.log("Scaled: ", scaled_x, scaled_y)
  return [scaled_x, scaled_y, ratio]
}
function parseHPGLAndDrawToCanvas(hpgl_text, renderScaling = 1.0, _position = [0, 0], output_ctx, outputCanvas) {
  console.log("PArsing hpgl to print preview ", output_ctx, outputCanvas, _position)
  const pens = {
    0: "#FF00FF",
    3: "#FFFF00"
  }
  const trimmed = hpgl_text.trim()
  const split = trimmed.split(";").map(x => x.trim())
  let penState = 0
  const instructions = []
  split.forEach(command => {
    if (command == "PU") {
      penState = 0
    }
    else if (command == "PD") {
      penState = 1
    }
    else if (command.startsWith("PA")) {
      const [x, y] = command.substring(2).split(",")
      let cmd
      if (penState == 0) {
        cmd = "moveTo"
      } else {
        cmd = "lineTo"
      }
      instructions.push({
        x: parseFloat(x) + _position[0],
        y: parseFloat(y) + _position[1],
        cmd
      })
    } else if(command.startsWith("SP")){
      // const pen = command.substring(2)
      // console.log("Pen", pen)
      // instructions.push({ pen: pen})
    } else {
      console.log("Unknown command:", command)
    }
  })
  output_ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  output_ctx.fillStyle = "#FFF";
  output_ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

  output_ctx.beginPath();
  instructions.forEach(instruction => {
    // if(Object.hasOwn(instruction, "pen")){
    //   output_ctx.beginPath();
    //   console.log("Got it", instruction.pen)
    //   output_ctx.fillStyle = pens[instruction.pen]
    //   output_ctx.stroke()
    //   return
    // }

    output_ctx[instruction.cmd]((instruction.x) * renderScaling, (instruction.y) * renderScaling)
  })
  output_ctx.stroke()
  console.log("Done stroke")
}

export const prepareHPGLFromSVG = (scale = 1.0, position = [0, 0], _img, _canvas, basesvgstring, optimizedSVGString) => {
  console.log("Positch", position)
  try {
    let _ctx = _canvas.getContext("2d") 
    let [newX, newY, ratio] = getNewImageSize(_img)
    _ctx.canvas.width = PLOTTER_X_MAX / 10
    _ctx.canvas.height = PLOTTER_Y_MAX / 10

    _ctx = _canvas.getContext("2d")
    // we then transform the paths to something we can parse
    optimizedSVGString = optimizeWithSVGO(basesvgstring)

    let path = pathFromSVG(optimizedSVGString)
    // Now we parse the SVG to coordinates for the plotter
    const commands = svgToDrawbot(path, ratio * scale, { x: position[0], y: position[1] },);

    // once we have the coordinates, we can translate to hpgl 
    let converted = returnHPGLFromCommands(commands)
    const bounds = getBoundsFromCommands(commands)
    // setBoundsMessage(bounds)

    parseHPGLAndDrawToCanvas(converted, 1/10, position, _ctx, _canvas)
    let blob = new Blob([converted], { type: "image/hpgl" });
    return blob
  } catch(e) {
    console.log("Error while preparing hpgl from svg", e)
  }

}
