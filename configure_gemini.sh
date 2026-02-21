#!/bin/bash

# Script to configure Gemini API key and model for SqlForge testing and development

CONFIG_FILE=".gemini_config.json"

echo "=== SqlForge Gemini Configuration ==="
echo "This will set up your Gemini API credentials for both the backend and tests."
echo ""

# Prompt for API Key
read -p "Enter your Gemini API Key: " api_key
if [ -z "$api_key" ]; then
    echo "Error: API Key cannot be empty."
    exit 1
fi

# Prompt for Model
read -p "Enter Gemini Model (default: gemini-1.5-flash): " model
if [ -z "$model" ]; then
    model="gemini-1.5-flash"
fi

# Save to JSON
cat > "$CONFIG_FILE" <<EOF
{
  "gemini_api_key": "$api_key",
  "gemini_model": "$model"
}
EOF

echo ""
echo "Configuration saved to $CONFIG_FILE"
echo "You can now run tests that require AI features."
chmod 600 "$CONFIG_FILE" # Secure the file
