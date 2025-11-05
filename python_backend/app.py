"""
Python backend service for advanced prompt analysis.
This service provides more robust NLP-based prompt analysis for Cameo expressions.
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import re
from typing import Dict, List, Tuple
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for GitHub Pages frontend

# SysML relationship patterns with better matching
SYSMML_RELATIONSHIPS = [
    {'keywords': ['satisfy', 'satisfies', 'satisfied by'], 'metachain': 'self.satisfy', 'description': 'satisfy relationship (Block to Requirements)'},
    {'keywords': ['derive', 'derives', 'derived from'], 'metachain': 'self.derive', 'description': 'derive relationship'},
    {'keywords': ['allocate', 'allocates', 'allocated to', 'allocation'], 'metachain': 'self.allocate', 'description': 'allocate relationship'},
    {'keywords': ['trace', 'traces', 'traced to', 'tracing'], 'metachain': 'self.trace', 'description': 'trace relationship'},
    {'keywords': ['verify', 'verifies', 'verified by'], 'metachain': 'self.verify', 'description': 'verify relationship'},
    {'keywords': ['refine', 'refines', 'refined by'], 'metachain': 'self.refine', 'description': 'refine relationship'},
    {'keywords': ['clientdependency', 'client dependency', 'depends on'], 'metachain': 'self.clientDependency', 'description': 'client dependency relationship'},
    {'keywords': ['dependency', 'depends', 'dependent on'], 'metachain': 'self.clientDependency', 'description': 'dependency relationship'},
    {'keywords': ['owned element', 'owned elements', 'owns', 'owned by'], 'metachain': 'self.ownedElement', 'description': 'owned elements'},
    {'keywords': ['type', 'typed', 'type of'], 'metachain': 'self.type', 'description': 'type relationship'},
    {'keywords': ['input', 'input pin', 'input pins'], 'metachain': 'self.input', 'description': 'input pins'},
    {'keywords': ['output', 'output pin', 'output pins'], 'metachain': 'self.output', 'description': 'output pins'},
]

# Nested/recursive patterns
NESTED_PATTERNS = [
    r'\bnested\b',
    r'\brecursive\b',
    r'\brecursively\b',
    r'\bnested within\b',
    r'\bcontained in\b',
    r'\bhierarchical\b',
    r'\bparent\b',
    r'\bchild\b',
    r'\bchildren\b',
    r'\bcontained\b',
]

# Stereotype patterns
STEREOTYPE_PATTERNS = [
    r'\bstereotype\b',
    r'\bstereotyped\b',
    r'«[^»]+»',
    r'&lt;&lt;[^&gt;]+&gt;&gt;',
    r'\bapplied stereotype\b',
]

# Property/attribute patterns
PROPERTY_PATTERNS = [
    r'\bproperty\b',
    r'\battribute\b',
    r'\bhas property\b',
    r'\bhas attribute\b',
    r'\bnamed\b',
    r'\bname is\b',
    r'\bname equals\b',
    r'\bproperty named\b',
]

# Collection patterns
COLLECTION_PATTERNS = [
    r'\ball\b',
    r'\bevery\b',
    r'\bcollection\b',
    r'\beach\b',
    r'\bany\b',
]

# Type checking patterns
TYPE_CHECK_PATTERNS = [
    r'\btype\b',
    r'\binstance of\b',
    r'\bis a\b',
    r'\bkind of\b',
    r'\bclassifier\b',
]

def analyze_prompt(prompt: str, context: str = None, context_specific: Dict = None) -> Dict:
    """
    Advanced prompt analysis using Python's regex and pattern matching.
    Returns structured analysis with detected patterns and guidance.
    """
    lower_prompt = prompt.lower()
    detected_patterns = []
    guidance = []
    detected_relations = []

    # Analyze nested/recursive patterns
    nested_matches = [pattern for pattern in NESTED_PATTERNS if re.search(pattern, lower_prompt, re.IGNORECASE)]
    if nested_matches:
        detected_patterns.append('impliedRelation')
        guidance.append(
            "- DETECTED: Nested/recursive logic detected. Use ImpliedRelation icon/operation for navigating through implied relationships.\n"
            "  - Icon: \"ImpliedRelation\" or \"impliedRelation\"\n"
            "  - Type: \"impliedRelation\" or \"operation\"\n"
            "  - This is for navigating through implicit model relationships (e.g., containment, ownership)"
        )

    # Analyze SysML relationships with better fuzzy matching
    for rel in SYSMML_RELATIONSHIPS:
        for keyword in rel['keywords']:
            # Use word boundaries for better matching
            pattern = r'\b' + re.escape(keyword.lower()) + r'\b'
            if re.search(pattern, lower_prompt, re.IGNORECASE):
                detected_relations.append({
                    'keyword': keyword,
                    'metachain': rel['metachain'],
                    'description': rel['description']
                })
                break
    
    if detected_relations:
        detected_patterns.append('metachain')
        metachain_examples = '\n'.join([
            f"  - \"{rel['keyword']}\" → metachain: \"{rel['metachain']}\" ({rel['description']})"
            for rel in detected_relations
        ])
        guidance.append(
            f"- DETECTED: SysML relationship patterns found. Use metachain navigation for these relationships:\n"
            f"{metachain_examples}\n"
            f"  - Icon: \"metachain\"\n"
            f"  - Type: \"metachain\"\n"
            f"  - Use metachain navigation for explicit SysML/UML relationships"
        )

    # Analyze stereotype patterns
    stereotype_matches = [pattern for pattern in STEREOTYPE_PATTERNS if re.search(pattern, lower_prompt, re.IGNORECASE)]
    if stereotype_matches:
        detected_patterns.append('stereotypeFilter')
        guidance.append(
            "- DETECTED: Stereotype filtering needed. Use filter operation with stereotype check:\n"
            "  - Filter condition: appliedStereotype->exists(s | s.name = '[STEREOTYPE NAME]')\n"
            "  - Icon: \"Filter\"\n"
            "  - Type: \"Filter\"\n"
            "  - Use this to filter elements by their applied stereotypes"
        )

    # Analyze property/attribute patterns
    property_matches = [pattern for pattern in PROPERTY_PATTERNS if re.search(pattern, lower_prompt, re.IGNORECASE)]
    if property_matches:
        detected_patterns.append('propertyFilter')
        guidance.append(
            "- DETECTED: Property/attribute filtering needed. Use filter operation with property check:\n"
            "  - Filter condition: ->select(e | e.name = '[PROPERTY NAME]') or ->select(e | e.[PROPERTY_NAME] = '[VALUE]')\n"
            "  - Icon: \"Filter\"\n"
            "  - Type: \"Filter\"\n"
            "  - Use this to filter elements by their properties or attributes"
        )

    # Analyze collection patterns
    collection_matches = [pattern for pattern in COLLECTION_PATTERNS if re.search(pattern, lower_prompt, re.IGNORECASE)]
    if collection_matches:
        detected_patterns.append('collection')
        guidance.append(
            "- DETECTED: Collection operation needed. Use collect, select, or exists operations:\n"
            "  - collect: Transform each element in a collection\n"
            "  - select: Filter elements from a collection\n"
            "  - exists: Check if any element in collection matches condition"
        )

    # Analyze type checking (but exclude if it's about type relationship)
    if not re.search(r'\btype relationship\b', lower_prompt, re.IGNORECASE):
        type_matches = [pattern for pattern in TYPE_CHECK_PATTERNS if re.search(pattern, lower_prompt, re.IGNORECASE)]
        if type_matches:
            detected_patterns.append('typeTest')
            guidance.append(
                "- DETECTED: Type checking needed. Use type test operation:\n"
                "  - Icon: \"TypeTest\" or \"typeTest\"\n"
                "  - Type: \"typeTest\" or \"operation\"\n"
                "  - Use this to check if an element is an instance of a specific type or classifier"
            )

    # Analyze filter/condition patterns
    filter_keywords = ['filter', 'where', 'that', 'which', 'when', 'if']
    filter_matches = [kw for kw in filter_keywords if re.search(r'\b' + re.escape(kw) + r'\b', lower_prompt, re.IGNORECASE)]
    if filter_matches:
        detected_patterns.append('filter')
        guidance.append(
            "- DETECTED: Filtering/conditioning needed. Use filter operation:\n"
            "  - Icon: \"Filter\"\n"
            "  - Type: \"Filter\"\n"
            "  - Use this to narrow down collections based on conditions"
        )

    # Combine all guidance
    full_guidance = ''
    if guidance:
        full_guidance = (
            "Based on the user's prompt, the following Cameo operations should be used:\n\n" +
            "\n\n".join(guidance) +
            "\n\nIMPORTANT: When generating the expressionView JSON, use the icons and types specified above based on the detected patterns."
        )

    return {
        'patterns': detected_patterns,
        'guidance': full_guidance,
        'detectedRelations': detected_relations
    }

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'cameo-prompt-analyzer'})

@app.route('/analyze', methods=['POST'])
def analyze():
    """
    Analyze a prompt and return structured analysis.
    Expected JSON body:
    {
        "prompt": "user's prompt text",
        "context": "scope-criteria|derived-property|custom-column|legend",
        "contextSpecific": {
            "inputType": "package|element",
            "rowType": "Block|Part|...",
            "elementType": "Block|Part|..."
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'prompt' not in data:
            return jsonify({'error': 'Prompt is required'}), 400
        
        prompt = data.get('prompt', '')
        context = data.get('context', '')
        context_specific = data.get('contextSpecific', {})
        
        if not prompt or not prompt.strip():
            return jsonify({'error': 'Prompt cannot be empty'}), 400
        
        # Perform analysis
        analysis = analyze_prompt(prompt, context, context_specific)
        
        return jsonify({
            'success': True,
            'analysis': analysis
        })
    
    except Exception as e:
        return jsonify({
            'error': str(e),
            'message': 'Failed to analyze prompt'
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=os.environ.get('DEBUG', 'False').lower() == 'true')

