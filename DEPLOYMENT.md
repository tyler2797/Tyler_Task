# 🚀 Guide de Déploiement - Tyler Task

Ce guide explique comment déployer l'application Tyler Task sur le cloud pour qu'elle soit accessible 24h/24.

## 📋 Prérequis

- Un compte GitHub (pour connecter les services)
- Un compte MongoDB Atlas (gratuit)
- Un compte Render (gratuit ou 7$/mois)
- Un compte Vercel (gratuit)

---

## 1️⃣ Déployer la Base de Données (MongoDB Atlas)

### Étapes :

1. **Créer un compte** sur [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)

2. **Créer un cluster gratuit** :
   - Provider : **AWS**
   - Région : **Europe (Paris) `eu-west-3`** ou **Europe (Frankfurt) `eu-central-1`**
   - Tier : **M0 (Free)**

3. **Configurer l'accès réseau** :
   - Dans "Network Access", cliquer sur "Add IP Address"
   - Sélectionner "Allow Access from Anywhere" (0.0.0.0/0)
   - Confirmer

4. **Créer un utilisateur de base de données** :
   - Dans "Database Access", cliquer sur "Add New Database User"
   - Username : `tyler_admin` (ou autre)
   - Password : Générer un mot de passe fort (le copier !)
   - Rôle : "Atlas Admin"

5. **Récupérer l'URL de connexion** :
   - Cliquer sur "Connect" sur votre cluster
   - Choisir "Connect your application"
   - Copier l'URL (format : `mongodb+srv://username:password@cluster.mongodb.net/...`)
   - **Remplacer** `<password>` par le mot de passe créé à l'étape 4

✅ **Garder cette URL**, elle sera utilisée dans Render.

---

## 2️⃣ Déployer le Backend (Render)

### Étapes :

1. **Pousser le code sur GitHub** (si ce n'est pas déjà fait) :
   ```bash
   cd /home/tyler/Bureau/Antigravity/Tyler_Task
   git add .
   git commit -m "Préparation pour déploiement"
   git push origin main
   ```

2. **Créer un compte** sur [Render](https://render.com)

3. **Créer un nouveau Web Service** :
   - Cliquer sur "New +" → "Web Service"
   - Connecter votre dépôt GitHub `Tyler_Task`
   - Sélectionner le dossier `backend`

4. **Configuration du service** :
   - **Name** : `tyler-task-backend`
   - **Region** : `Frankfurt (EU Central)`
   - **Branch** : `main`
   - **Root Directory** : `backend`
   - **Runtime** : `Python 3`
   - **Build Command** : `pip install -r requirements.txt`
   - **Start Command** : `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Plan** : Free (ou Starter à 7$/mois pour éviter la mise en veille)

5. **Ajouter les variables d'environnement** :
   - Cliquer sur "Environment" dans le menu
   - Ajouter :
     - `MONGO_URL` = L'URL MongoDB Atlas copiée à l'étape 1
     - `DB_NAME` = `tyler_task_db`
     - `OPENAI_API_KEY` = Votre clé OpenAI (`sk-proj-...`)
     - `EMERGENT_LLM_KEY` = `dummy_key_for_compatibility`

6. **Déployer** :
   - Cliquer sur "Create Web Service"
   - Attendre 3-5 minutes que le déploiement se termine

✅ **Copier l'URL du backend** (ex: `https://tyler-task-backend.onrender.com`)

---

## 3️⃣ Déployer le Frontend (Vercel)

### Étapes :

1. **Créer un compte** sur [Vercel](https://vercel.com)

2. **Importer le projet** :
   - Cliquer sur "Add New..." → "Project"
   - Importer depuis GitHub : `Tyler_Task`
   - Sélectionner le repository

3. **Configuration du projet** :
   - **Framework Preset** : Other
   - **Root Directory** : `frontend`
   - **Build Command** : `npm run build`
   - **Output Directory** : `dist`

4. **Ajouter la variable d'environnement** :
   - Dans "Environment Variables" :
     - `EXPO_PUBLIC_BACKEND_URL` = L'URL du backend Render (ex: `https://tyler-task-backend.onrender.com`)

5. **Déployer** :
   - Cliquer sur "Deploy"
   - Attendre 2-3 minutes

✅ **Votre app est en ligne !** (ex: `https://tyler-task.vercel.app`)

---

## 🔄 Mises à jour automatiques

Désormais, chaque fois que tu pousses du code sur GitHub :
- **Render** redéploie automatiquement le backend
- **Vercel** redéploie automatiquement le frontend

---

## 🧪 Tester l'application déployée

1. Ouvrir l'URL Vercel dans ton navigateur
2. Créer un rappel : "demain 14h réunion importante"
3. Vérifier qu'il apparaît dans la liste

---

## 💰 Coûts

- **MongoDB Atlas** : Gratuit (M0 - 512 Mo)
- **Render** : 
  - Free tier : Gratuit (se met en veille après 15 min d'inactivité)
  - Starter : 7$/mois (toujours actif)
- **Vercel** : Gratuit pour projets personnels

**Total minimum** : 0€/mois (avec mise en veille du backend)  
**Total recommandé** : 7$/mois (backend toujours actif)

---

## 🆘 Dépannage

### Le backend ne démarre pas sur Render
- Vérifier les logs dans Render Dashboard
- S'assurer que toutes les variables d'environnement sont définies
- Vérifier que `MONGO_URL` est correcte (avec le bon mot de passe)

### Le frontend ne se connecte pas au backend
- Vérifier que `EXPO_PUBLIC_BACKEND_URL` pointe vers l'URL Render
- Vérifier les logs du navigateur (F12 → Console)
- Tester l'API backend directement : `https://your-backend.onrender.com/api/`

### Erreur MongoDB "Authentication failed"
- Vérifier que le mot de passe dans `MONGO_URL` est correct
- S'assurer que l'IP 0.0.0.0/0 est autorisée dans MongoDB Atlas

---

## 📞 Support

Si tu rencontres des problèmes, vérifie :
1. Les logs Render (Backend)
2. Les logs Vercel (Frontend)
3. La console du navigateur (F12)
