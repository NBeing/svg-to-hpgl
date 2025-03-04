import { optimize } from 'svgo/dist/svgo.browser.js';

export const optimizeWithSVGO = (fileText) => {
    const optimized = optimize(fileText, {
      path: 'path-to.svg', // recommended
      multipass: true, // all other config fields are available here
    });
  
    return optimized.data
  }
  