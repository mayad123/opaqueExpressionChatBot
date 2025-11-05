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
        const systemPrompt = `Your task is to:

Explain the intent of the expression.

Describe the starting context.

Give a final expression template with placeholders.

And most importantly: output an expressionView JSON object in a fixed schema so a UI can render it like the Cameo Structured Expression dialog.

Follow these rules exactly.

Output sections in this order:

Intent

Starting Context

Final Expression Template

expressionView (JSON)

In the Final Expression Template, use placeholders in square brackets (e.g. [STEREOTYPE NAME], [METACHAIN HERE], [TARGET ELEMENT]). Do not invent real model element names.

For the JSON, you MUST use this exact structure and naming:

Top-level key: "expressionView"

It must be an object

It must have: label, type, icon, children

The top node is the operation (e.g. "label": "select")

The top node’s children must be in this order:

A "Filter" node

An "arg1" node that wraps the metachain

The Filter node must look like this:

{
  "label": "Filter",
  "type": "Filter",
  "icon": "Filter",
  "value": "arg1",
  "children": []
}


The arg1 node must look like this:

{
  "label": "arg1",
  "type": "metachain",
  "icon": "metachain",
  "value": "<the iterator or input expression, e.g. 'r |' or 'x |'>",
  "children": [
    {
      "label": "<human-readable metachain description>",
      "type": "metachain",
      "icon": "metachain",
      "value": "<actual metachain, e.g. 'self.satisfy' or 'System Block -> clientDependency'>",
      "children": []
    }
  ]
}


Do not move the metachain to be a sibling of Filter. The metachain must be nested under arg1.

Do not change the casing of Filter or metachain in type and icon. Use exactly what is shown above.

If the user’s expression has multiple navigation steps, represent them as additional children inside the arg1 node’s children array, each with type: "metachain".

Do not output Markdown code fences in the JSON section. Output raw JSON only.

If the expression is about satisfy → requirement, the final JSON should look like this shape:

{
  "expressionView": {
    "label": "select",
    "type": "operation",
    "icon": "expression.operation",
    "children": [
      {
        "label": "Filter",
        "type": "Filter",
        "icon": "Filter",
        "value": "arg1",
        "children": []
      },
      {
        "label": "arg1",
        "type": "metachain",
        "icon": "metachain",
        "value": "r |",
        "children": [
          {
            "label": "System block to dependencies",
            "type": "metachain",
            "icon": "metachain",
            "value": "self.satisfy",
            "children": []
          }
        ]
      }
    ]
  }
}`;

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

