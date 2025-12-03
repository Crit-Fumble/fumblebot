import path from 'path';
import { fileURLToPath } from 'url';
import CopyPlugin from 'copy-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: {
      // Background service worker
      background: './src/extension/background.ts',

      // Popup UI
      popup: './src/extension/popup/index.tsx',

      // Content scripts for each VTT platform
      'content/roll20': './src/extension/content/roll20.ts',
      'content/dndbeyond': './src/extension/content/dndbeyond.ts',
      'content/foundry': './src/extension/content/foundry.ts',
      'content/cypher-tools': './src/extension/content/cypher-tools.ts',
      'content/5etools': './src/extension/content/5etools.ts',

      // Library bundle (for npm package)
      index: './src/index.ts',
    },

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
    },

    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            'postcss-loader',
          ],
        },
      ],
    },

    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },

    plugins: [
      new MiniCssExtractPlugin({
        filename: 'styles.css',
      }),

      new CopyPlugin({
        patterns: [
          // Copy manifest
          {
            from: 'manifest.json',
            to: 'manifest.json',
          },
          // Copy popup HTML
          {
            from: 'src/extension/popup/popup.html',
            to: 'popup.html',
          },
          // Copy icons (create placeholder if not exists)
          {
            from: 'icons',
            to: 'icons',
            noErrorOnMissing: true,
          },
        ],
      }),
    ],

    // Generate source maps for development
    devtool: isProduction ? false : 'cheap-module-source-map',

    // Don't bundle these - they're provided by the browser
    externals: {
      chrome: 'chrome',
    },

    optimization: {
      // Don't minimize content scripts to help with debugging VTT integration
      minimize: isProduction,
    },
  };
};
