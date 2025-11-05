// Netlify serverless function to handle Mistral.AI API calls
exports.handler = async (event, context) => {
    // Debug logging
    console.log('Function called with method:', event.httpMethod);
    console.log('Event path:', event.path);
    
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
        console.log('Method not allowed:', event.httpMethod);
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
            },
            body: JSON.stringify({ 
                error: `Method not allowed. Expected POST, got ${event.httpMethod}` 
            }),
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

        // Analyze prompt to detect patterns and map to Cameo operations
        const promptAnalysis = analyzePrompt(prompt);

        // Create the system prompt with documentation context and prompt-specific guidance
        let systemPrompt = `Your task is to:

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

For the JSON, you MUST use this structure and naming:

Top-level key: "expressionView"

It must be an object

It must have: label, type, icon, children

The top node is the operation (e.g. "label": "select")

The top node’s children must be in this order:

A node

An input "arg1"

The Filter node must look like this:

{
  "label": "Filter",
  "type": "Filter",
  "icon": "Filter",
  "value": "arg1",
  "children": []
}
  
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

        // Enhance system prompt with detected patterns
        if (promptAnalysis.guidance) {
            systemPrompt += `\n\n## IMPORTANT DETECTED PATTERNS:\n${promptAnalysis.guidance}\n`;
        }

        const userPrompt = `Create an opaque expression template for Cameo that: ${prompt.trim()}`;

        // COMMENTED OUT: Mistral.AI API call
        /*
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
        */

        // Return mock response with prompt analysis but empty generated content
        const emptySections = {
            intent: '',
            startingContext: '',
            metachain: '',
            filters: '',
            finalExpressionTemplate: '',
            notes: '',
            expressionView: null
        };

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                rawResponse: '',
                structured: emptySections,
                expressionView: null,
                model: 'mistral-medium',
                promptAnalysis: promptAnalysis, // Include the prompt analysis
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

