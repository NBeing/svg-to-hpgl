import './style.css';
import '../3rd-party/path-data-polyfill.js'
import { render } from 'solid-js/web';
import { createSignal, createEffect, onMount, Show } from "solid-js";
import {
  prepareHPGLFromSVG,
  getCommandsFromSVG,
  parseHPGLAndDrawToCanvas,
  PLOTTER_X_MAX,
  PLOTTER_Y_MAX
} from './plotter_utils'
import { optimizeWithSVGO } from './svg_utils'
import { SVG, Timeline } from '@svgdotjs/svg.js'
import plotterImg from '../assets/plotter7440a-2.svg'
// import plotterImg from '../assets/test_shape.svg'

import textCommands from './textcmds.js'
import plotterCommands from './plottercmds.js'

function App() {
  let outputCanvas
  let bannerRef
  let inputCanvasDrawRef
  let hpglCanvas

  const [inputSvg, setInputSvg] = createSignal()
  const [inputHpgl, setInputHpgl] = createSignal()

  const [showHpglViewer, setShowHpglViewer] = createSignal(false)
  const [svgDraw, setSvgDraw] = createSignal(false)
  const [helpText, setHelpText] = createSignal()

  const [helpAnimation, setHelpAnimation] = createSignal('')

  const [rawSvgInputString, setRawSvgInputString] = createSignal()
  const [optimizedSvgInputString, setOptimizedSvgInputString] = createSignal()
  const [inputSvgViewbox, setInputSvgViewbox] = createSignal()

  const [outputScale, setOutputScale] = createSignal(1)
  const [outputX, setOutputX] = createSignal(0)
  const [outputY, setOutputY] = createSignal(0)

  const [filename, setFilename] = createSignal("")
  const [hpglBlob, setHpglBlob] = createSignal()
  const [downloadUrl, setDownloadUrl] = createSignal()

  const [rawCommands, setRawCommands] = createSignal()
  const reinitialize = () => {
    setInputSvg()
    setHpglBlob()
    setOutputScale(1)
    setOutputX(0)
    setOutputY(0)
    setInputSvgViewbox()
    setRawSvgInputString()
    setOptimizedSvgInputString()
  }
  createEffect(() => {
    if (inputHpgl() && hpglCanvas) {
      window.scrollTo(0, 800);
      setShowHpglViewer(true)
    }
  })
  createEffect(() => {
    if (inputSvg()) {
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
    }
  });
  createEffect(() => {
    if (inputSvgViewbox() && inputSvg()) {
      window.scrollTo(0, 800);
      let { blob, raw_commands } = prepareHPGLFromSVG(outputScale(), [outputX(), outputY()], inputSvg().img, outputCanvas, rawSvgInputString(), optimizedSvgInputString(), inputSvgViewbox())
      setRawCommands(raw_commands)
      setHpglBlob(blob)
    }

    // we will redraw the output whenever these things are changed
    [outputScale(), outputX(), outputY(), rawSvgInputString(), optimizedSvgInputString()]
  })
  createEffect(() => {
    if (hpglBlob()) {
      setDownloadUrl(URL.createObjectURL(hpglBlob()))
    }
  })
  return (
    <>
      <Banner ref={bannerRef} setSvgDraw={setSvgDraw} helpText={helpText()}></Banner>
      <div class="flex flex-column p-4 items-center align-middle justify-center">
        <div>
          <SVGButton ref={bannerRef}></SVGButton>
        </div>

        <div>
          <ImageLoader
            setSvg={setInputSvg}
            setRawSvgInputString={setRawSvgInputString}
            setFilename={setFilename}
            setHelpAnimation={setHelpAnimation}
            reinitialize={reinitialize}
          />
        </div>
        <div>
          <HpglLoader
            setHpgl={setInputHpgl}
            reinitialize={reinitialize}
            setFilename={setFilename}
          />
        </div>
      </div>
      <Show when={inputHpgl()}>
        <div class="flex">
          <Show when={showHpglViewer()}>
            <HpglViewer hpgl={inputHpgl()} canvas={hpglCanvas}></HpglViewer>
          </Show>
          <Canvas id={"hpgl_preview"} ref={hpglCanvas} canvasSize={[382, 545]} setHpgl={setInputHpgl} />
        </div>

      </Show>
      <Show when={inputSvg()}>
        <AppContainer>
          <div class="flex flex-row w-full justify-around">
            <FilenameInput filename={filename()} setFilename={setFilename} />
            <DownloadButton
              blob={hpglBlob()}
              filename={filename()}
              url={downloadUrl()}
            />
          </div>
          <div class="flex flex-row justify-center" >
            <div
              id="controls_container"
              class="
                dark:bg-transparent
                dark:text-white
                justify-evenly
                m-8
                border
                border-white
                rounded-2xl
                p-8
                "
            >
              <GenericInput
                name="output scale"
                type={"number"}
                value={outputScale()}
                setValue={setOutputScale}
                min={0.01}
                max={10}
                step={0.1}
                defaultValue={1.0}
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
              <Show when={hpglBlob()} fallback={<h2></h2>}>
                <DrawInput ref={inputCanvasDrawRef} commands={rawCommands()}></DrawInput>
              </Show>
            </div>
            <div id="plotter_canvas_container" class="flex m-8 p-8 border border-white rounded-2xl">
              <Canvas id={"print_preview"} ref={outputCanvas} canvasSize={[382, 545]} />
            </div>
          </div>
        </AppContainer>
      </Show>
      <Footer></Footer>
    </>
  );
}
function Footer(props) {
  return (
    <div
      class="flex flex-col border w-full h-40"
      style="align-items: center;
            justify-content: center;
            margin: auto;"
    >
      {props.children}
      <h1 class="text-white">This is the footer text</h1>
    </div>

  )
}
function AppContainer(props) {
  return (
    <div
      class="flex flex-col border border-white border-solid rounded-2xl p-8"
      style="width: 85%;
            align-items: center;
            justify-content: center;
            margin: auto;"
    >
      {props.children}
    </div>
  )
}

