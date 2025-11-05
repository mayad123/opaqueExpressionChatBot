// Netlify serverless function to handle Mistral.AI API calls
exports.handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
            },
            body: '',
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
            },
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        // Get API key from environment variable
        const mistralApiKey = process.env.MISTRAL_API_KEY;
        
        if (!mistralApiKey) {
            console.error('MISTRAL_API_KEY is not set');
            return {
                statusCode: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    error: 'Server configuration error: API key not found' 
                }),
            };
        }

        // Parse request body
        const { prompt } = JSON.parse(event.body || '{}');
        
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ error: 'Prompt is required' }),
            };
        }

        // Create the system prompt with documentation context
        const systemPrompt = `You are a Cameo/MagicDraw (No Magic) expression assistant for version 2021x.

Your role is to help users build and visualize **opaque expression templates** (OCL, Groovy, JavaScript, etc.) for Cameo Systems Modeler. 

You DO NOT generate final copy-paste expressions. Instead, you output **annotated, structured templates** and **UI render data** that show where metachains, filters, and stereotypes belong — in a way that can be rendered visually like Cameo's Expression Editor.

---

## 🎯 GOAL

Generate a *structured, visual description* of a Cameo expression that includes:

1. **Intent** – plain-language description of what the expression does.

2. **Starting Context** – what \`self\` refers to (e.g., an Action, Block, Pin, or Capability).

3. **Metachain** – the navigation path through model elements.

4. **Filters** – where and how to filter (e.g., stereotype checks, conditions).

5. **Final Expression Template** – use placeholders in brackets \`[LIKE_THIS]\` for model-specific values.

6. **Notes** – additional guidance or validation constraints.

7. **ExpressionView (JSON)** – a hierarchical structure representing the expression tree, suitable for rendering in a Cameo-style UI.

---

## 🧱 STRUCTURE RULES

### Expression Sections

Output all six text sections first (Intent → Notes). 

Then output a final JSON block called \`"expressionView"\` that matches this schema:

{
  "expressionView": {
    "label": "Contains",
    "type": "operation",
    "icon": "expression.operation",
    "children": [
      {
        "label": "Input",
        "type": "parameter",
        "icon": "param.input",
        "value": "Metachain Navigation",
        "children": [
          {
            "label": "Metachain",
            "type": "metachain",
            "icon": "metachain",
            "value": "self.input.type.ownedElement",
            "children": []
          }
        ]
      },
      {
        "label": "Obj",
        "type": "elementRef",
        "icon": "uml.class",
        "value": "iTemperature",
        "children": []
      }
    ]
  }
}

Field Definitions:
- label: Node label (e.g., "Input", "Obj", "Contains")
- type: One of [operation, parameter, elementRef, metachain, filter, note]
- icon: A UI icon key (e.g., uml.class, param.input, expression.operation, uaf.capability)
- value: Optional. The text value shown beside the label (e.g., Metachain Nav, iTemperature)
- children: Array of child nodes

You may also insert note nodes like this:
{
  "label": "Filter by stereotype here",
  "type": "note",
  "icon": "note",
  "value": "appliedStereotype->exists(s | s.name = '[STEREOTYPE NAME]')",
  "children": []
}

🧩 MODELING RULES

Never invent model element names. Use placeholders like [CAPABILITY NAME], [STEREOTYPE NAME], [METACHAIN HERE].

Always show where metachains, filters, and stereotypes go.

Use inline if/then/else, not let expressions (Cameo 2021x limitation).

Prefer collection operations (collect, select, exists).

Check stereotypes with:
appliedStereotype->exists(s | s.name = '[STEREOTYPE NAME]')

Output plain text (no Markdown fences, no code blocks).

🧭 EXAMPLE RESPONSE STRUCTURE

Intent
Return all interface blocks on the type of an input pin.

Starting Context
self is the Action that owns the InputPin.

Metachain
self.input.type.ownedElement

Filters
Select only those elements that have the «InterfaceBlock» stereotype.

Final Expression Template
self.input->collect(p |
  p.type.ownedElement
     ->select(e | e.appliedStereotype->exists(s | s.name = '[STEREOTYPE NAME]'))
)

Notes
Replace [STEREOTYPE NAME] with InterfaceBlock.
Use inline if/then/else only.

ExpressionView (JSON)
{
  "expressionView": {
    "label": "Contains",
    "type": "operation",
    "icon": "expression.operation",
    "children": [
      {
        "label": "Input",
        "type": "parameter",
        "icon": "param.input",
        "value": "Metachain Nav",
        "children": []
      },
      {
        "label": "Obj",
        "type": "elementRef",
        "icon": "uml.class",
        "value": "iTemperature",
        "children": []
      }
    ]
  }
}

🧠 OUTPUT BEHAVIOR

Produce consistent JSON at the end.

Always close brackets properly.

Use placeholder values when uncertain.

Avoid Markdown, backticks, or commentary outside the defined sections.

Return only one "expressionView" object per output.`;

        const userPrompt = `Create an opaque expression template for Cameo that: ${prompt.trim()}`;

        // Call Mistral.AI API
        const mistralResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${mistralApiKey}`,
            },
            body: JSON.stringify({
                model: 'mistral-medium', // You can change this to mistral-small, mistral-large, etc.
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt,
                    },
                    {
                        role: 'user',
                        content: userPrompt,
                    },
                ],
                temperature: 0.7,
                max_tokens: 2000,
            }),
        });

        if (!mistralResponse.ok) {
            const errorText = await mistralResponse.text();
            console.error('Mistral API error:', errorText);
            return {
                statusCode: mistralResponse.status,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    error: `Mistral API error: ${mistralResponse.statusText}` 
                }),
            };
        }

        const mistralData = await mistralResponse.json();
        
        // Extract the response content
        const rawResponse = mistralData.choices?.[0]?.message?.content || 
                          'No response generated. Please try again.';

        // Parse the response to extract structured sections and expressionView
        const parsed = parseStructuredResponse(rawResponse);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                rawResponse: rawResponse,
                structured: parsed.structured,
                expressionView: parsed.expressionView,
                model: mistralData.model,
            }),
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                error: error.message || 'Internal server error' 
            }),
        };
    }
};

// Helper function to parse structured response
function parseStructuredResponse(text) {
    const sections = {
        intent: '',
        startingContext: '',
        metachain: '',
        filters: '',
        finalExpressionTemplate: '',
        notes: '',
        expressionView: null
    };

    // Extract text sections
    const intentMatch = text.match(/Intent\s*\n(.*?)(?=\n\s*(?:Starting Context|Metachain|Filters|Final Expression Template|Notes|ExpressionView))/is);
    if (intentMatch) sections.intent = intentMatch[1].trim();

    const startingContextMatch = text.match(/Starting Context\s*\n(.*?)(?=\n\s*(?:Metachain|Filters|Final Expression Template|Notes|ExpressionView))/is);
    if (startingContextMatch) sections.startingContext = startingContextMatch[1].trim();

    const metachainMatch = text.match(/Metachain\s*\n(.*?)(?=\n\s*(?:Filters|Final Expression Template|Notes|ExpressionView))/is);
    if (metachainMatch) sections.metachain = metachainMatch[1].trim();

    const filtersMatch = text.match(/Filters\s*\n(.*?)(?=\n\s*(?:Final Expression Template|Notes|ExpressionView))/is);
    if (filtersMatch) sections.filters = filtersMatch[1].trim();

    const finalExpressionMatch = text.match(/Final Expression Template\s*\n(.*?)(?=\n\s*(?:Notes|ExpressionView))/is);
    if (finalExpressionMatch) sections.finalExpressionTemplate = finalExpressionMatch[1].trim();

    const notesMatch = text.match(/Notes\s*\n(.*?)(?=\n\s*ExpressionView)/is);
    if (notesMatch) sections.notes = notesMatch[1].trim();

    // Extract JSON expressionView - look for the JSON block after "ExpressionView (JSON)"
    const expressionViewMatch = text.match(/ExpressionView\s*\(JSON\)\s*\n([\s\S]*?)(?=\n\n|\n\s*$|$)/);
    if (expressionViewMatch) {
        try {
            const jsonStr = expressionViewMatch[1].trim();
            // Try to parse the JSON - it might be wrapped in { "expressionView": ... }
            const parsed = JSON.parse(jsonStr);
            if (parsed.expressionView) {
                sections.expressionView = parsed;
            } else {
                // If it's just the expressionView object, wrap it
                sections.expressionView = { expressionView: parsed };
            }
        } catch (e) {
            // Try alternative: look for any JSON block containing "expressionView"
            try {
                const jsonBlockMatch = text.match(/\{[\s\S]*"expressionView"[\s\S]*\}/);
                if (jsonBlockMatch) {
                    sections.expressionView = JSON.parse(jsonBlockMatch[0]);
                }
            } catch (e2) {
                console.error('Failed to parse expressionView JSON:', e2);
            }
        }
    } else {
        // Fallback: look for any JSON block containing "expressionView"
        const jsonBlockMatch = text.match(/\{[\s\S]*"expressionView"[\s\S]*\}/);
        if (jsonBlockMatch) {
            try {
                sections.expressionView = JSON.parse(jsonBlockMatch[0]);
            } catch (e) {
                console.error('Failed to parse expressionView JSON (fallback):', e);
            }
        }
    }

    return {
        structured: sections,
        expressionView: sections.expressionView
    };
}

