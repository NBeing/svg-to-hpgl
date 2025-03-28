import './style.css';

import { render } from 'solid-js/web';
import { createSignal, createEffect, onMount, Show } from "solid-js";
import { 
  prepareHPGLFromSVG,
  getCommandsFromSVG,
  PLOTTER_X_MAX,
  PLOTTER_Y_MAX
} from './plotter_utils'
import { optimizeWithSVGO } from './svg_utils'
import { SVG, Timeline } from '@svgdotjs/svg.js'
import plotterImg from '../assets/plotter7440a-2.svg'
import testText from '../assets/text-test.svg'
import  textCommands from './textcmds.js'
import  plotterCommands from './plottercmds.js'

function App() {
  let outputCanvas
  let bannerRef
  let inputCanvasDrawRef

  const [inputSvg, setInputSvg] = createSignal()
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
  function reinitialize(){
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
      let { blob, raw_commands } = prepareHPGLFromSVG(outputScale(), [outputX(), outputY()], inputSvg().img, outputCanvas, rawSvgInputString(), optimizedSvgInputString(), inputSvgViewbox())
      setRawCommands(raw_commands)
      setHpglBlob(blob)
    }
    
    // we will redraw the output whenever these things are changed
    [outputScale(), [outputX(), outputY()], rawSvgInputString(), optimizedSvgInputString()]
  })
  createEffect(() => {
    if (hpglBlob()) {
      setDownloadUrl(URL.createObjectURL(hpglBlob()))
    }
  })
  return (
    <>
      <Banner ref={bannerRef}></Banner>
      <div class="flex flex-column p-4 items-center align-middle justify-center">
        <ImageLoader
          setSvg={setInputSvg}
          setRawSvgInputString={setRawSvgInputString}
          setFilename={setFilename}
          reinitialize={reinitialize}
        />
      </div>
        <Show when={inputSvg()}>
          <AppContainer>
            <div class="flex flex-row">
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
              <Show when={hpglBlob()} fallback={<h2>LOL</h2>}>
                <DrawInput ref={inputCanvasDrawRef} commands={rawCommands()}></DrawInput>

              </Show>
            </div>
            <div id="plotter_canvas_container" class="flex m-8 p-8 border border-white rounded-2xl">
              <Canvas id={"print_preview"} ref={outputCanvas} canvasSize={[382,545]} />
            </div>
          </div>
      </AppContainer>
        </Show>
    </>
  );
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

