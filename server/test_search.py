import os
import sys
import json
import numpy as np
from pymongo import MongoClient
from dotenv import load_dotenv
from google import genai
from google.genai import types
from sklearn.metrics.pairwise import cosine_similarity

# Load environment
load_dotenv(dotenv_path="C:/Users/ARNAV PANDEY/OneDrive/Desktop/chat-gallery/galleria/server/.env")
MONGODB_URI = os.getenv("MONGODB_URI")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

client = MongoClient(MONGODB_URI)
db = client["test"]
genai_client = genai.Client(api_key=GOOGLE_API_KEY)

def get_text_embedding(text):
    print(f"Generating embedding for query: '{text}'...")
    result = genai_client.models.embed_content(
        model='gemini-embedding-2-preview',
        contents=text
    )
    return result.embeddings[0].values

def run_diagnostic():
    # 1. Find User (matching the one with 47 images)
    search_email = "arnav21pandey07@gmail.com"
    user = db.users.find_one({"email": search_email})
    if not user:
        print(f"User with email '{search_email}' not found.")
        return
    
    user_id = user["_id"]
    print(f"\n--- USER DIAGNOSTIC: {user['name']} ---")
    print(f"ID: {user_id}")
    print(f"Email: {user.get('email')}")
    print(f"Face Embeddings: {len(user.get('faceEmbeddings', [])) if user.get('faceEmbeddings') else 0}")
    
    # 2. Check Images for this User
    images = list(db.images.find({"userId": user_id}))
    print(f"Total AI-Indexed Images (in 'Image' collection): {len(images)}")
    
    if not images:
        print("No indexed images found for this user in 'Image' collection. Did they 'Import'?")
        return

    # 3. Perform Test Search
    query_text = "a chimney emitting black smoke"
    query_vector = np.array(get_text_embedding(query_text)).reshape(1, -1)
    
    print(f"\nSearching for: '{query_text}'")
    scored_results = []
    for img in images:
        img_vector = np.array(img["multimodalEmbedding"]).reshape(1, -1)
        score = cosine_similarity(query_vector, img_vector)[0][0]
        scored_results.append({
            "url": img["url"][:60],
            "score": float(score)
        })
    
    scored_results.sort(key=lambda x: x["score"], reverse=True)
    
    print("\n--- SEARCH RESULTS (Top 5) ---")
    for i, res in enumerate(scored_results[:5]):
        print(f"{i+1}. Score: {res['score']:.4f} | URL: {res['url']}...")

if __name__ == "__main__":
    run_diagnostic()
    client.close()
