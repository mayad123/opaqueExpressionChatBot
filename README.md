# Cameo Opaque Expression Generator

A web application that helps users create opaque expressions in Cameo Systems Modeler (MagicDraw) by converting natural language prompts into step-by-step instructions. Powered by Mistral.AI.

## Features

- 🎨 Beautiful, modern UI with dark theme
- 💬 Natural language input for describing desired opaque expressions
- 📚 Based on official Cameo documentation
- 🔒 Secure API key handling via Netlify environment variables
- 📱 Responsive design for all devices
- 📋 One-click copy to clipboard

## Setup and Deployment

### Prerequisites

- A Mistral.AI API key ([Get one here](https://console.mistral.ai/))
- A Netlify account (free tier works)
- A GitHub account

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/mayad123/opaqueExpressionChatBot.git
   cd opaqueExpressionChatBot
   ```

2. **Install dependencies** (optional, for local Netlify dev)
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Create a `.env` file in the root directory:
     ```
     MISTRAL_API_KEY=your_mistral_api_key_here
     ```

4. **Run locally with Netlify CLI**
   ```bash
   npm run dev
   # or
   npx netlify dev
   ```
   
   The site will be available at `http://localhost:8888`

### Deployment to Netlify

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Netlify**
   - Go to [Netlify](https://www.netlify.com/)
   - Click "New site from Git"
   - Connect your GitHub repository: `mayad123/opaqueExpressionChatBot`
   - Configure build settings:
     - Build command: Leave empty (or `echo 'No build needed'`)
     - Publish directory: `.` (root)
   - Add environment variable:
     - Go to Site settings → Environment variables
     - Add `MISTRAL_API_KEY` with your Mistral.AI API key
   - Click "Deploy site"

3. **Configure GitHub Pages (Alternative)**
   If you prefer GitHub Pages:
   - Go to your repository settings
   - Navigate to Pages
   - Select source: `main` branch
   - Note: GitHub Pages won't support Netlify Functions, so you'll need to deploy the serverless function separately or use a different approach

### Using Netlify Functions

The project uses Netlify Functions to securely handle API calls. The function is located at:
- `netlify/functions/generate-expression.js`

This function:
- Handles CORS properly
- Securely stores the Mistral.AI API key
- Processes natural language prompts
- Returns formatted opaque expression instructions

## Configuration

### Changing the Mistral Model

Edit `netlify/functions/generate-expression.js` and change the `model` parameter:
```javascript
model: 'mistral-medium', // Options: mistral-small, mistral-medium, mistral-large
```

### Customizing the System Prompt

Modify the `systemPrompt` variable in `netlify/functions/generate-expression.js` to change how the AI responds.

## Project Structure

```
opaqueExpressionChatBot/
├── index.html              # Main HTML file
├── styles.css              # Styling
├── script.js               # Frontend JavaScript
├── netlify/
│   └── functions/
│       └── generate-expression.js  # Netlify serverless function
├── netlify.toml            # Netlify configuration
├── package.json            # Node.js dependencies
└── README.md              # This file
```

## How It Works

1. User enters a natural language prompt describing what they want to achieve in Cameo
2. Frontend sends the prompt to the Netlify serverless function
3. Serverless function calls Mistral.AI API with:
   - System prompt containing Cameo documentation context
   - User's natural language prompt
4. Mistral.AI generates step-by-step instructions
5. Response is formatted and displayed to the user

## Documentation Reference

Based on: [Cameo Documentation - Creating new operations](https://docs.nomagic.com/spaces/MD2021x/pages/64978604/Creating+new+operations)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

