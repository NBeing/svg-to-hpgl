const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');


module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: {
    main: path.resolve(__dirname, './src/index.js')
  },
  output: {
    path: path.resolve(__dirname, './dist'),
    filename: '[name].bundle.js'
  },
  watchOptions: {
    poll: 1000 // hack for wsl
  },
  devServer: {
        static: {
            directory: path.join(__dirname, 'dist')
        },
        compress:false,
        port: 8000,
  },
  module: {
    rules: [
        { test: /\.(glsl|vs|fs|vert|frag|svg)$/, exclude: /node_modules/, use: [ 'raw-loader' ]},
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                presets: ['@babel/preset-env', 'solid'],
                plugins: ["@babel/plugin-transform-modules-commonjs"]
              },
            },
          ],
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader', 'postcss-loader'],
        },
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  plugins: [
    new NodePolyfillPlugin(),
    new HtmlWebpackPlugin({
        title: 'SVG to HPGL',
        template: path.resolve(__dirname, './src/index.html'),
        inject: 'body'
    })
],
};
