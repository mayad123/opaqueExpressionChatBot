// Configuration
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

// Optional: Python backend for advanced prompt analysis
// Set to null to use JavaScript-only analysis, or set to your Python backend URL
const PYTHON_BACKEND_URL = null; // e.g., 'http://localhost:5000' or 'https://your-backend.herokuapp.com'

// DOM elements
const promptInput = document.getElementById('promptInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const contextSelect = document.getElementById('contextSelect');
const scopeInputType = document.getElementById('scopeInputType');
const rowType = document.getElementById('rowType');
const elementType = document.getElementById('elementType');
const submitBtn = document.getElementById('submitBtn');
const responseSection = document.getElementById('responseSection');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');

// Load API key from localStorage on page load
window.addEventListener('DOMContentLoaded', () => {
    const savedApiKey = localStorage.getItem('mistralApiKey');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }
});

// Save API key to localStorage when changed
apiKeyInput.addEventListener('blur', () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
        localStorage.setItem('mistralApiKey', apiKey);
    } else {
        localStorage.removeItem('mistralApiKey');
    }
});

// Handle context selection changes to show/hide conditional options
contextSelect.addEventListener('change', () => {
    const context = contextSelect.value;
    
    // Hide all conditional options
    document.getElementById('scopeCriteriaOptions').style.display = 'none';
    document.getElementById('customColumnOptions').style.display = 'none';
    document.getElementById('derivedPropertyOptions').style.display = 'none';
    
    // Show relevant conditional options based on context
    if (context === 'scope-criteria') {
        document.getElementById('scopeCriteriaOptions').style.display = 'block';
    } else if (context === 'custom-column') {
        document.getElementById('customColumnOptions').style.display = 'block';
    } else if (context === 'derived-property') {
        document.getElementById('derivedPropertyOptions').style.display = 'block';
    }
});

// Submit handler
submitBtn.addEventListener('click', handleSubmit);
promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        handleSubmit();
    }
});

// Store the current prompt for display
let currentPrompt = '';

async function handleSubmit() {
    const prompt = promptInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const context = contextSelect.value;
    
    // Get context-specific values
    let contextSpecific = {};
    if (context === 'scope-criteria') {
        contextSpecific.inputType = scopeInputType.value;
    } else if (context === 'custom-column') {
        contextSpecific.rowType = rowType.value;
    } else if (context === 'derived-property') {
        contextSpecific.elementType = elementType.value;
    }
    
    if (!prompt) {
        showError('Please enter a prompt');
        return;
    }

    // Store the prompt for display
    currentPrompt = prompt;

    // Hide previous responses
    hideError();
    hideResponse();
    
    // Show loading state
    setLoading(true);
    
    try {
        // Analyze prompt to detect patterns (use Python backend if available, else JavaScript)
        let promptAnalysis;
        if (PYTHON_BACKEND_URL) {
            try {
                const analysisResponse = await fetch(`${PYTHON_BACKEND_URL}/analyze`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        prompt: prompt,
                        context: context,
                        contextSpecific: contextSpecific
                    }),
                });
                
                if (analysisResponse.ok) {
                    const analysisData = await analysisResponse.json();
                    promptAnalysis = analysisData.analysis;
                } else {
                    // Fallback to JavaScript analysis if Python backend fails
                    console.warn('Python backend unavailable, using JavaScript analysis');
                    promptAnalysis = analyzePrompt(prompt);
                }
            } catch (error) {
                // Fallback to JavaScript analysis if Python backend is unreachable
                console.warn('Python backend unreachable, using JavaScript analysis:', error);
                promptAnalysis = analyzePrompt(prompt);
            }
        } else {
            // Use JavaScript analysis
            promptAnalysis = analyzePrompt(prompt);
        }
        
        // If no API key, just show prompt analysis
        if (!apiKey) {
            const emptySections = {
                intent: '',
                startingContext: '',
                metachain: '',
                filters: '',
                finalExpressionTemplate: '',
                notes: '',
                expressionView: null
            };
            
            showResponse({
                rawResponse: '',
                structured: emptySections,
                expressionView: null,
                model: 'mistral-medium',
                promptAnalysis: promptAnalysis
            });
            setLoading(false);
            return;
        }

        // Generate system prompt with context
        const systemPrompt = generateSystemPrompt(promptAnalysis, context, contextSpecific);
        const userPrompt = `Create an opaque expression template for Cameo that: ${prompt.trim()}`;

        // Call Mistral.AI API directly
        const response = await fetch(MISTRAL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'mistral-medium',
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

        if (!response.ok) {
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || errorData.error || errorMessage;
            } catch (e) {
                try {
                    const errorText = await response.text();
                    if (errorText) errorMessage = errorText;
                } catch (e2) {
                    // Keep default error message
                }
            }
            throw new Error(errorMessage);
        }

        const mistralData = await response.json();
        
        // Extract the response content
        const rawResponse = mistralData.choices?.[0]?.message?.content || 
                          'No response generated. Please try again.';

        // Parse the response to extract structured sections and expressionView
        const parsed = parseStructuredResponse(rawResponse);

        showResponse({
            rawResponse: rawResponse,
            structured: parsed.structured,
            expressionView: parsed.expressionView,
            model: mistralData.model,
            promptAnalysis: promptAnalysis
        });

    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'Failed to generate expression. Please try again.');
    } finally {
        setLoading(false);
    }
}

