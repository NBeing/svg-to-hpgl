import { optimize } from 'svgo/dist/svgo.browser.js';
import { render } from 'solid-js/web';
import { createSignal, createEffect } from "solid-js";
import { svgToDrawbot, pathFromSVG } from './svg_utils'

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

  return optimized.data
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

const prepareHPGLFromSVG = (scale = 1.0, position = [0, 0], _img, _canvas, basesvgstring, optimizedSVGString) => {
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

    parseHPGLToCanvas(converted, 1/10, position, _ctx, _canvas)
    let blob = new Blob([converted], { type: "image/hpgl" });
    return blob
  } catch(e) {
    console.log("Error while preparing hpgl from svg", e)
  }

}

const redrawCanvas = (_img, _canvas, _image_position, viewBox ) => {
  let _ctx = _canvas.getContext("2d")
  let splitbox = viewBox.split(" ").map(str => parseFloat(str))
  _ctx.canvas.width = splitbox[2]
  _ctx.canvas.height = splitbox[3]
  _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
  _ctx.fillStyle = "#FFF";
  _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
  _img.width = splitbox[2]
  _img.height = splitbox[3]
  _ctx.drawImage(_img, _image_position[0], _image_position[1], _img.width, _img.height);
}


function parseHPGLToCanvas(hpgl_text, renderScaling = 1.0, _position = [0, 0], output_ctx, outputCanvas) {
  console.log("PArsing hpgl to print preview ", output_ctx, outputCanvas)
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



function App() {
  let inputCanvas
  let outputCanvas
  const [filename, setFilename] = createSignal("");

  const [inputCtx, setInputCtx] = createSignal();
  // const [inputCanvas, setInputCanvas] = createSignal();
  const [inputSvg , setInputSvg] = createSignal()
  const [rawSvgInputString , setRawSvgInputString] = createSignal()
  const [optimizedSvgInputString , setOptimizedSvgInputString] = createSignal()

  const [inputSvgViewbox , setInputSvgViewbox] = createSignal()

  // const [outputCanvas, setOutputCanvas] = createSignal();
  const [outputCtx, setOutputCtx] = createSignal();

  const [outputScale, setOutputScale] = createSignal(1);
  const [outputX, setOutputX] = createSignal(0);
  const [outputY, setOutputY] = createSignal(0);
  const [hpglBlob, setHpglBlob] = createSignal();
  const [downloadUrl, setDownloadUrl] = createSignal();
  // createEffect( () => {
  //   // this gets rendered when the canvas ref is set on init
  //   setInputCtx(inputCanvas.getContext("2d"))
  // })
  // createEffect( () => {
  //   // this gets rendered when the canvas ref is set on init
  //   setOutputCtx(outputCanvas.getContext("2d"))
  // })

  createEffect(() => {
    if(inputSvg()){
      // when we set the input svg that means we've loaded a file
      // we now draw the svg and set the context
      let parser = new DOMParser();
      let optimizedSVGString = optimizeWithSVGO(rawSvgInputString())

      setOptimizedSvgInputString(optimizedSVGString)
      let doc = parser.parseFromString(`${optimizeWithSVGO(rawSvgInputString())}`, "image/svg+xml");
      let viewbox = doc.children[0].getAttribute("viewBox")
      if (!viewbox) {
        console.error("Could not determine viewbox! falling back to width / height")
        setInputSvgViewbox(`0 0 ${inputSvg().img.width} ${inputSvg().img.height}`)
      } else {
        setInputSvgViewbox(viewbox)
      }
      redrawCanvas(inputSvg().img, inputCanvas, [0,0], inputSvgViewbox(), rawSvgInputString())
    }
  });
  createEffect(() => {
    if(inputSvgViewbox()){
      let blob = prepareHPGLFromSVG(outputScale(), [outputX(), outputY()], inputSvg().img, outputCanvas, rawSvgInputString(), optimizedSvgInputString())
      setHpglBlob(blob)
    }
    [outputScale(), [outputX(), outputY()], outputCanvas, outputCtx(), rawSvgInputString(), optimizedSvgInputString()]
  })
  createEffect(() => {
    if(hpglBlob()){
      setDownloadUrl(URL.createObjectURL(hpglBlob()))
    }
  })  
  return (
    <>
      <ImageLoader 
        ctx={inputCtx()}
        setSvg={setInputSvg}
        setRawSvgInputString={setRawSvgInputString}
        setFilename={setFilename}
      />
      <Show when={hpglBlob()}>
          <DownloadButton 
            blob = {hpglBlob()} 
            filename={filename()} 
            url={downloadUrl()}
          />
        </Show>
      <Show when={inputSvg()}>
        <div class="toolbox">
          <GenericInput 
            name="output scale" 
            type={"number"} 
            value={outputScale()}  
            setValue={setOutputScale}
            min={0}
            max={1000}
            step={0.1}
          />
          <GenericInput name="output x"     type={"number"} value={outputX()}      setValue={setOutputX}/>
          <GenericInput name="output y"     type={"number"} value={outputY()}      setValue={setOutputY}/>
          <FilenameInput filename={filename()} setFilename={setFilename} />
          <FilenameInputDisplay filename={filename()} />
          </div>
          <div class="canvases">
            <Canvas id={"input"} ref={inputCanvas} />
            <Canvas id={"print_preview"} ref={outputCanvas} />
          </div>
      </Show>
    </>
  );
}

function DownloadButton(props){
  const _onClick = () => {
    // Create an object URL for the blob object
    const url = URL.createObjectURL(props.blob);
    // Create a new anchor element
    const a = document.createElement('a');
  
    // Set the href and download attributes for the anchor element
    // You can optionally set other attributes like `title`, etc
    // Especially, if the anchor element will be attached to the DOM
    a.href = url;
    a.download = `${props.filename}.hpgl`;
  
    // Click handler that releases the object URL after the element has been clicked
    // This is required for one-off downloads of the blob content
    const clickHandler = () => {
      setTimeout(() => {
        URL.revokeObjectURL(props.url);
        removeEventListener('click', clickHandler);
      }, 150);
    };
    a.click();
  }
  return (
    <>
      <button download={props.filename} href={props.downloadUrl} onClick={_onClick}> Download </button>
    </>
  )
} 
function Canvas(props) {
  return (
    <div className="canvas-container">
      <canvas id={props.id} ref={props.ref} /> {/* Assign the ref to the canvas element */}
    </div>
  )
}

function ImageLoader(props){
  const updateValue = (e) => {
    try {
      let img = new Image();
      let reader = new FileReader();
      reader.onload = (event) => {
        let rawSvgString = event.target.result
        img.onload = function () {
          props.setSvg((_prev) => {
            return {img}
          });
        }
        // https://stackoverflow.com/questions/44900569/turning-an-svg-string-into-an-image-in-a-react-component
        img.src = `data:image/svg+xml;utf8,${encodeURIComponent(rawSvgString)}`;
        props.setRawSvgInputString((_prev) => {
          return rawSvgString
        })
      }
      // this retrieves the raw text of the file
      reader.readAsText(e.target.files[0]);
      props.setFilename((_prev) => {
        try {
          let filename = e.target.files[0].name.split(".")[0]
          return filename 
        } catch(e){
          console.error("Couldn't parse filename, setting to default!")
          return "couldnt_retrieve_filename"
        }
      })
    } catch (e) {
      console.log("Encountered error", e)
    }
  }
  const onCancel = (e) => {
    console.log("Thing was cancelled")
  }
  return (
    <>
     <input type={"file"} accept={".svg"} onChange={updateValue} onCancel={onCancel}/>)
    </>
  )
}

function GenericInput(props) {
  let display_value = 0.0
  const updateValue = (e) => {
    props.setValue((_prev) => {
      if(props.type == "number"){
        display_value = setTwoNumberDecimal(e.target.value)
        return display_value
      } else {
        return e.target.value
      }
    })
  }

  return <>
    <input 
      type={props.type} 
      min={props.min || 0}
      max={props.max || 1000}
      step={props.step || 1}
      onChange={updateValue} 
      value={display_value}
    />
    <div style="color:white">
      <div>{props.name}: {props.value}</div>
    </div>
  </>
}

function FilenameInput(props) {
  const updateFilename = (e) => {
    props.setFilename((_prev) => {
      return e.target.value
    });
  };

  return <input type="text" onInput={updateFilename}/>;
}

function FilenameInputDisplay(props) {
  return (
    <div style="color:white">
      <div>Filename: {props.filename}<span>.hpgl</span></div>
    </div>
  );
}


render(() => <App />, document.getElementById('app'))