# app.py (Flask Backend)
from flask import Flask, request, jsonify, Response,Blueprint
from flask_cors import CORS
import requests
import json

# -------------------- Flask App --------------------
chat_bp = Blueprint("chat", __name__)

# -------------------- Chat Endpoints --------------------

@chat_bp.route('/chat', methods=['POST'])
def chat_with_llama3():
    """
    API endpoint to chat with Llama3 model (non-streaming)
    """
    try:
        data = request.json
        user_message = data.get('message')
        conversation_history = data.get('history', [])

        if not user_message:
            return jsonify({"error": "Message is required"}), 400

        # Append the user's message
        conversation_history.append({"role": "user", "content": user_message})

        # Build prompt
        prompt_text = ""
        for msg in conversation_history:
            prompt_text += f"{msg['role']}: {msg['content']}\n"
        prompt_text += "assistant:"

        # Ollama API call
        ollama_api_url = "http://localhost:11434/api/generate"
        payload = {
            "model": "llama3",
            "prompt": prompt_text,
            "stream": False
        }

        response = requests.post(ollama_api_url, json=payload)
        response.raise_for_status()

        response_data = response.json()
        assistant_reply = response_data.get('response', '')

        # Append assistant reply to history
        conversation_history.append({"role": "assistant", "content": assistant_reply})

        return jsonify({
            "reply": assistant_reply,
            "history": conversation_history
        })

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Ollama API error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


@chat_bp.route('/chat/stream', methods=['POST'])
def chat_with_llama3_stream():
    """
    Stream response from Llama3 model
    """
    try:
        data = request.json
        user_message = data.get('message')
        conversation_history = data.get('history', [])

        if not user_message:
            return jsonify({"error": "Message is required"}), 400

        # Append the user's message
        conversation_history.append({"role": "user", "content": user_message})

        # Build prompt
        prompt_text = ""
        for msg in conversation_history:
            prompt_text += f"{msg['role']}: {msg['content']}\n"
        prompt_text += "assistant:"

        ollama_api_url = "http://localhost:11434/api/generate"
        payload = {
            "model": "llama3",
            "prompt": prompt_text,
            "stream": True
        }

        def generate():
            try:
                response = requests.post(ollama_api_url, json=payload, stream=True)
                response.raise_for_status()

                full_response = ""
                for line in response.iter_lines():
                    if line:
                        json_data = json.loads(line)
                        content = json_data.get('response', '')
                        full_response += content
                        yield f"data: {json.dumps({'chunk': content})}\n\n"

                # Send final full response
                conversation_history.append({"role": "assistant", "content": full_response})
                yield f"data: {json.dumps({'done': True, 'full_response': full_response, 'history': conversation_history})}\n\n"

            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return Response(generate(), mimetype='text/event-stream')

    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