function clamp(num, min, max) {
  return Math.max(Math.min(num, max), min);
}
function randomBetweenOneAndNegativeOne() {
  let seed = Math.random()
  let should_be_negative = Math.random() > 0.5
  if (should_be_negative) {
    return seed * -1
  } else {
    return seed
  }
}
function DrawInput(props) {
  let width = PLOTTER_X_MAX / 30 
  let height = PLOTTER_Y_MAX / 30
  onMount(() => {    
    if (props.commands) {
      const numCommands = props.commands.length
      const targetDuration = 8000
      const tick = targetDuration / numCommands
      let commands = props.commands.map(x => ({ ...x, x: x.x / 50, y: x.y / 50 }))
      // console.log("Commands post", commands)
      let draw = SVG().addTo(props.inputCanvasDrawRef).size("100%", "100%",)
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

function drawText( _config){
  let { draw, translation, group, timeline, duration, tick, commands, color } = _config
  group = draw.group()
  group.timeline(timeline)
  for (let i = 1; i < commands.length; i++) {
    if (commands[i].pen == true) {
      let textsvg = group.polyline([
        [commands[i - 1].x, commands[i - 1].y],
        [commands[i - 1].x, commands[i - 1].y]
      ])
      textsvg.timeline(timeline)
      textsvg.stroke({ color, width: 0 })
      textsvg.animate(1, 1100 + (i * tick), "now").plot([
        [commands[i - 1].x + translation.x, commands[i - 1].y + translation.y],
        [commands[i].x + translation.x, commands[i].y + translation.y]
      ]).stroke({ width: 1 })
    }
  }
  return group
}
function Banner(props) {

  onMount(() => {
    let textCmds = textCommands
    let cmds = plotterCommands
    const numCommands = cmds.length
    const targetDuration = 2000
    const tick = targetDuration / numCommands
    const scaling = 1 / 4
    const translatePlotter = [-100,-100]
    let commands = cmds.map(cmd => ({ 
      ...cmd, 
      x: cmd.x * scaling + translatePlotter[0],
      y: cmd.y * scaling +translatePlotter[1]
    }))
    let draw = SVG().addTo(props.bannerRef).size("100%", "100%",)
    let timeline = new Timeline()

    let marker = draw.polyline([
      [commands[0].x - 5, commands[0].y],
      [commands[0].x + 5, commands[0].y],
      [commands[0].x + 5, commands[0].y - 10],
      [commands[0].x - 5, commands[0].y - 10],
      [commands[0].x - 5, commands[0].y],
    ])
    marker.timeline(timeline)
    marker.stroke({ color: '#00FF00', width: 1 })

    let cnc = draw.polyline([
      [commands[0].x - 200, commands[0].y],
      [commands[0].x + 200, commands[0].y],
      [commands[0].x + 200, commands[0].y - 10],
      [commands[0].x - 200, commands[0].y - 10],
      [commands[0].x - 200, commands[0].y],

    ])
    cnc.timeline(timeline)
    cnc.stroke({ color: '#00FF00', width: 5 })

    for (let i = 1; i < commands.length; i++) {
      if (commands[i].pen == true) {
        marker.animate(tick, i * tick, "now").plot([
          [commands[i].x - 5, commands[i].y],
          [commands[i].x + 5, commands[i].y],
          [commands[i].x + 5, commands[i].y - 20],
          [commands[i].x - 5, commands[i].y - 20],
          [commands[i].x - 5, commands[i].y],

        ]).stroke({ width: 1 })

        cnc.animate(tick, i * tick, "now").plot([
          [commands[i].x - 2005, commands[i].y - 20],
          [commands[i].x + 2005, commands[i].y - 20],
          [commands[i].x + 2005, commands[i].y - 40],
          [commands[i].x - 2005, commands[i].y - 40],
          [commands[i].x - 2005, commands[i].y - 20],

        ]).stroke({ width: 5 })

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
      }

    }
    cnc.animate(1000, commands.length * tick, "now").plot([
      [commands[commands.length - 1].x - 2005, commands[commands.length - 1].y - 20],
      [commands[commands.length - 1].x + 2005, commands[commands.length - 1].y - 20],
      [commands[commands.length - 1].x + 2005, commands[commands.length - 1].y - 40],
      [commands[commands.length - 1].x - 2005, commands[commands.length - 1].y - 40],
      [commands[commands.length - 1].x - 2005, commands[commands.length - 1].y - 20],
    ]).stroke({ width: 0 })

    marker.animate(1000, commands.length * tick, "now").plot([
      [commands[commands.length - 1].x - 5, commands[commands.length - 1].y],
      [commands[commands.length - 1].x + 5, commands[commands.length - 1].y],
      [commands[commands.length - 1].x + 5, commands[commands.length - 1].y - 20],
      [commands[commands.length - 1].x - 5, commands[commands.length - 1].y - 20],
      [commands[commands.length - 1].x - 5, commands[commands.length - 1].y],
    ]).stroke({ width: 0 })

    const textTick = 0.1
    // let textsvggroup = drawText({
    //   draw: draw,
    //   translation: { x : 240, y: 140 }, 
    //   group: nexttextsvggroup, 
    //   timeline: timeline, 
    //   duration: null, 
    //   tick: textTick, 
    //   commands: textCmds,
    //   color: '#f00'
    // })


    // let translateText = { x: 240, y: 140 }
    let textsvggroup = draw.group()
    // textsvggroup.timeline(timeline)
    // for (let i = 1; i < textCmds.length; i++) {
    //   if (textCmds[i].pen == true) {
    //     let textsvg = textsvggroup.polyline([
    //       [textCmds[i - 1].x, textCmds[i - 1].y],
    //       [textCmds[i - 1].x, textCmds[i - 1].y]
    //     ])
    //     textsvg.timeline(timeline)
    //     textsvg.stroke({ color: '#820000', width: 0 })
    //     textsvg.animate(textTick, targetDuration + (i * textTick), "now").plot([
    //       [textCmds[i - 1].x + translateText.x, textCmds[i - 1].y + translateText.y],
    //       [textCmds[i].x + translateText.x, textCmds[i].y + translateText.y]
    //     ]).stroke({ width: 1 })
    //   }
    // }
    function drawText2({ 
      draw, 
      translation, 
      group, 
      timeline, 
      duration, 
      tick, 
      commands, 
      color, 
      text 
    }){
      let textSvg = draw.text( add => {
        add.tspan(`${text}`).newLine()
      })
      return textSvg 
    }
    let paper = draw.rect().fill('#fff')

    const textArr = [
      'Hello welcome to the HP7440A HPGL Print Preview\n',
      '',
      'This tool will make it easier to work with me!\n',
      'There are two of the difficult aspects of plotting\n',
      'with the HP7440A.\n',
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
    let textEls = textArr.map( (text ) => {
      return draw.text( add => {
        add.tspan(`${text}`).newLine()
      })
    })
    
    let processedEls = []
    let elapsedTime = (tick * commands.length) + 1000 + (textCmds.length * textTick)

    textsvggroup.animate(1, 1, "now").queue(()=>{
        for (let i = textEls.length - 1; i > -1; i--) {
          console.log(i)
          textEls[i].timeline(timeline)
          textEls[i].animate(1, elapsedTime + ((textEls.length - 1 - i) * 200), "now").queue(() =>{
            textEls[i].stroke({ width: 1, color: "#000"}).font({ size: 14 }).dx(360).dy(460)
            processedEls.push(textEls[i])
            processedEls.forEach(el => {
              el.dy(20)
            })
            paper.size(430,  (10 + (textEls.length - i) * 20)).move(355, 455)
          })
        }
      })


    // let nexttextsvggroup;
    // textsvggroup.animate(1, elapsedTime, "now")
    //   .queue(() => {
    //     textsvggroup.dy(50)

    //     nexttextsvggroup = drawText2({
    //       draw: draw,
    //       translation: { x: 240, y: 140 },
    //       group: nexttextsvggroup,
    //       timeline: timeline,
    //       duration: null,
    //       tick: textTick,
    //       commands: textCmds,
    //       color: '#0f0'
    //     })
    //   })
    //   .animate(1, elapsedTime + (textCmds.length * textTick) + 1100, "now")
    //   .queue(() => {
    //     // console.log("But after too")
    //     // textsvggroup.dy(50)
    //     // nexttextsvggroup.dy(50)

    //     // nexttextsvggroup = drawText2({
    //     //   draw: draw,
    //     //   translation: { x: 240, y: 140 },
    //     //   group: nexttextsvggroup,
    //     //   timeline: timeline,
    //     //   duration: null,
    //     //   tick: textTick,
    //     //   commands: textCmds,
    //     //   color: '#00f'
    //     // })
    //     // nexttextsvggroup = draw.group()
    //     // nexttextsvggroup.timeline(timeline)
    //     // for (let i = 1; i < textCmds.length; i++) {
    //     //   if (textCmds[i].pen == true) {
    //     //     let textsvg = nexttextsvggroup.polyline([
    //     //       [textCmds[i - 1].x, textCmds[i - 1].y],
    //     //       [textCmds[i - 1].x, textCmds[i - 1].y]
    //     //     ])
    //     //     textsvg.timeline(timeline)
    //     //     textsvg.stroke({ color: '#00f', width: 0 })
    //     //     textsvg.animate(1, 1100 + (i * textTick), "now").plot([
    //     //       [textCmds[i - 1].x + translateText.x, textCmds[i - 1].y + translateText.y],
    //     //       [textCmds[i].x     + translateText.x, textCmds[i].y     + translateText.y]
    //     //     ]).stroke({ width: 1 })
    //     //   }
    //     // }
    //   })

    // // this will draw a random wave!!
    // // let draw = SVG().addTo(props.bannerRef).size("100%", "100%",)
    // // let timeline = new Timeline()
    // // let lines = [[0, 100]]
    // // let els = []
    // // for (let i = 1; i < 100; i++) {
    // //   let nextPoint = [
    // //     i * 20,
    // //     clamp(Math.round(randomBetweenOneAndNegativeOne() * 99), -100, 100) + 100,
    // //   ]
    // //   lines.push(nextPoint)
    // //   let pl = draw.polyline([lines[i - 1], lines[i - 1]])
    // //   pl.timeline(timeline)
    // //   pl.stroke({ color: '#82ffff', width: 0 })
    // //   pl.animate(50, i * 50, "now").plot([lines[i - 1], nextPoint]).stroke({ width: 8 })
    // //   els.push(pl)
    // // }
  })

  return (
    <div class="banner-wrap mt-8" style="
      position:relative;
      display:flex; 
      width:100%;
      height: 1000px
    "
    >
      <div ref={props.bannerRef} class=""
        style="
          background-color: rgba(0, 0, 0, 0.0); 
          width:100%;
          height:100%;"
      ></div>
      <div
        style="
          z-index: 10;
          position: absolute;
          left: 0; top: 0; right: 0; bottom: 0;
          width: 100%; height: 100%;
          flex-align: center; 
          flex-pack: center;
          display: flex;
          align-items:center;
          justify-content: center;
          clear: both; 
          background: rgba(0,0,0,0.3);
        "
      >
        {/* <h1
          class="text-9xl p-8 rounded-2xl flex justify-center align-middle"
          style="
            color: white;
              -webkit-text-fill-color: rgba(0,0,0,0.5);
              -webkit-text-stroke: 3px;
              border: 1px solid white;
            "
          >
            <span class="text-shadows">🎉 SVG → HPGL 🎉</span>
        </h1>  */}
      </div>
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
  const [ width, height ] = props.canvasSize || [382,545]
  let styles = `height: ${height}px; width: ${width}px;`
  return (
    <canvas
      id={props.id}
      ref={props.ref} 
      style={styles}
    />
  )
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
          Please Upload an SVG to get started!
          <input
            id="files"
            type={"file"}
            accept={".svg, .hpgl"}
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
          >
          </input>
        </label>
      </div>
    </>
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
    <div class="flex flex-row items-center justify-between text-white mr-4">
      <input
        type="text"
        onInput={updateFilename}
        value={props.filename}
        class="rounded-2xl align-middle text-2xl w-full border border-white border-solid p-2"
      />
    </div>
    </>
  )
}

render(() => <App />, document.getElementById('app'))