import { optimize } from 'svgo/dist/svgo.browser.js';

import { svgToDrawbot, pathFromSVG } from './svg_utils'
import { render } from 'solid-js/web';

import { createSignal, createEffect, createMemo } from "solid-js";

function App() {
  const [filename, setFilename] = createSignal("");
  // const [Filename, setFilename] = createSignal("");
  // const [Filename, setFilename] = createSignal("");

  createEffect(() => {
    // setDoubleCount(count() * 2);
  });

  return (
    <>
      <FilenameInput count={Filename()} setFilename={setFilename} />
      <FilenameInputDisplay
        filename={filename()}
      />
    </>
  );
}

function FilenameInput(props) {
  const updateFilename = (e) => {
    props.setFilename((prev) => {console.log(prev, props); return e.target.value});
  };

  return <input onInput={updateFilename}/>;
}

function FilenameInputDisplay(props) {
  return (
    <div style="color:white">
      <div><span></span>Filename: {props.filename}<span>.hpgl</span></div>
    </div>
  );
}


render(() => <App />, document.getElementById('app'))


{ // Trick to keep these globals contained in this scope

  let globals = {
    optimizedSVGString: null,
    converted: null,
    filename: ''
  }
  let blob
  let img 
  let basesvgstring
  let image_position = [0, 0]
  let scale = 1.00
  let viewBox
  let plotter_scale = 1.00
  let plotter_image_position = [0, 0]

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
  const returnHPGLFromCommands = (commands) => {
    return `
    ${initialize}
    ${selectPen(3)}
    ${commandsToPath(commands)}
    ${penUp()}
    ${selectPen(0)}
    `
  }
  function setTwoNumberDecimal(number) {
    return parseFloat(number).toFixed(2);
  }
  const optimizeWithSVGO = (fileText) => {
    const optimized = optimize(fileText, {
      path: 'path-to.svg', // recommended
      multipass: true, // all other config fields are available here
    });

    globals.optimizedSVGString = optimized.data;

    return globals.optimizedSVGString
  }

  const setBoundsMessage = (bounds) => {

    // This information will be used as parameters for scaling
    // Paper Size   Maximum Plotting Range (in Plotter Units)
    //                       X-axis               Y-axis
    // A4             :     0 - 10900            0 - 7650
    // (210 X 297 mm) : (272.5 mm/10.68 in.) (191.25 mm/7.5 in.)
    //
    // A              :     0 - 10300            0 - 7650
    // (8.5 X 11 in.) : (257.5 mm/10.09 in.) (191.25 mm/7.5 in.)
    const msg =
      `Right now the range of your image goes from (${bounds.lowest_x},${bounds.lowest_y}) to (${bounds.highest_x},${bounds.highest_y})
  The maximum range for the plotter is: X: 0 --> 10900 units, and Y : 0 --> 7650 units
  I am now going to show you a print preview of what it might look like once printed.
  The way of thinking about this is:
    You are giving me an SVG with some size
  `
    const event = new CustomEvent("update_bounds_message", { detail: msg });

    // // Listen for the event.
    // Dispatch the event.
    window.dispatchEvent(event);
  }
  window.addEventListener(
    "update_bounds_message",
    (e) => {
      boundsMessage.innerText = e.detail
    },
    false,
  );
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

  const prepareHPGLFromSVG = (scale = 1.0, position = [0, 0], _img, _canvas, _ctx) => {

    let [newX, newY, ratio] = getNewImageSize(_img)
    output_ctx.canvas.width = PLOTTER_X_MAX / 10
    output_ctx.canvas.height = PLOTTER_Y_MAX / 10

    _ctx = outputCanvas.getContext("2d")
    // we then transform the paths to something we can parse
    globals.optimizedSVGString = optimizeWithSVGO(basesvgstring)
    console.log("globals.optimizedSVGString", globals.optimizedSVGString)
    let path = pathFromSVG(globals.optimizedSVGString)
    // Now we parse the SVG to coordinates for the plotter
    const commands = svgToDrawbot(path, ratio * scale, { x: position[0], y: position[1] },);
    console.log("commands", commands)
    // once we have the coordinates, we can translate to hpgl 
    globals.converted = returnHPGLFromCommands(commands)
    const bounds = getBoundsFromCommands(commands)
    setBoundsMessage(bounds)
    parseHPGLToCanvas(globals.converted, 1/10)
    blob = new Blob([globals.converted], { type: "image/hpgl" });

  }

  const redrawCanvas = (_ctx, _img, _canvas, _image_position) => {
    let splitbox = viewBox.split(" ").map(str => parseFloat(str))
    _ctx.canvas.width = splitbox[2]
    _ctx.canvas.height = splitbox[3]
    _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    _ctx.fillStyle = "#FFF";
    _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
    _img.width = splitbox[2]
    _img.height = splitbox[3]
    _ctx.drawImage(_img, _image_position[0], _image_position[1], _img.width, _img.height);

    try {
      prepareHPGLFromSVG(scale, image_position, _img, _canvas, _ctx)
    } catch (e) {
      console.log("ERROR preparing hpgl: ", e)
    }

  }
  const redrawPlotterCanvas = (_ctx, _img, _canvas, _image_position) => {
    try {
      prepareHPGLFromSVG(plotter_scale, plotter_image_position, _img, _canvas)
    } catch (e) {
      console.log("ERROR preparing hpgl: ", e)
    }
  }

  const handleImage = (e) => {
    try {
      let reader = new FileReader();
      reader.onload = (event) => {
        globals.filename = event.target.result
        filename_input.value = globals.filename
        console.log("Event ", event)
        img = new Image();
        img.onload = function () {
          var doc = parser.parseFromString(`${optimizeWithSVGO(event.target.result)}`, "image/svg+xml");
          viewBox = doc.children[0].getAttribute("viewBox") || `0 0 ${img.width} ${img.height}`
          if (!viewBox) {
            throw new Error("Could not determine viewbox!")
          }

          redrawCanvas(ctx, img, canvas, image_position)
        }
        // https://stackoverflow.com/questions/44900569/turning-an-svg-string-into-an-image-in-a-react-component
        img.src = `data:image/svg+xml;utf8,${encodeURIComponent(event.target.result)}`;
        var parser = new DOMParser();
        var doc = parser.parseFromString(`${optimizeWithSVGO(event.target.result)}`, "image/svg+xml");

        viewBox = doc.children[0].getAttribute("viewBox") || `0 0 ${img.width} ${img.height}`
        if (!viewBox) {
          throw new Error("Could not get viewbox from image. Is it in the dom?")
        }
        basesvgstring = event.target.result
      }
      // reader.readAsDataURL(e.target.files[0]);
      reader.readAsText(e.target.files[0]);
    } catch (e) {
      console.log("Encountered error", e)
    }
  }

  function downloadBlob(blob, filename) {
    // Create an object URL for the blob object
    const url = URL.createObjectURL(blob);

    // Create a new anchor element
    const a = document.createElement('a');

    // Set the href and download attributes for the anchor element
    // You can optionally set other attributes like `title`, etc
    // Especially, if the anchor element will be attached to the DOM
    a.href = url;
    a.download = `${globals.filename}`;

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
    // a.addEventListener('click', clickHandler, false);

    // Programmatically trigger a click on the anchor element
    // Useful if you want the download to happen automatically
    // Without attaching the anchor element to the DOM
    // Comment out this line if you don't want an automatic download of the blob content
    // a.click();

    // Return the anchor element
    // Useful if you want a reference to the element
    // in order to attach it to the DOM or use it in some other way
    return a;
  }


  const body = document.getElementsByClassName('container')[0]


  // let scale_control = document.createElement('input')
  // scale_control.setAttribute("id", "scale_control")
  // scale_control.setAttribute("type", "number")
  // scale_control.setAttribute("min", "0")
  // scale_control.setAttribute("max", "10")
  // scale_control.setAttribute("step", "0.1")
  // scale_control.setAttribute("value", "1.00")
  // scale_control.addEventListener("change", (e) => {
  //   scale = setTwoNumberDecimal(e.target.value)
  //   redrawCanvas(ctx, img, canvas, image_position)
  // })
  // scale_control.setAttribute("id", "scale_control")
  // body.appendChild(scale_control)

  // let x_control = document.createElement('input')
  // x_control.setAttribute("id", "x_control")
  // x_control.setAttribute("type", "number")
  // x_control.setAttribute("min", "-100000")
  // x_control.setAttribute("max", "100000")
  // x_control.setAttribute("step", "1")
  // x_control.setAttribute("value", "0")
  // x_control.addEventListener("change", (e) => {
  //   image_position[0] = e.target.value
  //   redrawCanvas(ctx, img, canvas, image_position)
  // })
  // x_control.setAttribute("id", "x_control")
  // body.appendChild(x_control)

  // let y_control = document.createElement('input')
  // y_control.setAttribute("id", "y_control")
  // y_control.setAttribute("type", "number")
  // y_control.setAttribute("min", "-100000")
  // y_control.setAttribute("max", "100000")
  // y_control.setAttribute("step", "1")
  // y_control.setAttribute("value", "0")
  // y_control.addEventListener("change", (e) => {
  //   image_position[1] = e.target.value
  //   redrawCanvas(ctx, img, canvas, image_position)
  // })
  // y_control.setAttribute("id", "y_control")
  // body.appendChild(y_control)
  let container = document.createElement('div');
  container.setAttribute("style", `width: 400px;color:black`)
  container.setAttribute("id", "container")
  body.appendChild(container)

  let imageLoader = document.createElement('input');
  imageLoader.setAttribute("type", "file")
  imageLoader.addEventListener('change', handleImage, false);
  container.appendChild(imageLoader)

  let download_btn = document.createElement('button')
  download_btn.setAttribute("id", "download_btn")
  download_btn.innerText = "Prepare Download"
  download_btn.onclick = () => {
    if (blob) {
      const anchor = downloadBlob(blob, 'test.hpgl');

      anchor.innerText = `download ${globals.filename}` 
      anchor.setAttribute("style", `width: ${window.innerWidth};height:${"200px"};`)
      container.appendChild(anchor)

    } else {
      console.log("Nothing in the drag 'n drop ")
    }
  }
  container.appendChild(download_btn)

  // const download  = document.getElementById('download')
  // const drop_zone = document.getElementById('drop_zone')


  let boundsMessage = document.createElement('p');
  boundsMessage.setAttribute("style", `width: 400px;color:white`)
  boundsMessage.setAttribute("id", "boundsMessage")
  container.appendChild(boundsMessage)

  imageLoader.setAttribute("type", "file")
  imageLoader.addEventListener('change', handleImage, false);
  container.appendChild(imageLoader)

  let output_scale_control = document.createElement('input')
  output_scale_control.setAttribute("id", "output_scale_control")
  output_scale_control.setAttribute("type", "number")
  output_scale_control.setAttribute("min", "0")
  output_scale_control.setAttribute("max", "10")
  output_scale_control.setAttribute("step", "0.1")
  output_scale_control.setAttribute("value", "1.00")
  output_scale_control.addEventListener("change", (e) => {
    plotter_scale = setTwoNumberDecimal(e.target.value)
    redrawPlotterCanvas(output_ctx, img, outputCanvas, plotter_image_position)
  })
  output_scale_control.setAttribute("id", "output_scale_control")
  container.appendChild(output_scale_control)

  let output_x_control = document.createElement('input')
  output_x_control.setAttribute("id", "output_x_control")
  output_x_control.setAttribute("type", "number")
  output_x_control.setAttribute("min", "-100000")
  output_x_control.setAttribute("max", "100000")
  output_x_control.setAttribute("step", "1")
  output_x_control.setAttribute("value", "0")
  output_x_control.addEventListener("change", (e) => {
    plotter_image_position[0] = parseFloat(e.target.value)
    redrawPlotterCanvas(output_ctx, img, outputCanvas, plotter_image_position)
  })
  output_x_control.setAttribute("id", "output_x_control")
  container.appendChild(output_x_control)

  let output_y_control = document.createElement('input')
  output_y_control.setAttribute("id", "output_y_control")
  output_y_control.setAttribute("type", "number")
  output_y_control.setAttribute("min", "-100000")
  output_y_control.setAttribute("max", "100000")
  output_y_control.setAttribute("step", "1")
  output_y_control.setAttribute("value", "0")
  output_y_control.addEventListener("change", (e) => {
    plotter_image_position[1] = parseFloat(e.target.value)
    redrawPlotterCanvas(output_ctx, img, outputCanvas, plotter_image_position)
  })
  output_y_control.setAttribute("id", "output_y_control")
  container.appendChild(output_y_control)

  let filename_input = document.createElement('input')
  filename_input.setAttribute("id", "filename_input")
  filename_input.setAttribute("type", "text")
  filename_input.addEventListener("change", (e) => {
    console.log("E", e)
    globals.filename = `${e.target.value}.hpgl`
  })
  filename_input.setAttribute("id", "filename_input")
  container.appendChild(filename_input)

  const outputCanvas = document.createElement('canvas')
  const output_ctx = outputCanvas.getContext('2d')
  outputCanvas.setAttribute("id", "output_outputCanvas")
  outputCanvas.setAttribute("style", `display:block;`)
  
  // outputCanvas.setAttribute("style",  `width: ${outputCanvasWidth};height:${outputCanvasHeight};`)
  body.appendChild(outputCanvas)
  
  const canvas = document.createElement('canvas')
  let ctx = canvas.getContext('2d')
  canvas.setAttribute("id", "output_canvas")
  canvas.setAttribute("style", `display:block; margin-bottom:50px;`)

  // canvas.setAttribute("style",  `width: ${canvasWidth};height:${canvasHeight};`)
  body.appendChild(canvas)

  function parseHPGLToCanvas(hpgl_text, renderScaling = 1.0, _position = [0, 0]) {
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
  }
}