// Configuration
const API_ENDPOINT = '/.netlify/functions/generate-expression';

// DOM elements
const promptInput = document.getElementById('promptInput');
const submitBtn = document.getElementById('submitBtn');
const responseSection = document.getElementById('responseSection');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');

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
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt }),
        });

        if (!response.ok) {
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                // If response isn't JSON, try to get text
                try {
                    const errorText = await response.text();
                    if (errorText) errorMessage = errorText;
                } catch (e2) {
                    // Keep default error message
                }
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        showResponse(data);
    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'Failed to generate expression. Please try again.');
    } finally {
        setLoading(false);
    }
}

function showResponse(data) {
    // Display user's prompt
    if (currentPrompt) {
        document.getElementById('userPromptContent').textContent = currentPrompt;
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


