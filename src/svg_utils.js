import { convertShapeToPath } from 'svgo-browser/plugins-list';
import { optimize } from 'svgo/dist/svgo.browser.js';

export const optimizeWithSVGO = (fileText) => {
    const optimized = optimize(fileText, {
      path: 'path-to.svg', // recommended
      multipass: true, // all other config fields are available here
      "plugins": [
        { 
          name: "convertShapeToPath",
          params: { 
              "convertArcs": true 
          } 
      }]
    });
  
    return optimized.data
  }
  