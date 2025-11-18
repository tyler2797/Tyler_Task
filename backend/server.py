from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
from emergentintegrations.llm.chat import LlmChat, UserMessage
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Database initialization
async def init_db_indexes():
    """Initialize database indexes on startup"""
    try:
        # Create unique index on 'id' field
        await db.reminders.create_index([("id", 1)], unique=True)
        # Create index on 'datetime_iso' for sorting
        await db.reminders.create_index([("datetime_iso", 1)])
        # Create compound index for filtered queries
        await db.reminders.create_index([("status", 1), ("datetime_iso", 1)])
        logger.info("✅ Database indexes initialized successfully")
    except Exception as e:
        logger.warning(f"Index creation warning (may already exist): {str(e)}")


# Helper function to convert ObjectId
def str_object_id(obj):
    if isinstance(obj, dict):
        if '_id' in obj and isinstance(obj['_id'], ObjectId):
            obj['_id'] = str(obj['_id'])
    return obj


# Define Models
class ParseMessageRequest(BaseModel):
    message: str

class ParsedReminder(BaseModel):
    title: str
    description: Optional[str] = None
    date: Optional[str] = None  # Format: YYYY-MM-DD
    time: Optional[str] = None  # Format: HH:MM
    datetime_iso: Optional[str] = None  # Full ISO datetime
    timezone: str = "Europe/Paris"
    is_ambiguous: bool = False
    ambiguity_reason: Optional[str] = None

class ReminderCreate(BaseModel):
    title: str
    description: Optional[str] = None
    datetime_iso: str  # ISO format datetime
    timezone: str = "Europe/Paris"
    recurrence: Optional[str] = None

class Reminder(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    datetime_iso: str
    timezone: str
    status: str = "scheduled"  # scheduled, completed, cancelled
    recurrence: Optional[str] = None
    created_at: str
    updated_at: str

class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    datetime_iso: Optional[str] = None
    status: Optional[str] = None
    recurrence: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[dict]] = []

class ChatResponse(BaseModel):
    response: str
    type: str  # "question", "suggestion", "confirmation", "multiple_tasks"
    suggestions: Optional[List[str]] = None
    parsed_reminders: Optional[List[ParsedReminder]] = None


# NLU Parsing Service
async def parse_natural_language_message(message: str) -> ParsedReminder:
    """Parse a natural language message to extract reminder information"""
    try:
        llm_key = os.environ.get('EMERGENT_LLM_KEY')
        if not llm_key:
            raise ValueError("EMERGENT_LLM_KEY not found in environment")
        
        from datetime import datetime, timedelta
        import json
        
        today = datetime.now()
        today_str = today.strftime("%A %d %B %Y")  # e.g., "lundi 18 novembre 2024"
        now_str = today.strftime("%H:%M")
        
        system_prompt = f"""Tu es un assistant spécialisé dans l'extraction d'informations de rappels depuis des messages en français.

CONTEXTE TEMPOREL:
- Aujourd'hui: {today_str}
- Heure actuelle: {now_str}
- Année: {today.year}

INSTRUCTIONS:
1. Extrais le titre du rappel (l'action principale)
2. Extrais la description si présente (détails optionnels)
3. Convertis TOUTES les dates relatives en dates absolues (format: YYYY-MM-DD)
   - "demain" = {(today + timedelta(days=1)).strftime("%Y-%m-%d")}
   - "dans 2 jours" = {(today + timedelta(days=2)).strftime("%Y-%m-%d")}
4. Si l'heure est spécifiée, extrais-la au format HH:MM
5. Si l'heure n'est PAS spécifiée, marque is_ambiguous=true
6. Crée datetime_iso en combinant date et heure au format ISO 8601 avec timezone +01:00

RÉPONDS UNIQUEMENT AVEC UN OBJET JSON, SANS TEXTE AVANT OU APRÈS:"""
        
        user_prompt = f"""Message: "{message}"

Retourne UN SEUL objet JSON avec cette structure exacte:
{{
  "title": "action principale",
  "description": null,
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "datetime_iso": "YYYY-MM-DDTHH:MM:00+01:00",
  "timezone": "Europe/Paris",
  "is_ambiguous": false,
  "ambiguity_reason": null
}}"""
        
        chat = LlmChat(
            api_key=llm_key,
            session_id=str(uuid.uuid4()),
            system_message=system_prompt
        ).with_model("openai", "gpt-4o-mini")
        
        user_message = UserMessage(text=user_prompt)
        response = await chat.send_message(user_message)
        
        logger.info(f"LLM Raw Response: {response}")
        
        # Parse the JSON response
        import re
        
        response_text = str(response).strip()
        
        # Remove markdown code blocks
        response_text = re.sub(r'```json\s*', '', response_text)
        response_text = re.sub(r'```\s*', '', response_text)
        response_text = response_text.strip()
        
        # Try to find JSON object in the response
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, re.DOTALL)
        if json_match:
            response_text = json_match.group(0)
        
        logger.info(f"Cleaned JSON: {response_text}")
        
        parsed_data = json.loads(response_text)
        return ParsedReminder(**parsed_data)
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {str(e)}, Response: {response_text}")
        raise HTTPException(status_code=500, detail=f"Erreur de décodage JSON: {str(e)}")
    except Exception as e:
        logger.error(f"Error parsing message: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors du parsing: {str(e)}")


