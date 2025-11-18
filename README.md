# 🔔 Application de Rappels par Message IA

Une application mobile minimaliste qui transforme des messages en langage naturel en rappels programmés avec notifications.

## 📱 Fonctionnalités

- **Parsing NLU en français** : Analysez des messages comme "le 20 novembre rendez-vous chez le médecin à 9h"
- **Extraction intelligente** : Titre, date, heure, description, détection d'ambiguïtés
- **Confirmations claires** : Modal de confirmation avant création du rappel
- **Gestion complète** : Créer, lister, marquer comme complété, supprimer
- **Notifications push** : Alertes à l'heure exacte du rappel
- **Interface minimaliste** : Design épuré, anti-stress, orienté mobile-first

## 🛠 Stack Technique

### Frontend
- **Expo** + React Native (TypeScript)
- **Zustand** pour la gestion d'état
- **expo-notifications** pour les notifications push locales
- **date-fns** pour la manipulation de dates
- **axios** pour les appels API
- **@expo/vector-icons** (Ionicons)

### Backend
- **FastAPI** (Python)
- **MongoDB** (via motor AsyncIO)
- **emergentintegrations** pour l'intégration LLM
- **OpenAI GPT-4o-mini** via EMERGENT_LLM_KEY

## 🚀 Installation & Démarrage

### Prérequis
- Node.js 18+
- Python 3.11+
- MongoDB
- Yarn

### 1. Backend

```bash
cd backend
pip install -r requirements.txt

# Configurer .env
echo 'MONGO_URL="mongodb://localhost:27017"' > .env
echo 'DB_NAME="test_database"' >> .env
echo 'EMERGENT_LLM_KEY=votre-clé-ici' >> .env

# Démarrer
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 2. Frontend

```bash
cd frontend
yarn install

# Configurer .env
echo 'EXPO_PUBLIC_BACKEND_URL=http://localhost:8001' > .env

# Démarrer
yarn start
```

### 3. Expo Go

Scannez le QR code avec l'application Expo Go (iOS/Android).

## 📐 Architecture

### Modèle de données (Reminder)

```typescript
{
  id: string;              // UUID
  title: string;           // "Rendez-vous chez le médecin"
  description: string | null;
  datetime_iso: string;    // "2025-11-20T09:00:00+01:00"
  timezone: string;        // "Europe/Paris"
  status: 'scheduled' | 'completed' | 'cancelled';
  recurrence: string | null;
  created_at: string;
  updated_at: string;
}
```

### Flux principal

1. **User** tape un message : "demain 15h appeler Paul"
2. **Frontend** envoie à POST `/api/parse-message`
3. **Backend** utilise GPT-4o-mini pour parser → structure JSON
4. **Frontend** affiche modal de confirmation
5. **User** confirme → POST `/api/reminders`
6. **Backend** sauvegarde dans MongoDB
7. **Frontend** programme notification locale
8. **Notification** déclenchée à l'heure exacte

## 🔌 API Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/` | Health check |
| POST | `/api/parse-message` | Parser un message en langage naturel |
| POST | `/api/reminders` | Créer un rappel |
| GET | `/api/reminders` | Lister les rappels (filtrable par status) |
| GET | `/api/reminders/{id}` | Récupérer un rappel |
| PATCH | `/api/reminders/{id}` | Mettre à jour un rappel |
| DELETE | `/api/reminders/{id}` | Supprimer un rappel |

## 📝 Exemples de messages supportés

✅ **Dates complètes avec heure**
- "le 20 novembre rendez-vous chez le médecin à 9h"
- "25 décembre 2025 à 10h00 appel important"

✅ **Dates relatives**
- "demain 15h appeler Paul"
- "dans 2 jours réunion à 14h"
- "lundi prochain 9h dentiste"

✅ **Avec description**
- "vendredi 18h dîner avec Marie au restaurant italien"

⚠️ **Cas ambigus** (demande confirmation)
- "20 novembre rendez-vous médecin" (pas d'heure spécifiée)
- "appeler Paul" (pas de date)

## 🎨 Design

- **Vibe** : Minimal, chaleureux, anti-stress
- **Couleurs** : 
  - Primaire: `#3b82f6` (bleu)
  - Succès: `#10b981` (vert)
  - Alerte: `#f59e0b` (orange)
  - Erreur: `#ef4444` (rouge)
- **Typographie** : System fonts (San Francisco / Roboto)
- **Composants** : Cards arrondis (16px), shadows subtiles

## 🔐 Sécurité & Confidentialité

- Clé LLM stockée côté backend (jamais exposée au client)
- Données de rappels privées (pas de partage)
- Notifications locales (pas de serveur tiers)
- Conformité RGPD : droit à l'oubli via DELETE

## 📱 Permissions requises

### iOS
- Notifications (demandées au premier lancement)

### Android
- `android.permission.SCHEDULE_EXACT_ALARM`
- `android.permission.POST_NOTIFICATIONS`
- `android.permission.USE_EXACT_ALARM`

## 🧪 Tests

### Backend
```bash
# Test du parsing
curl -X POST http://localhost:8001/api/parse-message \
  -H "Content-Type: application/json" \
  -d '{"message":"demain 15h appeler Paul"}'

# Test création rappel
curl -X POST http://localhost:8001/api/reminders \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test",
    "description": null,
    "datetime_iso": "2025-12-25T10:00:00+01:00",
    "timezone": "Europe/Paris",
    "recurrence": null
  }'
```

## 📦 Structure du projet

```
/app
├── backend/
│   ├── server.py          # API FastAPI + parsing NLU
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── app/
│   │   ├── index.tsx      # Écran principal
│   │   └── _layout.tsx    # Layout root
│   ├── components/
│   │   ├── ReminderCard.tsx
│   │   └── ConfirmationModal.tsx
│   ├── services/
│   │   └── api.ts         # Client API
│   ├── store/
│   │   └── remindersStore.ts  # State Zustand
│   ├── types/
│   │   └── index.ts       # Interfaces TypeScript
│   └── package.json
└── README.md
```

## 🚧 Limitations actuelles (MVP)

- Récurrence non implémentée (prévu pour v2)
- Édition de rappel par message naturel (prévu pour v2)
- Synchronisation multi-device (prévu pour v2)
- Support d'autres langues que français (prévu pour v2)

## 🌟 Roadmap future

- [ ] Récurrence ("tous les lundis", "chaque mois le 5")
- [ ] Édition via message naturel
- [ ] Intégration calendrier natif
- [ ] Synchronisation cloud multi-device
- [ ] Support multilingue (EN, ES)
- [ ] Commande vocale
- [ ] Catégories de rappels
- [ ] Statistiques d'utilisation

## 📄 Licence

MIT

## 👨‍💻 Auteur

Créé avec ❤️ par l'équipe Emergent
