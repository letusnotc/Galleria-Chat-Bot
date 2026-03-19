import os
from pymongo import MongoClient
from dotenv import load_dotenv

# Load env from the server directory
load_dotenv(dotenv_path="C:/Users/ARNAV PANDEY/OneDrive/Desktop/chat-gallery/galleria/server/.env")
uri = os.getenv("MONGODB_URI")

client = MongoClient(uri)
db = client["test"] # Explicitly using 'test' as the default
print(f"Connected to Database: {db.name}")

# List all users
print("\n--- USERS ---")
try:
    users = list(db.users.find({}, {"password": 0}))
    if not users:
        print("No users found.")
    for u in users:
        print(f"User: {u.get('name')} ({u.get('email')}) - ID: {u.get('_id')}")
        print(f"  Face Embeddings: {len(u.get('faceEmbeddings', [])) if u.get('faceEmbeddings') else 0}")
        print(f"  Images in User Doc: {len(u.get('images', [])) if u.get('images') else 0}")
except Exception as e:
    print(f"Error fetching users: {e}")

# List images
print("\n--- IMAGES COLLECTION ---")
try:
    images_col = db.images
    total_images = images_col.count_documents({})
    print(f"Total Images in 'Image' collection: {total_images}")

    if total_images > 0:
        first_images = list(images_col.find().limit(5))
        for img in first_images:
            print(f"Image URL: {img.get('url')[:60]}...")
            print(f"  User ID: {img.get('userId')}")
            print(f"  Has Face: {img.get('hasUserFace')}")
            emb = img.get('multimodalEmbedding')
            print(f"  Embedding: {'Present (Size: ' + str(len(emb)) + ')' if emb else 'Missing'}")
    else:
        print("No images found in the 'Image' collection.")
except Exception as e:
    print(f"Error fetching images: {e}")

client.close()