# Intelligent Chatbot Service for ADHD users
async def intelligent_chat_assistant(message: str, history: List[dict] = []) -> ChatResponse:
    """Assistant IA conversationnel pour aider les utilisateurs TDAH"""
    try:
        llm_key = os.environ.get('EMERGENT_LLM_KEY')
        if not llm_key:
            raise ValueError("EMERGENT_LLM_KEY not found in environment")
        
        from datetime import datetime, timedelta
        import json
        import re
        
        today = datetime.now()
        today_str = today.strftime("%A %d %B %Y")
        now_str = today.strftime("%H:%M")
        
        # Detect multiple tasks first
        task_indicators = ['et', ',', 'puis', 'après', 'ensuite', 'aussi']
        has_multiple_tasks = any(indicator in message.lower() for indicator in task_indicators)
        
        if has_multiple_tasks and len(message.split()) > 5:
            # Split tasks
            tasks = re.split(r',|\set\s|\spuis\s|\saprès\s|\sensuite\s|\saussi\s', message)
            tasks = [t.strip() for t in tasks if len(t.strip()) > 3]
            
            if len(tasks) > 1:
                task_list = "\n".join([f"{i+1}. {task}" for i, task in enumerate(tasks)])
                return ChatResponse(
                    response=f"🎯 J'ai détecté {len(tasks)} tâches différentes! Parfait pour ne rien oublier:\n\n{task_list}\n\nVoudrais-tu que je crée un rappel séparé pour chaque tâche? (Spoiler: ton futur toi va adorer! 😊)",
                    type="multiple_tasks",
                    suggestions=["Oui, sépare-les!", "Non, juste la première", "Combine tout ensemble"],
                    parsed_reminders=None
                )
        
        # Check if message is missing date or time
        has_date = any(word in message.lower() for word in ['demain', 'aujourd\'hui', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']) or re.search(r'\d{1,2}[/-]\d{1,2}|\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)', message.lower())
        has_time = re.search(r'\d{1,2}h\d{0,2}|\d{1,2}:\d{2}', message)
        
        if not has_date or not has_time:
            missing = []
            if not has_date:
                missing.append("la date")
            if not has_time:
                missing.append("l'heure")
            
            missing_str = " et ".join(missing)
            
            # Generate smart suggestions
            suggestions = []
            if not has_date:
                tomorrow = (today + timedelta(days=1)).strftime("%A %d %B")
                suggestions = [
                    f"Demain ({tomorrow})",
                    f"Aujourd'hui ({today_str})",
                    "Dans 2 jours"
                ]
            elif not has_time:
                suggestions = ["9h00 (matin)", "14h00 (après-midi)", "18h00 (soir)"]
            
            return ChatResponse(
                response=f"Hmm, il me manque {missing_str} pour ce rappel! 🤔\nQuand veux-tu que je te rappelle ça?",
                type="question",
                suggestions=suggestions,
                parsed_reminders=None
            )
        
        # If we have all info, parse and confirm
        parsed = await parse_natural_language_message(message)
        
        encouragements = [
            "Super! Je m'en occupe! 🚀",
            "Top! Ton futur toi va te remercier! 😊",
            "Excellent! Une tâche de moins à oublier! ✨",
            "Génial! Je garde ça en mémoire pour toi! 💪"
        ]
        import random
        
        return ChatResponse(
            response=f"{random.choice(encouragements)}\n\nRappel: {parsed.title}\nDate: {parsed.date} à {parsed.time}",
            type="confirmation",
            suggestions=["Confirmer", "Modifier l'heure", "Annuler"],
            parsed_reminders=[parsed]
        )
        
    except Exception as e:
        logger.error(f"Chat assistant error: {str(e)}")
        return ChatResponse(
            response="Oups, mon cerveau TDAH a bug! 😅 Peux-tu reformuler ta demande?",
            type="question",
            suggestions=["Aide-moi", "Réessayer", "Commencer simple"],
            parsed_reminders=None
        )


# API Routes
@api_router.get("/")
async def root():
    return {"message": "API de rappels par message IA"}


@api_router.post("/parse-message", response_model=ParsedReminder)
async def parse_message(request: ParseMessageRequest):
    """Parse un message en langage naturel pour extraire les informations du rappel"""
    return await parse_natural_language_message(request.message)


@api_router.post("/chat", response_model=ChatResponse)
async def chat_assistant(request: ChatRequest):
    """Assistant IA conversationnel intelligent pour les utilisateurs TDAH"""
    return await intelligent_chat_assistant(request.message, request.conversation_history)


@api_router.post("/reminders", response_model=Reminder)
async def create_reminder(reminder: ReminderCreate):
    """Créer un nouveau rappel"""
    try:
        reminder_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        reminder_doc = {
            "id": reminder_id,
            "title": reminder.title,
            "description": reminder.description,
            "datetime_iso": reminder.datetime_iso,
            "timezone": reminder.timezone,
            "status": "scheduled",
            "recurrence": reminder.recurrence,
            "created_at": now,
            "updated_at": now
        }
        
        await db.reminders.insert_one(reminder_doc)
        
        # Remove MongoDB _id before returning
        reminder_doc.pop('_id', None)
        return Reminder(**reminder_doc)
        
    except Exception as e:
        logger.error(f"Error creating reminder: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création: {str(e)}")


@api_router.get("/reminders", response_model=List[Reminder])
async def get_reminders(status: Optional[str] = None):
    """Récupérer la liste des rappels"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        reminders = await db.reminders.find(query).sort("datetime_iso", 1).to_list(1000)
        
        # Remove MongoDB _id from all reminders
        for reminder in reminders:
            reminder.pop('_id', None)
        
        return [Reminder(**reminder) for reminder in reminders]
        
    except Exception as e:
        logger.error(f"Error fetching reminders: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération: {str(e)}")


@api_router.get("/reminders/{reminder_id}", response_model=Reminder)
async def get_reminder(reminder_id: str):
    """Récupérer un rappel spécifique"""
    try:
        reminder = await db.reminders.find_one({"id": reminder_id})
        
        if not reminder:
            raise HTTPException(status_code=404, detail="Rappel non trouvé")
        
        reminder.pop('_id', None)
        return Reminder(**reminder)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching reminder: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération: {str(e)}")


@api_router.patch("/reminders/{reminder_id}", response_model=Reminder)
async def update_reminder(reminder_id: str, update: ReminderUpdate):
    """Mettre à jour un rappel"""
    try:
        reminder = await db.reminders.find_one({"id": reminder_id})
        
        if not reminder:
            raise HTTPException(status_code=404, detail="Rappel non trouvé")
        
        # Prepare update data
        update_data = update.dict(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        # Update in database
        await db.reminders.update_one(
            {"id": reminder_id},
            {"$set": update_data}
        )
        
        # Fetch updated reminder
        updated_reminder = await db.reminders.find_one({"id": reminder_id})
        updated_reminder.pop('_id', None)
        
        return Reminder(**updated_reminder)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating reminder: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour: {str(e)}")


@api_router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str):
    """Supprimer un rappel"""
    try:
        result = await db.reminders.delete_one({"id": reminder_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Rappel non trouvé")
        
        return {"message": "Rappel supprimé avec succès", "id": reminder_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting reminder: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression: {str(e)}")


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_db():
    """Initialize database indexes on startup"""
    await init_db_indexes()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
