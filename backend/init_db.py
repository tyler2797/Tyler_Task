"""
Script d'initialisation de la base de données MongoDB
Crée les indexes nécessaires pour optimiser les performances
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')


async def init_database():
    """Initialise les indexes de la base de données"""
    
    # Connexion MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("🔧 Initialisation de la base de données...")
    
    try:
        # Créer l'index unique sur le champ 'id'
        await db.reminders.create_index([("id", 1)], unique=True)
        print("✅ Index créé sur le champ 'id' (unique)")
        
        # Créer l'index sur le champ 'datetime_iso' pour le tri
        await db.reminders.create_index([("datetime_iso", 1)])
        print("✅ Index créé sur le champ 'datetime_iso'")
        
        # Créer un index composé pour les requêtes filtrées par status + triées par date
        await db.reminders.create_index([("status", 1), ("datetime_iso", 1)])
        print("✅ Index composé créé sur 'status' + 'datetime_iso'")
        
        # Lister tous les indexes
        indexes = await db.reminders.list_indexes().to_list(None)
        print("\n📋 Indexes actuels sur la collection 'reminders':")
        for idx in indexes:
            print(f"   - {idx['name']}: {idx['key']}")
        
        print("\n✅ Initialisation terminée avec succès!")
        
    except Exception as e:
        print(f"❌ Erreur lors de l'initialisation: {str(e)}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(init_database())
