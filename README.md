# Block Twitter Motivational

A Chrome extension that helps you avoid AI-generated and low-quality content on Twitter/X.com by analyzing tweets using LLM integration.

## Features

- Real-time tweet analysis using Groq/OpenRouter LLM integration
- Client-side processing for privacy (no backend server needed)
- Visual indicators for detected low-quality content
- Customizable keyword blocking

## Prerequisites

- Chrome browser
- Groq API key (get one from [Groq's website](https://groq.com))

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/block-twitter-motivational.git
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder from the project

## Usage

1. Click the extension icon in Chrome
2. Enter your Groq API key in the settings
3. Toggle the extension on/off as needed
4. Add custom keywords to block (optional)
5. The badge counter will show how many low-quality tweets were detected

## Development

```bash

# Build for production
npm run build

```

## Project Structure

```
block-twitter-motivational/
├── assets/             # Extension icons and assets
├── src/
│   ├── background/     # Chrome extension background script
│   ├── content/        # Content scripts for Twitter integration
│   ├── popup/          # Extension popup UI
│   └── utils/          # Shared utilities and API handlers
├── manifest.json       # Extension manifest
└── package.json        # Project dependencies
```
