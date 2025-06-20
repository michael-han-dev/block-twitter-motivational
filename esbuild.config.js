const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');
const isDev = process.argv.includes('--dev');

if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

function copyStaticFiles() {
  if (fs.existsSync('src/manifest.json')) {
    fs.copyFileSync('src/manifest.json', 'dist/manifest.json');
  } else if (fs.existsSync('manifest.json')) {
    fs.copyFileSync('manifest.json', 'dist/manifest.json');
  }
  
  if (fs.existsSync('src/content/content.css')) {
    fs.copyFileSync('src/content/content.css', 'dist/content.css');
  }
  
  if (fs.existsSync('src/popup/popup.html')) {
    fs.copyFileSync('src/popup/popup.html', 'dist/popup.html');
  }
}

const buildOptions = {
  entryPoints: {
    'background': 'src/background/background.ts',
    'content': 'src/content/content.ts',
    'popup': 'src/popup/popup.ts'
  },
  bundle: true,
  outdir: 'dist',
  platform: 'browser',
  target: 'chrome88',
  format: 'iife',
  sourcemap: isDev,
  minify: !isDev,
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
    'DEBUG': isDev ? 'true' : 'false'
  },
  plugins: [
    {
      name: 'copy-static',
      setup(build) {
        build.onEnd(() => {
          copyStaticFiles();
          console.log('✅ Static files copied');
        });
      },
    },
  ],
};

async function build() {
  try {
    if (isWatch) {
      const context = await esbuild.context(buildOptions);
      await context.watch();
      console.log('👀 Watching for changes...');
    } else {
      await esbuild.build(buildOptions);
      console.log('✅ Build completed');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build(); 