import os
import sys
import json
import base64
import requests
import tempfile
import numpy as np
import traceback
from PIL import Image as PILImage
from google import genai
from google.genai import types
from deepface import DeepFace

# Set model for DeepFace
DF_MODEL = "Facenet512"

def log(msg):
    # Print to stderr so Node.js can capture it separately from JSON stdout
    print(f"[AI-PY] {msg}", file=sys.stderr)

# -----------------------------
# GOOGLE GENAI CLIENT
# -----------------------------
load_dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
from dotenv import load_dotenv
load_dotenv(dotenv_path=load_dotenv_path)

api_key = os.getenv("GOOGLE_API_KEY")
client = None
if api_key:
    client = genai.Client(api_key=api_key)
else:
    log("WARNING: GOOGLE_API_KEY not found in .env")

# -----------------------------
# HELPERS
# -----------------------------
def get_local_path(img_path):
    if img_path.startswith("http"):
        try:
            log(f"Downloading image: {img_path[:50]}...")
            resp = requests.get(img_path, stream=True, timeout=10)
            resp.raise_for_status()
            suffix = ".jpg"
            if ".png" in img_path.lower(): suffix = ".png"
            
            fd, temp_path = tempfile.mkstemp(suffix=suffix)
            os.close(fd)
            
            with open(temp_path, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            return temp_path, True
        except Exception as e:
            log(f"Download failed: {e}")
            return None, False
    return img_path, False

def get_face_embeddings(img_path):
    local_path, is_temp = get_local_path(img_path)
    if not local_path: return []
    try:
        log(f"Extracting faces from: {local_path}")
        results = DeepFace.represent(
            img_path=local_path,
            model_name=DF_MODEL,
            enforce_detection=False,
            detector_backend="opencv"
        )
        log(f"Found {len(results)} face(s)")
        
        # Convert all to list for JSON serialization
        embs = []
        for res in results:
            e = res["embedding"]
            if hasattr(e, "tolist"):
                embs.append(e.tolist())
            else:
                embs.append(list(e))
        return embs
    except Exception as e:
        log(f"Face extraction error: {e}")
        return []
    finally:
        if is_temp and os.path.exists(local_path): os.remove(local_path)

def get_face_embeddings_batch(paths):
    log(f"Processing batch of {len(paths)} face images...")
    all_embs = []
    for i, p in enumerate(paths):
        log(f"Batch item {i+1}/{len(paths)}")
        embs = get_face_embeddings(p)
        all_embs.extend(embs)
    log(f"Batch complete. Total embeddings: {len(all_embs)}")
    return all_embs

def get_multimodal_embedding(img_path):
    if not client: return None
    local_path, is_temp = get_local_path(img_path)
    if not local_path: return None
    try:
        log(f"Multimodal embedding: {local_path}")
        with open(local_path, 'rb') as f:
            image_bytes = f.read()

        mime_type = 'image/png' if local_path.lower().endswith('.png') else 'image/jpeg'
        result = client.models.embed_content(
            model='gemini-embedding-2-preview',
            contents=[types.Content(parts=[types.Part.from_bytes(data=image_bytes, mime_type=mime_type)])]
        )
        return result.embeddings[0].values
    except Exception as e:
        log(f"Multimodal embedding error: {e}")
        return None
    finally:
        if is_temp and os.path.exists(local_path): os.remove(local_path)

def get_text_embedding(query):
    if not client: return None
    try:
        log(f"Text embedding: '{query}'")
        res = client.models.embed_content(model='gemini-embedding-2-preview', contents=query)
        return res.embeddings[0].values
    except Exception as e:
        log(f"Text embedding error: {e}")
        return None

def detect_intent(query):
    if not client: return "general"
    try:
        log(f"Intent detection: '{query}'")
        prompt = (
            "Categorize the image search query as 'personal' or 'general'.\n\n"
            "- 'personal': The user is specifically asking to find photos where THEIR OWN FACE is present or THEY ARE PHYSICALLY IN THE PHOTO.\n"
            "  Examples: 'me at the beach', 'photos of me', 'when was I at the office', 'where am I in this gallery'.\n\n"
            "- 'general': The user is asking for objects, scenes, animals, or documents THEY OWN but are NOT necessarily present in.\n"
            "  Examples: 'my QR code', 'my car', 'show me a temple', 'my cats', 'my bank statement'.\n\n"
            "Strict Rule: Use 'personal' ONLY if the query refers to the user's physical presence/face. Otherwise, use 'general'.\n"
            "Respond ONLY with 'personal' or 'general'."
        )
        response = client.models.generate_content(model="gemini-2.5-flash", contents=f"{prompt}\nQuery: {query}")
        intent = response.text.strip().lower()
        log(f"Intent detected: {intent}")
        return "personal" if "personal" in intent else "general"
    except Exception as e:
        log(f"Intent error: {e}")
        return "general"

def verify_face(user_embeddings, target_img_path):
    local_path, is_temp = get_local_path(target_img_path)
    if not local_path: return False
    try:
        log(f"Verifying face match in: {local_path}")
        target_embeddings = get_face_embeddings(local_path)
        if not target_embeddings or not user_embeddings: return False
        
        for u_emb in user_embeddings:
            u_emb = np.array(u_emb)
            for t_emb in target_embeddings:
                t_emb = np.array(t_emb)
                similarity = np.dot(u_emb, t_emb) / (np.linalg.norm(u_emb) * np.linalg.norm(t_emb))
                if similarity > 0.7:
                    log(f"MATCH (sim: {similarity:.2f})")
                    return True
        return False
    except Exception as e:
        log(f"Verify error: {e}")
        return False
    finally:
        if is_temp and os.path.exists(local_path): os.remove(local_path)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No action"}))
        return

    action = sys.argv[1]
    
    # Read params from stdin (standard for our Node.js bridge)
    params = {}
    if not sys.stdin.isatty():
        try:
            input_data = sys.stdin.read()
            if input_data:
                params = json.loads(input_data)
        except Exception as e:
            log(f"Error reading stdin: {e}")
    
    # Fallback to argv[2] for manual CLI tests
    if not params and len(sys.argv) > 2:
        try:
            params = json.loads(sys.argv[2])
        except:
            pass
    
    log(f"Action: {action} | Params keys: {list(params.keys())}")

    try:
        if action == "face_embeddings":
            print(json.dumps({"embeddings": get_face_embeddings(params.get("path"))}))
        elif action == "face_embeddings_batch":
            print(json.dumps({"embeddings": get_face_embeddings_batch(params.get("paths", []))}))
        elif action == "multimodal_embedding":
            print(json.dumps({"embedding": get_multimodal_embedding(params.get("path"))}))
        elif action == "text_embedding":
            print(json.dumps({"embedding": get_text_embedding(params.get("query"))}))
        elif action == "detect_intent":
            print(json.dumps({"intent": detect_intent(params.get("query"))}))
        elif action == "ingest_batch":
            user_embs = params.get("user_embeddings", [])
            images = params.get("images", [])
            results = []
            for img in images:
                emb = get_multimodal_embedding(img["url"])
                is_match = verify_face(user_embs, img["url"]) if (emb and user_embs) else False
                results.append({"url": img["url"], "embedding": emb, "is_match": is_match})
            print(json.dumps({"results": results}))
        else:
            print(json.dumps({"error": "Unknown action"}))
    except Exception as e:
        log(f"MAIN ERROR: {e}")
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