function DrawInput(props) {
  let width = PLOTTER_X_MAX / 30
  let height = PLOTTER_Y_MAX / 30
  onMount(() => {
    if (props.commands) {
      const numCommands = props.commands.length
      const targetDuration = 100
      const tick = targetDuration / numCommands
      let commands = props.commands.map(x => ({ ...x, x: x.x / 50, y: x.y / 50 }))
      let draw = SVG().addTo(props.inputCanvasDrawRef).size("100%", "100%")

      let timeline = new Timeline()
      let els = []
      for (let i = 1; i < commands.length; i++) {
        if (commands[i].pen == true) {
          let pl = draw.polyline([
            [commands[i - 1].x, commands[i - 1].y],
            [commands[i - 1].x, commands[i - 1].y]
          ])
          pl.timeline(timeline)
          pl.stroke({ color: '#820000', width: 0 })
          pl.animate(tick, i * tick, "now").plot([
            [commands[i - 1].x, commands[i - 1].y],
            [commands[i].x, commands[i].y]
          ]).stroke({ width: 1 })
          els.push(pl)
        }
      }
    }
  })
  return (
    <div class="banner-wrap mt-8" style={
      `
      display:flex; 
      width:${width}px;
      height: ${height}px;
      align-self: center;
      `
    }
    >
      <div ref={props.inputCanvasDrawRef} class=""
        style={`
        display:flex; 
        width:${width}px;
        height: ${height}px;
        background-color: rgba(0, 0, 0, 0.0); 
        `}
      ></div>
    </div>
  )
}

