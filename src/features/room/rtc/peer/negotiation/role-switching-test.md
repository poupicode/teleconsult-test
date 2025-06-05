# 🔍 Test des Role Switches - Guide de Débogage

## 📋 Scénarios de Test

### Scénario 1: Déconnexion du Polite Peer
```
État initial: A (polite), B (impolite)
1. A se déconnecte
2. B reste impolite ✅ (correct)
3. A se reconnecte → A redevient polite ✅ (correct)
```

### Scénario 2: Déconnexion de l'Impolite Peer
```
État initial: A (polite), B (impolite)
1. B se déconnecte
2. A devient impolite ✅ (correct - pour gérer les reconnexions)
3. B se reconnecte → conflit potentiel! ⚠️
```

## 🛠️ Méthodes de Debug Ajoutées

### 1. Diagnostic des Role Switches
```javascript
// Dans la console du navigateur
window.perfectNegotiation.diagnoseRoleSwitching();
```

### 2. Verrouillage Temporaire des Rôles
```javascript
// Verrouiller le rôle pour éviter les switches pendant 30s
window.perfectNegotiation.lockCurrentRole();

// Déverrouiller manuellement
window.perfectNegotiation.unlockRole();
```

### 3. État Détaillé pour Debug
```javascript
// Voir l'état complet pour comprendre les conflits
console.log(window.perfectNegotiation.getDebugRoleState());
```

## 🔧 Améliorations Apportées

### 1. Logique de Role Switch Plus Restrictive
- ✅ Switch uniquement si seul dans la room
- ✅ Validation avant chaque switch
- ✅ Résolution déterministe basée sur l'ordre lexicographique des IDs

### 2. Prévention des Switches Inutiles
- ✅ Verrouillage temporaire des rôles
- ✅ Validation des conflits réels
- ✅ Meilleur logging pour debug

### 3. Résolution de Conflits Améliorée
- ✅ Ordre déterministe basé sur `clientId.sort()`
- ✅ Premier dans l'ordre = impolite
- ✅ Plus stable lors des reconnexions rapides

## 🐛 Comment Tester

1. Ouvrir deux onglets sur la même room
2. Ajouter dans la console de chaque onglet :
```javascript
// Exposer perfectNegotiation pour debug
window.perfectNegotiation = /* référence vers l'instance */;

// Diagnostiquer avant test
window.perfectNegotiation.diagnoseRoleSwitching();
```

3. Tester le scénario problématique :
- Déconnexion/reconnexion rapide du peer polite
- Observer si des role switches inappropriés se produisent

4. Si problème persiste, verrouiller les rôles :
```javascript
window.perfectNegotiation.lockCurrentRole();
```

## 📊 Log Pattern à Surveiller

### Switch Légitime ✅
```
[PerfectNegotiation] Alone in room as polite peer, switching to impolite for reconnection handling
[PerfectNegotiation] 🔄 ROLE SWITCH: polite → impolite
```

### Switch Illégitime ❌ (à éviter)
```
[PerfectNegotiation] Role switch validation: isAlone=false, hasConflict=false
[PerfectNegotiation] Role switch to impolite blocked by validation
```

## 🎯 Solution Définitive

Pour une solution plus robuste, considérez :

1. **Rôles Basés sur l'Ordre d'Arrivée Original** - Garder une trace de qui est arrivé en premier
2. **Heartbeat System** - Détecter les vraies déconnexions vs les reconnexions rapides  
3. **State Persistence** - Sauvegarder l'état des rôles côté serveur
