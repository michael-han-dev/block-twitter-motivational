const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');
const isDev = process.argv.includes('--dev');

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Copy static files
function copyStaticFiles() {
  // Copy manifest.json
  if (fs.existsSync('src/manifest.json')) {
    fs.copyFileSync('src/manifest.json', 'dist/manifest.json');
  } else if (fs.existsSync('manifest.json')) {
    fs.copyFileSync('manifest.json', 'dist/manifest.json');
  }
  
  // Copy CSS files
  if (fs.existsSync('src/content/content.css')) {
    fs.copyFileSync('src/content/content.css', 'dist/content.css');
  }
  
  // Copy icons
  if (fs.existsSync('assets/icons')) {
    if (!fs.existsSync('dist/icons')) {
      fs.mkdirSync('dist/icons');
    }
    const icons = fs.readdirSync('assets/icons');
    icons.forEach(icon => {
      fs.copyFileSync(`assets/icons/${icon}`, `dist/icons/${icon}`);
    });
  }
}

const buildOptions = {
  entryPoints: [
    'src/background/background.ts',
    'src/content/content.ts'
  ],
  bundle: true,
  outdir: 'dist',
  platform: 'browser',
  target: 'chrome88',
  format: 'iife',
  sourcemap: isDev,
  minify: !isDev,
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
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