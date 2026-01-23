import json
from google import genai
from models import ConnectionConfig
from typing import Dict, Any
import database

def refactor_sql(config: ConnectionConfig, sql_query: str, api_key: str, model_name: str) -> Dict[str, Any]:
    """
    Uses AI to refactor SQL for better performance and readability.
    Focuses on SARGability and N+1 detection.
    """
    if not api_key or not model_name:
        return {"error": "AI configuration missing (API Key or Model)."}

    # 1. Get Schema Context (Optional but helpful for N+1 and JOIN optimization)
    schema_context = database.get_schema_context(config)
    
    # 2. Construct Prompt
    prompt = f"""
    You are a Senior Database Engineer and SQL Performance Expert.
    
    Task: Refactor the provided SQL query to improve performance, readability, and maintainability.
    
    Focus Areas:
    1. SARGability (Search ARGument ABLE): 
       - Detect predicates that break index usage (e.g., WHERE YEAR(date) = 2023, WHERE column + 1 > 10, WHERE SUBSTRING(name, 1, 3) = 'ABC').
       - Rewrite them into index-friendly versions (e.g., WHERE date >= '2023-01-01' AND date < '2024-01-01').
    2. N+1 Detection & Optimization:
       - Identify subqueries that could be more efficiently handled as JOINs or Window Functions.
       - Look for patterns where a query is likely executed in a loop (though here we only see one query, we can spot inefficient subqueries).
    3. General "Clean Code" for SQL:
       - Use meaningful aliases.
       - Consistent casing (prefer UPPERCASE for keywords).
       - Proper indentation.
       - Remove redundant code or logic.
    4. Dialect Specifics: {config.type}
    
    Database Schema Context:
    {schema_context}
    
    Input SQL:
    ```sql
    {sql_query}
    ```
    
    Output Format (JSON):
    {{
        "refactored_sql": "The improved SQL query",
        "explanation": "A concise explanation of the changes made, specifically highlighting SARGability fixes or N+1 optimizations.",
        "changes": [
            {{
                "type": "SARGability" | "N+1" | "Readability" | "Other",
                "description": "Short description of the specific change"
            }}
        ]
    }}
    
    Return ONLY the JSON object. No markdown formatting (like ```json).
    """

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model_name,
            contents=prompt
        )
        
        # Clean up response text if it contains markdown code blocks
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        
        result = json.loads(text.strip())
        return result
    except Exception as e:
        return {"error": f"Refactoring failed: {str(e)}"}
