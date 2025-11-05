# 🎨 Cameo Opaque Expression Generator

A free web tool that helps you create **opaque expressions** for Cameo Systems Modeler (MagicDraw) by simply describing what you want to achieve in plain English.

**🌐 Try it live: [https://opaueexpressionchatbot.netlify.app/](https://opaueexpressionchatbot.netlify.app/)**

## What is This Tool?

If you work with **Cameo Systems Modeler** (formerly MagicDraw) and need to create complex queries or expressions to navigate your model, this tool can help! Instead of manually figuring out how to write OCL expressions or configure Cameo's expression builder, you can describe what you want in natural language and get step-by-step instructions.

### What are Opaque Expressions?

Opaque expressions in Cameo are powerful ways to:
- Navigate through model elements (metachains)
- Filter collections based on conditions
- Find specific elements with stereotypes
- Create complex queries across your model

These expressions can be written in languages like OCL, Groovy, JavaScript, and more.

## ✨ Features

- 🎯 **Natural Language Input** - Describe what you want in plain English
- 📋 **Structured Output** - Get organized instructions with:
  - **Intent** - What the expression does
  - **Starting Context** - Where `self` refers to
  - **Metachain** - The navigation path through your model
  - **Filters** - How to filter elements
  - **Final Expression Template** - Ready-to-use template with placeholders
  - **Notes** - Additional guidance
- 🌳 **Visual Expression Tree** - See the hierarchical structure of your expression
- 📋 **Copy to Clipboard** - Easily copy any section
- 🎨 **Beautiful Dark Theme** - Easy on the eyes
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile

## 🚀 How to Use

### Step 1: Visit the Website
Go to **[https://opaueexpressionchatbot.netlify.app/](https://opaueexpressionchatbot.netlify.app/)**

### Step 2: Enter Your Query
In the text area, describe what you want to achieve in Cameo. For example:

- *"Find all classes that have a property named status"*
- *"Get all operations from classes that extend a specific base class"*
- *"Return all interface blocks on the type of an input pin"*
- *"Select all elements with the «InterfaceBlock» stereotype"*

### Step 3: Generate Expression
Click the **"Generate Expression"** button (or press `Ctrl+Enter`).

### Step 4: Review the Results
The tool will provide you with:

1. **🎯 Intent** - A plain-language description of what the expression does

2. **📍 Starting Context** - What `self` refers to in your expression (e.g., an Action, Block, Pin, or Capability)

3. **🔗 Metachain** - The navigation path through model elements you need to follow

4. **🔍 Filters** - Where and how to filter elements (e.g., stereotype checks, conditions)

5. **📝 Final Expression Template** - A template with placeholders like `[STEREOTYPE NAME]` that you can fill in with your actual model values

6. **💡 Notes** - Additional guidance and validation constraints

7. **🌳 Expression View** - A visual tree structure showing how the expression is organized

### Step 5: Use in Cameo
Copy the relevant sections and use them to build your expression in Cameo's Expression Editor. Replace the placeholders (like `[STEREOTYPE NAME]`) with your actual model element names.

## 📚 Understanding the Output

### Intent
This explains in plain language what your expression will do. Use this to verify the tool understood your request correctly.

### Starting Context
This tells you what `self` represents in your expression. For example:
- *"self is the Action that owns the InputPin"*
- *"self refers to the Block element"*

### Metachain
A metachain is the navigation path through your model. It shows how to traverse from one element to another. For example:
- `self.input.type.ownedElement` - Navigate from self to input, to its type, to owned elements

### Filters
Filters show you how to narrow down collections. Common patterns include:
- Checking stereotypes: `appliedStereotype->exists(s | s.name = '[STEREOTYPE NAME]')`
- Property conditions: `->select(e | e.name = '[PROPERTY NAME]')`

### Final Expression Template
This is the actual expression code you'll use in Cameo. It uses placeholders (in brackets) that you replace with your model-specific values. For example:
```ocl
self.input->collect(p |
  p.type.ownedElement
     ->select(e | e.appliedStereotype->exists(s | s.name = '[STEREOTYPE NAME]'))
)
```

Replace `[STEREOTYPE NAME]` with your actual stereotype name like `InterfaceBlock`.

### Expression View
This shows the hierarchical structure of your expression, similar to how Cameo's Expression Editor displays it. It helps you understand how the operations are nested.

## 💡 Tips for Best Results

1. **Be Specific** - Describe exactly what you want to find or filter
   - ✅ Good: "Find all classes that have the «InterfaceBlock» stereotype"
   - ❌ Less clear: "Find some classes"

2. **Mention Stereotypes** - If you're looking for elements with specific stereotypes, mention them
   - ✅ Good: "Get all elements with the «Capability» stereotype"
   - ❌ Less clear: "Get some elements"

3. **Describe the Context** - If your expression starts from a specific element type, mention it
   - ✅ Good: "From an Action, get all input pins that have types"
   - ❌ Less clear: "Get pins"

4. **Use Model Terms** - Use Cameo/MagicDraw terminology when possible
   - Classes, Blocks, Actions, Pins, Properties, Operations, Stereotypes, etc.

## 🔗 Related Documentation

This tool is based on the official Cameo documentation:
- [Cameo Documentation - Creating new operations](https://docs.nomagic.com/spaces/MD2021x/pages/64978604/Creating+new+operations)

## 🤝 Contributing

Found a bug or have a feature request? Feel free to contribute! This is an open-source project.

## 📄 License

MIT License - Feel free to use this tool for your Cameo modeling work!

---

**Powered by Mistral.AI** 🤖 | **Built with ❤️ for the Cameo modeling community**
