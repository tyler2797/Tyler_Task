#!/usr/bin/env python3
"""
Test complet du backend de l'application de rappels par message IA
Tests tous les endpoints API avec différents scénarios
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Configuration
BASE_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://tache-naturelle.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

print(f"Testing backend API at: {API_BASE}")

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.created_reminders = []  # Track created reminders for cleanup
        
    def test_api_root(self):
        """Test de l'endpoint racine de l'API"""
        print("\n=== Test API Root ===")
        try:
            response = self.session.get(f"{API_BASE}/")
            print(f"Status: {response.status_code}")
            print(f"Response: {response.json()}")
            return response.status_code == 200
        except Exception as e:
            print(f"❌ Erreur: {e}")
            return False
    
    def test_parse_message_complete_date(self):
        """Test parsing avec date complète et heure"""
        print("\n=== Test Parse Message - Date complète ===")
        try:
            payload = {"message": "le 20 novembre rendez-vous chez le médecin à 9h"}
            response = self.session.post(f"{API_BASE}/parse-message", json=payload)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
                
                # Vérifications
                assert "title" in data, "Title manquant"
                assert "datetime_iso" in data, "datetime_iso manquant"
                assert "timezone" in data, "timezone manquant"
                assert "is_ambiguous" in data, "is_ambiguous manquant"
                
                print("✅ Parse message avec date complète: OK")
                return True
            else:
                print(f"❌ Erreur HTTP: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Erreur: {e}")
            return False
    
    def test_parse_message_relative_date(self):
        """Test parsing avec date relative"""
        print("\n=== Test Parse Message - Date relative ===")
        try:
            payload = {"message": "demain 15h appeler Paul"}
            response = self.session.post(f"{API_BASE}/parse-message", json=payload)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
                
                # Vérifications
                assert "title" in data, "Title manquant"
                assert "datetime_iso" in data, "datetime_iso manquant"
                assert data["timezone"] == "Europe/Paris", "Timezone incorrect"
                
                print("✅ Parse message avec date relative: OK")
                return True
            else:
                print(f"❌ Erreur HTTP: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Erreur: {e}")
            return False
    
    def test_parse_message_with_description(self):
        """Test parsing avec description détaillée"""
        print("\n=== Test Parse Message - Avec description ===")
        try:
            payload = {"message": "dans 2 jours réunion importante avec l'équipe à 14h"}
            response = self.session.post(f"{API_BASE}/parse-message", json=payload)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
                
                # Vérifications
                assert "title" in data, "Title manquant"
                assert "datetime_iso" in data, "datetime_iso manquant"
                
                print("✅ Parse message avec description: OK")
                return True
            else:
                print(f"❌ Erreur HTTP: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Erreur: {e}")
            return False
    
    def test_parse_message_ambiguous(self):
        """Test parsing cas ambigu (sans heure)"""
        print("\n=== Test Parse Message - Cas ambigu ===")
        try:
            payload = {"message": "20 novembre rendez-vous médecin"}
            response = self.session.post(f"{API_BASE}/parse-message", json=payload)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
                
                # Vérifications
                assert "title" in data, "Title manquant"
                assert "is_ambiguous" in data, "is_ambiguous manquant"
                
                print("✅ Parse message cas ambigu: OK")
                return True
            else:
                print(f"❌ Erreur HTTP: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Erreur: {e}")
            return False
    
    def test_create_reminder(self):
        """Test création d'un rappel"""
        print("\n=== Test Create Reminder ===")
        try:
            # Créer un rappel pour demain à 10h
            tomorrow = datetime.now() + timedelta(days=1)
            datetime_iso = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%S+01:00")
            
            payload = {
                "title": "Test Rappel",
                "description": "Ceci est un test de création de rappel",
                "datetime_iso": datetime_iso,
                "timezone": "Europe/Paris",
                "recurrence": None
            }
            
            response = self.session.post(f"{API_BASE}/reminders", json=payload)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
                
                # Vérifications
                assert "id" in data, "ID manquant"
                assert data["title"] == payload["title"], "Title incorrect"
                assert data["status"] == "scheduled", "Status incorrect"
                assert "created_at" in data, "created_at manquant"
                assert "updated_at" in data, "updated_at manquant"
                
                # Sauvegarder l'ID pour les tests suivants
                self.created_reminders.append(data["id"])
                
                print("✅ Création de rappel: OK")
                return True, data["id"]
            else:
                print(f"❌ Erreur HTTP: {response.status_code}")
                print(f"Response: {response.text}")
                return False, None
                
        except Exception as e:
            print(f"❌ Erreur: {e}")
            return False, None
    
    def test_get_reminders(self):
        """Test récupération de tous les rappels"""
        print("\n=== Test Get All Reminders ===")
        try:
            response = self.session.get(f"{API_BASE}/reminders")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Nombre de rappels: {len(data)}")
                
                if data:
                    print(f"Premier rappel: {json.dumps(data[0], indent=2, ensure_ascii=False)}")
                    
                    # Vérifications sur le premier rappel
                    reminder = data[0]
                    assert "id" in reminder, "ID manquant"
                    assert "title" in reminder, "Title manquant"
                    assert "status" in reminder, "Status manquant"
                    assert "created_at" in reminder, "created_at manquant"
                
                print("✅ Récupération de tous les rappels: OK")
                return True
            else:
                print(f"❌ Erreur HTTP: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Erreur: {e}")
            return False
    
    def test_get_reminders_by_status(self):
        """Test récupération des rappels par status"""
        print("\n=== Test Get Reminders by Status ===")
        try:
            response = self.session.get(f"{API_BASE}/reminders?status=scheduled")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Nombre de rappels 'scheduled': {len(data)}")
                
                # Vérifier que tous les rappels ont le status 'scheduled'
                for reminder in data:
                    assert reminder["status"] == "scheduled", f"Status incorrect: {reminder['status']}"
                
                print("✅ Récupération par status: OK")
                return True
            else:
                print(f"❌ Erreur HTTP: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Erreur: {e}")
            return False
    
    def test_get_reminder_by_id(self, reminder_id):
        """Test récupération d'un rappel spécifique"""
        print(f"\n=== Test Get Reminder by ID: {reminder_id} ===")
        try:
            response = self.session.get(f"{API_BASE}/reminders/{reminder_id}")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
                
                # Vérifications
                assert data["id"] == reminder_id, "ID incorrect"
                assert "title" in data, "Title manquant"
                assert "status" in data, "Status manquant"
                
                print("✅ Récupération par ID: OK")
                return True
            else:
                print(f"❌ Erreur HTTP: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Erreur: {e}")
            return False
    
    def test_get_nonexistent_reminder(self):
        """Test récupération d'un rappel inexistant (doit retourner 404)"""
        print("\n=== Test Get Nonexistent Reminder ===")
        try:
            fake_id = str(uuid.uuid4())
            response = self.session.get(f"{API_BASE}/reminders/{fake_id}")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 404:
                print("✅ Erreur 404 pour rappel inexistant: OK")
                return True
            else:
                print(f"❌ Status attendu: 404, reçu: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Erreur: {e}")
            return False
    
    def test_update_reminder(self, reminder_id):
        """Test mise à jour d'un rappel"""
        print(f"\n=== Test Update Reminder: {reminder_id} ===")
        try:
            payload = {
                "title": "Rappel Modifié",
                "status": "completed"
            }
            
            response = self.session.patch(f"{API_BASE}/reminders/{reminder_id}", json=payload)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
                
                # Vérifications
                assert data["title"] == payload["title"], "Title non mis à jour"
                assert data["status"] == payload["status"], "Status non mis à jour"
                assert "updated_at" in data, "updated_at manquant"
                
                print("✅ Mise à jour de rappel: OK")
                return True
            else:
                print(f"❌ Erreur HTTP: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Erreur: {e}")
            return False
    
    def test_update_nonexistent_reminder(self):
        """Test mise à jour d'un rappel inexistant (doit retourner 404)"""
        print("\n=== Test Update Nonexistent Reminder ===")
        try:
            fake_id = str(uuid.uuid4())
            payload = {"title": "Test"}
            
            response = self.session.patch(f"{API_BASE}/reminders/{fake_id}", json=payload)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 404:
                print("✅ Erreur 404 pour mise à jour rappel inexistant: OK")
                return True
            else:
                print(f"❌ Status attendu: 404, reçu: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Erreur: {e}")
            return False
    
    def test_delete_reminder(self, reminder_id):
        """Test suppression d'un rappel"""
        print(f"\n=== Test Delete Reminder: {reminder_id} ===")
        try:
            response = self.session.delete(f"{API_BASE}/reminders/{reminder_id}")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
                
                # Vérifier que le rappel n'existe plus
                get_response = self.session.get(f"{API_BASE}/reminders/{reminder_id}")
                if get_response.status_code == 404:
                    print("✅ Suppression de rappel: OK")
                    return True
                else:
                    print("❌ Le rappel existe encore après suppression")
                    return False
            else:
                print(f"❌ Erreur HTTP: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Erreur: {e}")
            return False
    
    def test_delete_nonexistent_reminder(self):
        """Test suppression d'un rappel inexistant (doit retourner 404)"""
        print("\n=== Test Delete Nonexistent Reminder ===")
        try:
            fake_id = str(uuid.uuid4())
            response = self.session.delete(f"{API_BASE}/reminders/{fake_id}")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 404:
                print("✅ Erreur 404 pour suppression rappel inexistant: OK")
                return True
            else:
                print(f"❌ Status attendu: 404, reçu: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Erreur: {e}")
            return False
    
    def cleanup(self):
        """Nettoyer les rappels créés pendant les tests"""
        print("\n=== Cleanup ===")
        for reminder_id in self.created_reminders:
            try:
                response = self.session.delete(f"{API_BASE}/reminders/{reminder_id}")
                if response.status_code == 200:
                    print(f"✅ Rappel {reminder_id} supprimé")
                else:
                    print(f"⚠️ Impossible de supprimer {reminder_id}")
            except Exception as e:
                print(f"⚠️ Erreur lors du nettoyage de {reminder_id}: {e}")
    
    def run_all_tests(self):
        """Exécuter tous les tests"""
        print("🚀 Début des tests du backend API")
        print("=" * 50)
        
        results = {}
        
        # Test API root
        results['api_root'] = self.test_api_root()
        
        # Tests de parsing
        results['parse_complete'] = self.test_parse_message_complete_date()
        results['parse_relative'] = self.test_parse_message_relative_date()
        results['parse_description'] = self.test_parse_message_with_description()
        results['parse_ambiguous'] = self.test_parse_message_ambiguous()
        
        # Test création de rappel
        create_success, reminder_id = self.test_create_reminder()
        results['create_reminder'] = create_success
        
        # Tests de récupération
        results['get_all_reminders'] = self.test_get_reminders()
        results['get_reminders_by_status'] = self.test_get_reminders_by_status()
        
        if reminder_id:
            results['get_reminder_by_id'] = self.test_get_reminder_by_id(reminder_id)
            results['update_reminder'] = self.test_update_reminder(reminder_id)
        
        # Tests d'erreur
        results['get_nonexistent'] = self.test_get_nonexistent_reminder()
        results['update_nonexistent'] = self.test_update_nonexistent_reminder()
        results['delete_nonexistent'] = self.test_delete_nonexistent_reminder()
        
        # Test de suppression (à la fin)
        if reminder_id:
            results['delete_reminder'] = self.test_delete_reminder(reminder_id)
        
        # Nettoyage
        self.cleanup()
        
        # Résumé des résultats
        print("\n" + "=" * 50)
        print("📊 RÉSUMÉ DES TESTS")
        print("=" * 50)
        
        passed = 0
        total = len(results)
        
        for test_name, success in results.items():
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"{test_name:25} {status}")
            if success:
                passed += 1
        
        print(f"\nRésultat: {passed}/{total} tests réussis")
        
        if passed == total:
            print("🎉 Tous les tests sont passés!")
            return True
        else:
            print("⚠️ Certains tests ont échoué")
            return False


if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)