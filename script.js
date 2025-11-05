// Configuration
const API_ENDPOINT = '/.netlify/functions/generate-expression';

// DOM elements
const promptInput = document.getElementById('promptInput');
const submitBtn = document.getElementById('submitBtn');
const responseSection = document.getElementById('responseSection');
const responseContent = document.getElementById('responseContent');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');
const copyBtn = document.getElementById('copyBtn');

// Submit handler
submitBtn.addEventListener('click', handleSubmit);
promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        handleSubmit();
    }
});

// Copy handler
copyBtn.addEventListener('click', copyResponse);

async function handleSubmit() {
    const prompt = promptInput.value.trim();
    
    if (!prompt) {
        showError('Please enter a prompt');
        return;
    }

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
            const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
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
        'uaf.capability': '🎯',
        'note': '📝',
        'filter': '🔍',
        'elementRef': '🔖',
        'operation': '⚙️',
        'parameter': '📥',
    };
    return iconMap[iconKey] || '📄';
}

function hideResponse() {
    responseSection.style.display = 'none';
    // Hide all sections
    document.querySelectorAll('.section-block').forEach(el => el.style.display = 'none');
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

function copyResponse() {
    // Collect all visible content
    const sections = [];
    
    const intent = document.getElementById('intentContent').textContent;
    if (intent) sections.push(`Intent\n${intent}`);
    
    const startingContext = document.getElementById('startingContextContent').textContent;
    if (startingContext) sections.push(`Starting Context\n${startingContext}`);
    
    const metachain = document.getElementById('metachainContent').textContent;
    if (metachain) sections.push(`Metachain\n${metachain}`);
    
    const filters = document.getElementById('filtersContent').textContent;
    if (filters) sections.push(`Filters\n${filters}`);
    
    const finalExpression = document.getElementById('finalExpressionContent').textContent;
    if (finalExpression) sections.push(`Final Expression Template\n${finalExpression}`);
    
    const notes = document.getElementById('notesContent').textContent;
    if (notes) sections.push(`Notes\n${notes}`);
    
    const text = sections.join('\n\n');
    
    navigator.clipboard.writeText(text).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        showError('Failed to copy to clipboard');
    });
}