// Helper function to analyze prompt and map to Cameo operations
function analyzePrompt(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    const detectedPatterns = [];
    const guidance = [];

    // Detect nested/recursive patterns → ImpliedRelation
    const nestedKeywords = ['nested', 'recursive', 'recursively', 'nested within', 'contained in', 'hierarchical', 'parent', 'child'];
    if (nestedKeywords.some(keyword => lowerPrompt.includes(keyword))) {
        detectedPatterns.push('impliedRelation');
        guidance.push(`- DETECTED: Nested/recursive logic detected. Use ImpliedRelation icon/operation for navigating through implied relationships.
  - Icon: "ImpliedRelation" or "impliedRelation"
  - Type: "impliedRelation" or "operation"
  - This is for navigating through implicit model relationships (e.g., containment, ownership)`);
    }

    // Detect SysML relationship patterns → metachains
    const sysmlRelationships = [
        { keyword: 'satisfy', metachain: 'self.satisfy', description: 'satisfy relationship (Block to Requirements)' },
        { keyword: 'satisfies', metachain: 'self.satisfy', description: 'satisfy relationship' },
        { keyword: 'derive', metachain: 'self.derive', description: 'derive relationship' },
        { keyword: 'derives', metachain: 'self.derive', description: 'derive relationship' },
        { keyword: 'allocate', metachain: 'self.allocate', description: 'allocate relationship' },
        { keyword: 'allocates', metachain: 'self.allocate', description: 'allocate relationship' },
        { keyword: 'trace', metachain: 'self.trace', description: 'trace relationship' },
        { keyword: 'traces', metachain: 'self.trace', description: 'trace relationship' },
        { keyword: 'verify', metachain: 'self.verify', description: 'verify relationship' },
        { keyword: 'verifies', metachain: 'self.verify', description: 'verify relationship' },
        { keyword: 'refine', metachain: 'self.refine', description: 'refine relationship' },
        { keyword: 'refines', metachain: 'self.refine', description: 'refine relationship' },
        { keyword: 'clientdependency', metachain: 'self.clientDependency', description: 'client dependency relationship' },
        { keyword: 'dependency', metachain: 'self.clientDependency', description: 'dependency relationship' },
        { keyword: 'owned element', metachain: 'self.ownedElement', description: 'owned elements' },
        { keyword: 'owned elements', metachain: 'self.ownedElement', description: 'owned elements' },
        { keyword: 'type', metachain: 'self.type', description: 'type relationship' },
        { keyword: 'input', metachain: 'self.input', description: 'input pins' },
        { keyword: 'output', metachain: 'self.output', description: 'output pins' },
    ];

    const foundSysmlRelations = sysmlRelationships.filter(rel => lowerPrompt.includes(rel.keyword));
    if (foundSysmlRelations.length > 0) {
        detectedPatterns.push('metachain');
        const metachainExamples = foundSysmlRelations.map(rel => 
            `  - "${rel.keyword}" → metachain: "${rel.metachain}" (${rel.description})`
        ).join('\n');
        guidance.push(`- DETECTED: SysML relationship patterns found. Use metachain navigation for these relationships:
${metachainExamples}
  - Icon: "metachain"
  - Type: "metachain"
  - Use metachain navigation for explicit SysML/UML relationships`);
    }

    // Detect stereotype patterns → filter operations
    const stereotypeKeywords = ['stereotype', 'stereotyped', '«', 'guillemet', 'applied stereotype'];
    if (stereotypeKeywords.some(keyword => lowerPrompt.includes(keyword))) {
        detectedPatterns.push('stereotypeFilter');
        guidance.push(`- DETECTED: Stereotype filtering needed. Use filter operation with stereotype check:
  - Filter condition: appliedStereotype->exists(s | s.name = '[STEREOTYPE NAME]')
  - Icon: "Filter"
  - Type: "Filter"
  - Use this to filter elements by their applied stereotypes`);
    }

    // Detect property/attribute queries → filter operations
    const propertyKeywords = ['property', 'attribute', 'has property', 'has attribute', 'named', 'name is', 'name equals'];
    if (propertyKeywords.some(keyword => lowerPrompt.includes(keyword))) {
        detectedPatterns.push('propertyFilter');
        guidance.push(`- DETECTED: Property/attribute filtering needed. Use filter operation with property check:
  - Filter condition: ->select(e | e.name = '[PROPERTY NAME]') or ->select(e | e.[PROPERTY_NAME] = '[VALUE]')
  - Icon: "Filter"
  - Type: "Filter"
  - Use this to filter elements by their properties or attributes`);
    }

    // Detect collection operations
    if (lowerPrompt.includes('all ') || lowerPrompt.includes('every ') || lowerPrompt.includes('collection')) {
        detectedPatterns.push('collection');
        guidance.push(`- DETECTED: Collection operation needed. Use collect, select, or exists operations:
  - collect: Transform each element in a collection
  - select: Filter elements from a collection
  - exists: Check if any element in collection matches condition`);
    }

    // Detect type checking
    const typeKeywords = ['type', 'instance of', 'is a', 'kind of', 'classifier'];
    if (typeKeywords.some(keyword => lowerPrompt.includes(keyword) && !lowerPrompt.includes('type relationship'))) {
        detectedPatterns.push('typeTest');
        guidance.push(`- DETECTED: Type checking needed. Use type test operation:
  - Icon: "TypeTest" or "typeTest"
  - Type: "typeTest" or "operation"
  - Use this to check if an element is an instance of a specific type or classifier`);
    }

    // Detect filter/condition patterns
    if (lowerPrompt.includes('filter') || lowerPrompt.includes('where') || lowerPrompt.includes('that') || lowerPrompt.includes('which')) {
        detectedPatterns.push('filter');
        guidance.push(`- DETECTED: Filtering/conditioning needed. Use filter operation:
  - Icon: "Filter"
  - Type: "Filter"
  - Use this to narrow down collections based on conditions`);
    }

    // Combine all guidance
    const fullGuidance = guidance.length > 0 
        ? `Based on the user's prompt, the following Cameo operations should be used:\n\n${guidance.join('\n\n')}\n\nIMPORTANT: When generating the expressionView JSON, use the icons and types specified above based on the detected patterns.`
        : '';

    return {
        patterns: detectedPatterns,
        guidance: fullGuidance,
        detectedRelations: foundSysmlRelations
    };
}

