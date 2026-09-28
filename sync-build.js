import fs from 'fs';
import path from 'path';

try {
  // Ensure directories exist
  fs.mkdirSync('assets', { recursive: true });
  fs.mkdirSync('docs', { recursive: true });
  fs.mkdirSync('docs/assets', { recursive: true });
  fs.mkdirSync('dist/assets', { recursive: true });
  fs.mkdirSync('public', { recursive: true });

  // 1. Synchronize JS bundle
  if (fs.existsSync('dist/index.js')) {
    fs.copyFileSync('dist/index.js', 'dist/assets/index.js');
    fs.copyFileSync('dist/index.js', 'assets/index.js');
    fs.copyFileSync('dist/index.js', 'index.js');
    fs.copyFileSync('dist/index.js', 'docs/index.js');
    fs.copyFileSync('dist/index.js', 'docs/assets/index.js');
  } else if (fs.existsSync('dist/assets/index.js')) {
    fs.copyFileSync('dist/assets/index.js', 'dist/index.js');
    fs.copyFileSync('dist/assets/index.js', 'assets/index.js');
    fs.copyFileSync('dist/assets/index.js', 'index.js');
    fs.copyFileSync('dist/assets/index.js', 'docs/index.js');
    fs.copyFileSync('dist/assets/index.js', 'docs/assets/index.js');
  }

  // 2. Synchronize CSS bundle
  if (fs.existsSync('dist/index.css')) {
    fs.copyFileSync('dist/index.css', 'dist/assets/index.css');
    fs.copyFileSync('dist/index.css', 'assets/index.css');
    fs.copyFileSync('dist/index.css', 'index.css');
    fs.copyFileSync('dist/index.css', 'docs/index.css');
    fs.copyFileSync('dist/index.css', 'docs/assets/index.css');
  } else if (fs.existsSync('dist/assets/index.css')) {
    fs.copyFileSync('dist/assets/index.css', 'dist/index.css');
    fs.copyFileSync('dist/assets/index.css', 'assets/index.css');
    fs.copyFileSync('dist/assets/index.css', 'index.css');
    fs.copyFileSync('dist/assets/index.css', 'docs/index.css');
    fs.copyFileSync('dist/assets/index.css', 'docs/assets/index.css');
  }

  // 3. Synchronize HTML and 404 fallback
  if (fs.existsSync('dist/index.html')) {
    fs.copyFileSync('dist/index.html', 'docs/index.html');
    fs.copyFileSync('dist/index.html', 'dist/404.html');
    fs.copyFileSync('dist/index.html', 'docs/404.html');
    fs.copyFileSync('dist/index.html', 'public/404.html');
  }

  // 4. Ensure .nojekyll in all deployment targets so GitHub Pages never ignores files
  fs.writeFileSync('.nojekyll', '');
  fs.writeFileSync('docs/.nojekyll', '');
  fs.writeFileSync('dist/.nojekyll', '');
  fs.writeFileSync('public/.nojekyll', '');

  console.log('Build synchronized successfully across dist/, docs/, assets/ and root.');
} catch (e) {
  console.error('sync-build.js error:', e);
}
