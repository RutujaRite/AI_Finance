"""
Flask integration: Google AI Studio function calling for bank manager search.

This shows how to integrate the BANK_MANAGER_TOOL into the existing /api/chat endpoint
using Google's Generative AI SDK instead of OpenRouter.

Requirements:
    pip install google-generativeai

Environment:
    export GOOGLE_API_KEY="your-google-ai-studio-api-key"
"""

import os
import google.generativeai as genai
from flask import request, jsonify

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")

if not GOOGLE_API_KEY:
    raise RuntimeError("Set GOOGLE_API_KEY environment variable")

genai.configure(api_key=GOOGLE_API_KEY)

from bank_tool import BANK_MANAGER_TOOLS, execute_bank_manager_search


def should_search_bank_manager(message: str) -> bool:
    """Check if the user message should trigger bank manager search."""
    keywords = [
        'bank manager', 'manager details', 'branch manager',
        'bank', 'manager', 'managers', 'branch', 'contact',
        'phone number', 'mobile', 'email', 'location'
    ]
    lower = message.lower()
    return any(k in lower for k in keywords)


def handle_chat_with_google_ai(user_message: str) -> str:
    """Handle chat using Google AI Studio with function calling."""
    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        tools=BANK_MANAGER_TOOLS,
        system_instruction=(
            "You are InCraax AI, a loan assistant for CreditWise AI. "
            "You help users with loan inquiries, EMI calculations, and bank manager searches. "
            "When users ask about bank managers, branches, or contact details, use the search_bank_manager tool. "
            "Provide clear, helpful responses with manager contact details when available."
        )
    )

    chat = model.start_chat()
    response = chat.send_message(user_message)

    # Handle function calling loop
    while True:
        parts = response.candidates[0].content.parts
        if not parts:
            break

        part = parts[0]
        if hasattr(part, 'function_call') and part.function_call:
            function_call = part.function_call
            function_name = function_call.name
            arguments = dict(function_call.args)

            if function_name == "search_bank_manager":
                try:
                    result = execute_bank_manager_search(arguments)
                    response = chat.send_message(
                        genai.protos.Part(
                            function_response=genai.protos.FunctionResponse(
                                name=function_name,
                                response=result
                            )
                        )
                    )
                except Exception as e:
                    response = chat.send_message(
                        f"Error searching bank managers: {str(e)}"
                    )
            else:
                response = chat.send_message("Unknown function")
        else:
            break

    return response.text


# Example Flask route integration
"""
@app.route('/api/chat', methods=['POST'])
def chat_api():
    data = request.get_json() or {}
    message = str(data.get('message') or '').strip()
    
    if not message:
        return jsonify({'success': False, 'error': 'Message is required'}), 400

    try:
        bank_manager_data = None
        bank_manager_query = None

        # Check if this is a bank manager search query
        if should_search_bank_manager(message):
            try:
                reply = handle_chat_with_google_ai(message)
                bank_manager_data = {
                    'query': message,
                    'response': reply
                }
                bank_manager_query = message
            except Exception as e:
                print('Google AI error:', e)
                reply = "I tried to search for bank managers, but the service is unavailable right now."
        else:
            # Handle other types of queries (EMI, general, etc.)
            reply = "I can help you with bank manager searches. Try asking about bank managers, branches, or contact details."

        ai_message = {
            'id': uid(),
            'role': 'ai',
            'content': reply,
            'timestamp': now()
        }
        if bank_manager_data is not None:
            ai_message['bank_manager_data'] = bank_manager_data
        if bank_manager_query is not None:
            ai_message['bank_manager_query'] = bank_manager_query

        return jsonify({
            'success': True,
            'ai_message': ai_message,
            'user_message': {
                'id': uid(),
                'role': 'user',
                'content': message,
                'timestamp': now()
            }
        })
    except Exception as e:
        print('Chat API error:', e)
        return jsonify({'success': False, 'error': 'Chat failed'}), 500
"""
