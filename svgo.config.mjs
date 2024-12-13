export default {
    multipass: false, // boolean
    datauri: 'base64', // 'base64'|'enc'|'unenc'
    js2svg: {
      indent: 4, // number
      pretty: false, // boolean
    },
    plugins: [
      'preset-default', // built-in plugins enabled by default
      'prefixIds', // enable built-in plugins by name
  
      // enable built-in plugins with an object to configure plugins
      {
        name: 'prefixIds',
        params: {
          prefix: 'uwu',
        },
      },
    ],
  };