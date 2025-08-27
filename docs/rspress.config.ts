import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'rspress/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));



export default defineConfig({
  root: path.join(__dirname, './docs'),
  title: 'DOOM AO Documentation',
  description: 'Complete documentation for the DOOM AO process - a WebAssembly-powered DOOM engine with modern APIs',
  icon: '/rspress-icon.png',
  logo: {
    light: '/rspress-light-logo.png',
    dark: '/rspress-dark-logo.png',
  },
  globalStyles: path.join(__dirname, './styles/globals.css'),
  builderConfig: {
    output: {
      inlineScripts: false,
    },
    tools: {
      rspack: {
        module: {
          parser: {
            javascript: {
              dynamicImportMode: 'eager',
            },
          },
        },
      },
    },
  },
  themeConfig: {
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/atticusofsparta/doom-ao',
      },
    ],
    nav: [
      {
        text: 'Getting Started',
        link: '/guide/',
        activeMatch: '/guide/',
      },
      {
        text: 'SDK',
        link: '/sdk/',
        activeMatch: '/sdk/',
      },
      {
        text: 'App',
        link: '/app/',
        activeMatch: '/app/',
      },
      {
        text: 'Process',
        link: '/process/',
        activeMatch: '/process/',
      },
      {
        text: 'API Reference',
        link: '/api/',
        activeMatch: '/api/',
      },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          link: '/guide/',
        },
      ],
      '/sdk/': [
        {
          text: 'Overview',
          link: '/sdk/',
        },
        {
          text: 'Client Library',
          link: '/sdk/client',
        },
        {
          text: 'Input System',
          link: '/sdk/input',
        },
        {
          text: 'State Management',
          link: '/sdk/state',
        },
      ],
      '/app/': [
        {
          text: 'Overview',
          link: '/app/',
        },
      ],
      '/process/': [
        {
          text: 'Overview',
          link: '/process/',
        },
      ],
      '/api/': [
        {
          text: 'Overview',
          link: '/api/',
        },
      ],
    },
  },
});