function Banner(props) {
  let draw, 
      textsvggroup,
      paper,
      timeline,
      svgHelpButton,
      hpglHelpButton,
      hpglHelpTextGroup,
      svgHelpTextGroup,
      svgHelpButtonGroup,
      hpglHelpButtonGroup

  const [bannerRef, setBannerRef] = createSignal(null)
  const [helpText, setHelpText] = createSignal(null) 

  createEffect(()=>{
    if(!helpText()){
      return
    }
    textsvggroup.clear()
    paper = textsvggroup.rect().fill('#000').stroke({ color: "#f00", width: 1 })
    let textEls = helpText().map((text) => {
      return textsvggroup.text(add => {
        add.tspan(`${text}`).newLine()
      })
    })

    let processedEls = []
    let elapsedTime = 0

    

    textsvggroup.animate(1, 1, "now").queue(() => {
      for (let i = textEls.length - 1; i > -1; i--) {
        textEls[i].timeline(timeline)
        textEls[i].animate(1, elapsedTime + ((textEls.length - 1 - i) * 200), "now").queue(() => {
          textEls[i].stroke({ width: 1, color: "#f00" }).font({ size: 14 }).dx(383).dy(460)
          processedEls.push(textEls[i])
          processedEls.forEach(el => {
            el.dy(20)
          })
          paper.size(430, (10 + (textEls.length - i) * 20)).move(378, 455)
        })
      }
    }).animate(1, elapsedTime + (textEls.length) * 200, "last").queue(() => {
    })

    ;[helpText()]
  })
  onMount(() => {
    const plot = getCommandsFromSVG(1.0, [0, 0], plotterImg)
    let textCmds = textCommands
    let cmds = plot
    const numCommands = cmds.length
    const targetDuration = 5000
    const tick = targetDuration / numCommands
    const textTick = 0.1
    const scaling = 1 / 4

    draw = SVG().addTo(bannerRef()).size("100%", "100%")
    props.setSvgDraw(() => {
      hpglHelpButtonGroup = draw.group()
      hpglHelpTextGroup = draw.group()

      return draw
    })
    timeline = new Timeline()
    const translatePlotter = [-80, -100]

    let commands = cmds.map(cmd => ({
      ...cmd,
      x: cmd.x * scaling + translatePlotter[0],
      y: cmd.y * scaling + translatePlotter[1]
    }))

    let marker = draw.polyline([
      [commands[0].x - 5, commands[0].y],
      [commands[0].x + 5, commands[0].y],
      [commands[0].x + 5, commands[0].y - 10],
      [commands[0].x - 5, commands[0].y - 10],
      [commands[0].x - 5, commands[0].y],
    ])
    marker.timeline(timeline)
    marker.stroke({ color: '#00FF00', width: 1 })

    for (let i = 1; i < commands.length; i++) {
      if (commands[i].pen == true) {
        marker.animate(tick, i * tick, "now").plot([
          [commands[i].x - 5, commands[i].y],
          [commands[i].x + 5, commands[i].y],
          [commands[i].x + 5, commands[i].y - 20],
          [commands[i].x - 5, commands[i].y - 20],
          [commands[i].x - 5, commands[i].y],

        ]).stroke({ width: 1 })

        let pl = draw.polyline([
          [commands[i - 1].x, commands[i - 1].y],
          [commands[i - 1].x, commands[i - 1].y]
        ])
        pl.timeline(timeline)
        pl.stroke({ color: '#f00', width: 0 })
        pl.animate(tick, i * tick, "now").plot([
          [commands[i - 1].x, commands[i - 1].y],
          [commands[i].x, commands[i].y]
        ]).stroke({ width: 1 })
      }
    }

    marker.animate(1000, commands.length * tick, "now").plot([
      [commands[commands.length - 1].x - 5, commands[commands.length - 1].y],
      [commands[commands.length - 1].x + 5, commands[commands.length - 1].y],
      [commands[commands.length - 1].x + 5, commands[commands.length - 1].y - 20],
      [commands[commands.length - 1].x - 5, commands[commands.length - 1].y - 20],
      [commands[commands.length - 1].x - 5, commands[commands.length - 1].y],
    ]).stroke({ width: 0 })

    
    textsvggroup = draw.group()
    paper = textsvggroup.rect().fill('#000').stroke({ color: "#f00", width: 1 })

    const textArr = [
      'Hello welcome to the HP7440A HPGL Print Preview\n',
      '',
      'This tool will make it easier to work with me!\n',
      'There are two of the difficult aspects of\n',
      'plotting with the HP7440A.\n',
      '',
      'First, if you simply wish to print an image\n',
      'you must learn a lot about me and how I work.\n',
      'you must then draw what you wish line by line\n',
      'and generate an HPGL file by hand',
      '',
      'If you simply wish to print something fun\n',
      'I can help by converting an SVG image to HPGL',
      '\n',
      'If you are a true power user and are generating\n',
      'a bespoke HPGL file, oftentimes you must print',
      'many debug prints in order to see whether you\'ve',
      'got the result you\'d like.',
      'This is because the plotter scale and x,y ',
      'positioning are not intuitive and requires ',
      'reading the loooong scan of the 1970\'s manual',
      '',
      'This tool can help!\n',
      'I will automatically scale the HPGL file output',
      'and show you what it will look like on',
      '8.5 x 11 (A4) paper\n',
    ]
    let textEls = textArr.map((text) => {
      return textsvggroup.text(add => {
        add.tspan(`${text}`).newLine()
      })
    })

    let processedEls = []
    let elapsedTime = (tick * commands.length) + 1000 + (textCmds.length * textTick)

    textsvggroup.animate(1, 1, "now").queue(() => {
      for (let i = textEls.length - 1; i > -1; i--) {
        textEls[i].timeline(timeline)
        textEls[i].animate(1, elapsedTime + ((textEls.length - 1 - i) * 200), "now").queue(() => {
          textEls[i].stroke({ width: 1, color: "#f00" }).font({ size: 14 }).dx(383).dy(460)
          processedEls.push(textEls[i])
          processedEls.forEach(el => {
            el.dy(20)
          })
          paper.size(430, (10 + (textEls.length - i) * 20)).move(378, 455)
        })
      }
    }).animate(1, elapsedTime + (textEls.length) * 200, "last").queue(() => {
      svgHelpButtonGroup = draw.group()
      hpglHelpButtonGroup = draw.group()
      svgHelpTextGroup = draw.group()
      hpglHelpTextGroup = draw.group()

      let svgHelpButton = svgHelpButtonGroup
        .rect(150, 100)
        .fill("#000")
        .dx(150)
        .dy(200)
        .stroke({width: 3, color: "#f00"})
        .radius(10)
        
      svgHelpTextGroup.text(add => {
        add.tspan("SVG").stroke({color: '#f00', width: 1}).font({size:48}).dx(170).dy(270)
      })
      svgHelpButton.mouseenter(() => {
        const textArr = [
          'Hello welcome to the HP7440A HPGL Print Preview\n',
          '',
          'I am the SVG Helper',
          'flex flex flex',
        ]
        setHelpText(textArr)
      })
      svgHelpButton.click(() => {
        console.log("Cleecker")
        window.file_label.click()
      })
      svgHelpTextGroup.click(() => {
        console.log("Cleecker")
        window.file_label.click()
      })

      let hpglHelpButton = hpglHelpButtonGroup
        .rect(150, 100)
        .dx(850)
        .dy(200)
        .stroke({width: 3, color: "#f00"})
        .radius(10)

      hpglHelpTextGroup.text(add => {
        add.tspan("HPGL").stroke({color: '#f00', width: 2}).font({size:48}).dx(865).dy(260)
      })
      hpglHelpButton.click(() => {
        console.log("Cleecker")
        window.hpgl_label.click()
      })
      hpglHelpTextGroup.click(() => {
        console.log("Cleecker")
        window.hpgl_label.click()
      })

      hpglHelpButton.mouseenter(() => {
        const textArr = [
          'Hello welcome to the HP7440A HPGL Print Preview\n',
          '',
          'I am the HPGL Helper',
          'flex flex flex',
        ]
        setHelpText(textArr)
      })
    })
  })
  const handleRef = (ref) => {
    console.log("Ref!", ref)
    setBannerRef(ref)
  }

  return (
    <div class="banner-wrap mt-8 p-10" style="
      position:relative;
      display:flex; 
      width:1200px;
      height: 1100px;
    "
    >
      <div ref={handleRef} class=""
        style="
          background-color: rgba(0, 0, 0, 0.0); 
          width:1060px;
          height:987px;"
      ></div>
    </div>
  )
}

