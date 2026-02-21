import json
from google import genai
from models import ConnectionConfig
from typing import Dict, Any
import database

def refactor_sql(config: ConnectionConfig, sql_query: str, api_key: str, model_name: str, task: str = "refactor") -> Dict[str, Any]:
    """
    Uses AI to refactor, explain, optimize, or format SQL.
    """
    if not api_key or not model_name:
        return {"error": "AI configuration missing (API Key or Model)."}

    # 1. Get Schema Context
    schema_context = database.get_schema_context(config)
    
    # 2. Define Task-specific prompts
    task_prompts = {
        "refactor": """
            Refactor the provided SQL query to improve performance, readability, and maintainability.
            Focus on SARGability and N+1 detection. Rewrite predicates to be index-friendly.
        """,
        "explain": """
            Provide a clear, high-level explanation of what this SQL query does.
            Explain the logic, the tables involved, and the intended outcome in plain English.
        """,
        "optimize": """
            Focus purely on performance optimization. Suggest the most efficient way to write this query
            for the target database dialect. Look for opportunities to use Window Functions, CTEs,
            or better JOIN strategies.
        """,
        "format": """
            Beautify and standardize the SQL query. Use consistent casing (UPPERCASE for keywords),
            proper indentation, and clean aliasing. Do not change the logic.
        """,
        "fix": """
            Identify and fix any syntax errors or logical bugs in the SQL query.
            Ensure it is valid for the target database dialect.
        """,
        "convert": f"""
            Ensure the SQL query is fully compatible and optimized for {config.type}.
            Translate any dialect-specific functions or syntax from other SQL flavors.
        """
    }

    selected_task_prompt = task_prompts.get(task, task_prompts["refactor"])

    # 3. Construct Full Prompt
    prompt = f"""
    You are a Senior Database Engineer and SQL Expert.
    
    Task: {task.upper()}
    Goal: {selected_task_prompt}
    
    Target Database Dialect: {config.type}
    
    Database Schema Context:
    {schema_context}
    
    Input SQL:
    ```sql
    {sql_query}
    ```
    
    Output Format (JSON):
    {{
        "refactored_sql": "The updated SQL query (if applicable, otherwise the original)",
        "explanation": "A concise explanation of the changes made or a description of the query logic.",
        "changes": [
            {{
                "type": "Performance" | "Readability" | "Logic" | "Style" | "Other",
                "description": "Short description of the specific change"
            }}
        ]
    }}
    
    Return ONLY the JSON object. No markdown formatting.
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
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        
        result = json.loads(text.strip())
        return result
    except Exception as e:
        return {"error": f"AI Action failed: {str(e)}"}
