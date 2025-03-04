import { render } from 'solid-js/web';
import { createSignal, createEffect } from "solid-js";
import { prepareHPGLFromSVG } from './plotter_utils'
import { optimizeWithSVGO } from './svg_utils'

const redrawCanvas = (_img, _canvas, viewBox ) => {
  let _ctx = _canvas.getContext("2d")
  let splitbox = viewBox.split(" ").map(str => parseFloat(str))
  _ctx.canvas.width = splitbox[2]
  _ctx.canvas.height = splitbox[3]
  _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
  _ctx.fillStyle = "#FFF";
  _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
  _img.width = splitbox[2]
  _img.height = splitbox[3]
  _ctx.drawImage(_img, 0,0, _img.width, _img.height);
}

function App() {
  let inputCanvas
  let outputCanvas
  
  const [inputSvg , setInputSvg] = createSignal()
  const [rawSvgInputString , setRawSvgInputString] = createSignal()
  const [optimizedSvgInputString , setOptimizedSvgInputString] = createSignal()
  const [inputSvgViewbox , setInputSvgViewbox] = createSignal()  
  
  const [outputScale, setOutputScale] = createSignal(1)
  const [outputX, setOutputX] = createSignal(0)
  const [outputY, setOutputY] = createSignal(0)
  
  const [filename, setFilename] = createSignal("")
  const [hpglBlob, setHpglBlob] = createSignal()
  const [downloadUrl, setDownloadUrl] = createSignal()
  const [showOriginal, setShowOriginal] = createSignal()

  createEffect(() => {
    if(inputSvg()){
      // when we set the input svg that means we've loaded a file
      // we now draw the svg and set the context
      let parser = new DOMParser();
      let optimizedSVGString = optimizeWithSVGO(rawSvgInputString())

      setOptimizedSvgInputString(optimizedSVGString)
      let doc = parser.parseFromString(`${optimizedSVGString}`, "image/svg+xml");
      let viewbox = doc.children[0].getAttribute("viewBox")
      if (!viewbox) {
        console.error("Could not determine viewbox! falling back to width / height")
        setInputSvgViewbox(`0 0 ${inputSvg().img.width} ${inputSvg().img.height}`)
      } else {
        setInputSvgViewbox(viewbox)
      }
      if(inputCanvas){
        redrawCanvas(inputSvg().img, inputCanvas, inputSvgViewbox(), rawSvgInputString())
      }
    }
  });
  createEffect(() => {
    if(inputSvgViewbox()){
      let blob = prepareHPGLFromSVG(outputScale(), [outputX(), outputY()], inputSvg().img, outputCanvas, rawSvgInputString(), optimizedSvgInputString())
      setHpglBlob(blob)
    }
    // we will redraw the output whenever these things are changed
    [outputScale(), [outputX(), outputY()], rawSvgInputString(), optimizedSvgInputString()]
  })
  createEffect(() => {
    if(hpglBlob()){
      setDownloadUrl(URL.createObjectURL(hpglBlob()))
    }
  })
  createEffect(() => {
    if(showOriginal()){
      redrawCanvas(inputSvg().img, inputCanvas, inputSvgViewbox())
    }
  })

  return (
    <>
      <ImageLoader 
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
          <GenericInput name="output x"  
            type={"number"} 
            value={outputX()} 
            setValue={setOutputX}
            min={-100000}
          />
          <GenericInput name="output y"  
            type={"number"} 
            value={outputY()} 
            setValue={setOutputY}
            min={-100000}
          />
          <FilenameInput filename={filename()} setFilename={setFilename} />
          </div>
          <div class="canvases">
              <ShowOriginalToggle setIsShowing={setShowOriginal} isShowing={showOriginal()}/>
            <Show when={showOriginal()}>
              <Canvas id={"input"} ref={inputCanvas} />
            </Show> 
            <Canvas id={"print_preview"} ref={outputCanvas} />
          </div>
      </Show>
    </>
  );
}

function ShowOriginalToggle(props){
  const _onClick = () => {
    props.setIsShowing(!props.isShowing)
  }
  return (
    <Show 
      when={props.isShowing === true}
      fallback={<button onClick={_onClick}>Show Original SVG</button>}
    >
      <button onClick={_onClick}>Hide Original SVG</button>
    </Show>
  )
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
     <input type={"file"} accept={".svg"} onChange={updateValue} onCancel={onCancel}/>
    </>
  )
}

function GenericInput(props) {
  let display_value = 0.0
  const updateValue = (e) => {
    props.setValue((_prev) => {
      if(props.type == "number"){
        return parseFloat(parseFloat(e.target.value).toFixed(2))
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
    })
  };

  return (
    <>
      <p>Filename: {props.filename}<span>.hpgl</span></p>
      <input type="text" onInput={updateFilename} value={props.filename}/>
    </>
  )
}



render(() => <App />, document.getElementById('app'))