function generateSystemPrompt(promptAnalysis, context, contextSpecific) {
    // Get context description
    let contextInfo = '';
    if (context) {
        const contextDescriptions = {
            'scope-criteria': 'This expression will be used in a Scope Criteria context. Scope criteria are used to filter or define the scope of elements in queries, searches, or analysis operations.',
            'derived-property': 'This expression will be used in a Derived Property context. Derived properties calculate values based on other properties or model elements.',
            'custom-column': 'This expression will be used in a Custom Column context. Custom columns are used in tables or views to display calculated or derived values.',
            'legend': 'This expression will be used in a Legend context. Legends define visual representations or categorization of model elements.'
        };
        
        let contextDesc = contextDescriptions[context] || '';
        
        // Add context-specific details
        if (context === 'scope-criteria' && contextSpecific.inputType) {
            contextDesc += `\n\nThe input type is: ${contextSpecific.inputType} (${contextSpecific.inputType === 'package' ? 'a Package' : 'an Element'}). The expression must work with this input type.`;
        } else if (context === 'custom-column' && contextSpecific.rowType) {
            if (contextSpecific.rowType === '[CUSTOM TYPE]') {
                contextDesc += `\n\nThe row type is a custom type (specified in the user prompt). The expression must work with this custom row type.`;
            } else {
                contextDesc += `\n\nThe row type is: ${contextSpecific.rowType}. The expression must work with ${contextSpecific.rowType} elements.`;
            }
        } else if (context === 'derived-property' && contextSpecific.elementType) {
            if (contextSpecific.elementType === '[CUSTOM TYPE]') {
                contextDesc += `\n\nThe element type is a custom type (specified in the user prompt). The expression must work with this custom element type.`;
            } else {
                contextDesc += `\n\nThe element type is: ${contextSpecific.elementType}. The expression must work with ${contextSpecific.elementType} elements.`;
            }
        }
        
        contextInfo = `\n\n## EXPRESSION CONTEXT:\n${contextDesc}\n\nIMPORTANT: The expression must be appropriate for use in a ${context.replace('-', ' ')} context.\n`;
    }
    
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

The top node's children must be in this order:

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

    // Add context information
    if (contextInfo) {
        systemPrompt += contextInfo;
    }
    
    // Enhance system prompt with detected patterns
    if (promptAnalysis.guidance) {
        systemPrompt += `\n\n## IMPORTANT DETECTED PATTERNS:\n${promptAnalysis.guidance}\n`;
    }

    return systemPrompt;
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

function showResponse(data) {
    // Display user's prompt
    if (currentPrompt) {
        let promptText = currentPrompt;
        const context = contextSelect.value;
        if (context) {
            const contextLabels = {
                'scope-criteria': 'Scope Criteria',
                'derived-property': 'Derived Property',
                'custom-column': 'Custom Column',
                'legend': 'Legend'
            };
            promptText += `\n\n[Context: ${contextLabels[context]}]`;
            
            // Add context-specific details
            if (context === 'scope-criteria' && scopeInputType.value) {
                promptText += `\n[Input Type: ${scopeInputType.value === 'package' ? 'Package' : 'Element'}]`;
            } else if (context === 'custom-column' && rowType.value) {
                if (rowType.value !== '[CUSTOM TYPE]') {
                    promptText += `\n[Row Type: ${rowType.value}]`;
                } else {
                    promptText += `\n[Row Type: Custom Type]`;
                }
            } else if (context === 'derived-property' && elementType.value) {
                if (elementType.value !== '[CUSTOM TYPE]') {
                    promptText += `\n[Element Type: ${elementType.value}]`;
                } else {
                    promptText += `\n[Element Type: Custom Type]`;
                }
            }
        }
        document.getElementById('userPromptContent').textContent = promptText;
        document.getElementById('userPromptSection').style.display = 'block';
    }
    
    // Display prompt analysis if available
    if (data.promptAnalysis) {
        const analysis = data.promptAnalysis;
        let analysisText = '';
        
        if (analysis.patterns && analysis.patterns.length > 0) {
            analysisText = `Detected Patterns: ${analysis.patterns.join(', ')}\n\n`;
        }
        
        if (analysis.guidance) {
            analysisText += analysis.guidance;
        }
        
        if (analysis.detectedRelations && analysis.detectedRelations.length > 0) {
            analysisText += `\n\nDetected SysML Relationships:\n`;
            analysis.detectedRelations.forEach(rel => {
                analysisText += `- ${rel.keyword} → ${rel.metachain} (${rel.description})\n`;
            });
        }
        
        if (analysisText) {
            // Create or update prompt analysis section
            let analysisSection = document.getElementById('promptAnalysisSection');
            if (!analysisSection) {
                const structuredContent = document.getElementById('structuredContent');
                analysisSection = document.createElement('div');
                analysisSection.id = 'promptAnalysisSection';
                analysisSection.className = 'section-block';
                analysisSection.style.display = 'none';
                analysisSection.innerHTML = `
                    <h3>🔍 Prompt Analysis</h3>
                    <pre id="promptAnalysisContent" class="code-block"></pre>
                `;
                structuredContent.insertBefore(analysisSection, structuredContent.firstChild);
            }
            document.getElementById('promptAnalysisContent').textContent = analysisText.trim();
            analysisSection.style.display = 'block';
        }
    }
    
    // Display structured sections
    if (data.structured) {
        const sections = data.structured;
        
        if (sections.intent) {
            document.getElementById('intentContent').textContent = sections.intent;
            document.getElementById('intentSection').style.display = 'block';
        }
        
        if (sections.startingContext) {
            document.getElementById('startingContextContent').textContent = sections.startingContext;
            document.getElementById('startingContextSection').style.display = 'block';
        }
        
        if (sections.metachain) {
            document.getElementById('metachainContent').textContent = sections.metachain;
            document.getElementById('metachainSection').style.display = 'block';
        }
        
        if (sections.filters) {
            document.getElementById('filtersContent').textContent = sections.filters;
            document.getElementById('filtersSection').style.display = 'block';
        }
        
        if (sections.finalExpressionTemplate) {
            document.getElementById('finalExpressionContent').textContent = sections.finalExpressionTemplate;
            document.getElementById('finalExpressionSection').style.display = 'block';
        }
        
        if (sections.notes) {
            document.getElementById('notesContent').textContent = sections.notes;
            document.getElementById('notesSection').style.display = 'block';
        }
    }
    
    // Display expression view tree
    if (data.expressionView) {
        let treeData = data.expressionView;
        // Handle nested structure: { expressionView: { ... } }
        if (treeData.expressionView) {
            treeData = treeData.expressionView;
        }
        renderExpressionTree(treeData);
        document.getElementById('expressionViewSection').style.display = 'block';
    }
    
    // Display raw response in collapsible section
    if (data.rawResponse) {
        document.getElementById('rawResponseContent').textContent = data.rawResponse;
        document.getElementById('rawResponseSection').style.display = 'block';
    }
    
    // Fallback to raw display if structured data not available
    if (!data.structured && (data.expression || data.response)) {
        const fallbackContent = document.getElementById('intentContent');
        fallbackContent.textContent = data.expression || data.response;
        document.getElementById('intentSection').style.display = 'block';
    }
    
    responseSection.style.display = 'block';
    responseSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

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

function renderExpressionTree(node, container = null, level = 0) {
    if (!container) {
        container = document.getElementById('expressionViewTree');
        container.innerHTML = '';
    }
    
    const nodeDiv = document.createElement('div');
    nodeDiv.className = `tree-node tree-node-level-${level}`;
    nodeDiv.style.paddingLeft = `${level * 20}px`;
    
    const icon = getIcon(node.icon || node.type);
    const label = node.label || '';
    const value = node.value ? `: ${node.value}` : '';
    const type = node.type || '';
    
    nodeDiv.innerHTML = `
        <span class="tree-icon">${icon}</span>
        <span class="tree-label">${label}</span>
        <span class="tree-value">${value}</span>
        <span class="tree-type">(${type})</span>
    `;
    
    container.appendChild(nodeDiv);
    
    if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
            renderExpressionTree(child, container, level + 1);
        });
    }
}

function getIcon(iconKey) {
    const iconMap = {
        'expression.operation': '⚙️',
        'param.input': '📥',
        'metachain': '🔗',
        'uml.class': '📦',
        'note': '📝',
        'filter': '🔍',
        'Filter': '🔍',
        'operation': '⚙️',
        'parameter': '📥',
        'ImpliedRelation': '🔀',
        'typeTest': '✓',
        'TypeTest': '✓',
    };
    return iconMap[iconKey] || '📄';
}

function hideResponse() {
    responseSection.style.display = 'none';
    // Hide all sections
    document.getElementById('userPromptSection').style.display = 'none';
    document.querySelectorAll('.section-block').forEach(el => el.style.display = 'none');
    const analysisSection = document.getElementById('promptAnalysisSection');
    if (analysisSection) analysisSection.style.display = 'none';
    document.getElementById('expressionViewSection').style.display = 'none';
    document.getElementById('rawResponseSection').style.display = 'none';
}

function showError(message) {
    errorMessage.textContent = message;
    errorSection.style.display = 'block';
    errorSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
    errorSection.style.display = 'none';
}

function setLoading(loading) {
    submitBtn.disabled = loading;
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    if (loading) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline';
    } else {
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
}