function DownloadButton(props) {
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
      <button
        download={props.filename}
        href={props.downloadUrl}
        onClick={_onClick}
        class="block rounded-2xl w-full-sm p-4 text-gray-900 border border-gray-300 bg-gray-50 text-base focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 align-middle"
      > Download </button>
    </>
  )
}
function Canvas(props) {
  const [width, height] = props.canvasSize || [382, 545]
  let styles = `height: ${height}px; width: ${width}px;`
  return (
    <canvas
      id={props.id}
      ref={props.ref}
      style={styles}
    />
  )
}
function SVGButton(props) {
  let width = PLOTTER_X_MAX / 30
  let height = PLOTTER_Y_MAX / 30
  onMount(() => {
    console.log("Mounted svgbutton", props.bannerRef)
    let draw = SVG().addTo(props.bannerRef).size("100%", "100%",)
    draw.rect(100, 500).fill("#fff").dx(100).dy(600)
  })
  return (<>
  </>)
}
function ImageLoader(props) {
  const updateValue = (e) => {

    try {
      props.reinitialize()
      let img = new Image();
      let reader = new FileReader();
      reader.onload = (event) => {
        let rawSvgString = event.target.result
        img.onload = function () {
          props.setSvg((_prev) => {

            return { img }
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
          let filename = `${e.target.files[0].name.split(".")[0]}`
          console.log("Setting filename", filename)
          return filename
        } catch (e) {
          console.error("Couldn't parse filename, setting to default!")
          return "couldnt_retrieve_filename"
        }
      })
    } catch (e) {
      console.log("Encountered error", e)
    }
  }
  const onCancel = (e) => {
    console.log("File upload was cancelled")
  }
  const hoverBehavior = () => {
    props.setHelpAnimation("something")
  }
  return (
    <>
      <div class="flex justify-center flex-col">
        <label for="files_"
          id="file_label"
          style="display:none;"
          class="
            flex-1 
            font-mono 
            block 
            mb-2 
            text-2xl 
            font-semibold
          text-gray-900
          dark:text-white
            border-solid
          border-white
            border
            p-4 
            rounded-2xl
          "
          onMouseOver={hoverBehavior}>
          Please Upload an SVG to get started!
          <input
            id="files_"
            type={"file"}
            accept={".svg"}
            onChange={updateValue}
            onCancel={onCancel}
            style="display:none;"
            class="
              font-mono
              block 
              w-full-sm 
              p-8 
              rounded-lg  
              focus:ring-blue-500 
              focus:border-blue-500 
              dark:border-white
              dark:bg-transparent
              dark:text-white 
              dark:focus:ring-blue-500 
              dark:focus:border-blue-500
              dark:border-2
            "
          />
        </label>
      </div>
    </>
  )
}
function HpglLoader(props) {
  const updateValue = (e) => {
    try {
      props.reinitialize()
      let reader = new FileReader();
      reader.onload = (event) => {
        let rawHpglString = event.target.result
        // console.log("Raw hpgl string", rawHpglString)
        props.setHpgl((_prev) => {
          return rawHpglString
        });
      }
      // this retrieves the raw text of the file
      reader.readAsText(e.target.files[0]);
      props.setFilename((_prev) => {
        try {
          let filename = `${e.target.files[0].name.split(".")[0]}`
          return filename
        } catch (e) {
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
      <div class="flex justify-center flex-col">
        <label for="files"
          id="hpgl_label"
          style="display:none;"
          class="
            flex-1 
            font-mono 
            block 
            mb-2 
            text-2xl 
            font-semibold
          text-gray-900
          dark:text-white
            border-solid
          border-white
            border
            p-4 
            rounded-2xl
          ">
          Please Upload an HPGL to get started!
          <input
            id="files"
            type={"file"}
            accept={".hpgl"}
            onChange={updateValue}
            onCancel={onCancel}
            style="display:none;"
            class="
              font-mono
              block 
              w-full-sm 
              p-8 
              rounded-lg  
              focus:ring-blue-500 
              focus:border-blue-500 
              dark:border-white
              dark:bg-transparent
              dark:text-white 
              dark:focus:ring-blue-500 
              dark:focus:border-blue-500
              dark:border-2
            "
          />
        </label>
      </div>
    </>
  )
}
function HpglViewer(props) {
  const ctx = props.canvas.getContext("2d")
  ctx.canvas.height = PLOTTER_X_MAX / 20
  ctx.canvas.width = PLOTTER_Y_MAX / 20

  parseHPGLAndDrawToCanvas(props.hpgl, 1 / 20, [0, 0], ctx, props.canvas)
  let newHpgl = props.hpgl.replace(/\s/g, '')
  newHpgl = newHpgl.replace(/\;/g, ';\n');;

  return (
    <div class="text-white" style="overflow:scroll; height: 400px;white-space: pre-wrap;">{newHpgl}</div>
  )
}

function GenericInput(props) {
  let display_value = props.defaultValue || 0.0
  const updateValue = (e) => {
    props.setValue((_prev) => {
      if (props.type == "number") {
        let parsed = parseFloat(parseFloat(e.target.value).toFixed(2))
        display_value = parsed
        return parsed
      } else {
        return e.target.value
      }
    })
  }

  return <>
    <div class="flex flex-row items-center justify-evenly">
      <div class="font-mono font-semibold text-2xl basis-1/2">{props.name}</div>
      <input
        class="m-2 text-xl basis-1/4"
        type={props.type}
        min={props.min || 0}
        max={props.max || 1000}
        step={props.step || 1}
        onChange={updateValue}
        value={display_value}
      />
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
      <div class="flex flex-row items-center w-full text-white mr-4">
        <input
          type="text"
          onInput={updateFilename}
          value={props.filename}
          class="rounded-2xl align-middle text-2xl border border-white border-solid p-2 w-full"
        />
      </div>
    </>
  )
}

render(() => <App />, document.getElementById('app'))