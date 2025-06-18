/**
 * Système de logs centralisé pour WebRTC
 * 
 * 🎯 CONFIGURATION : Changez LOG_LEVEL ici pour tout le projet
 * 
 * Niveaux de logs :
 * - MINIMAL : Grandes étapes seulement (connexion, déconnexion, nb personnes)
 * - NORMAL : On sait ce qui se passe (ICE candidates, SDP, arrivées/départs)  
 * - VERBOSE : Debug complet (tous les détails techniques)
 */

// Types de logs
export enum LogLevel {
    MINIMAL = 0,  // Grandes étapes seulement
    NORMAL = 1,   // On sait ce qui se passe  
    VERBOSE = 2   // Debug complet
}

export enum LogCategory {
    CONNECTION = 'Connection',
    NEGOTIATION = 'Negotiation',
    SIGNALING = 'Signaling',
    ICE = 'ICE',
    DATACHANNEL = 'DataChannel',
    ROLE = 'Role',
    ERROR = 'Error'
}

// 🎯 CONFIGURATION GLOBALE - Changez ici pour tout le projet
const LOG_LEVEL: LogLevel = LogLevel.MINIMAL; // ← Changez ici : MINIMAL, NORMAL, ou VERBOSE

// Configuration centralisée
class WebRTCLogger {
    private currentLevel: LogLevel;
    private enabledCategories: Set<LogCategory> = new Set();

    constructor() {
        // Utiliser le niveau défini dans le code au lieu de l'environnement
        this.currentLevel = LOG_LEVEL;
        this.updateCategories();
    }

    // Méthodes publiques pour changer le niveau
    setLevel(level: LogLevel) {
        this.currentLevel = level;
        this.updateCategories();
        this.info(LogCategory.CONNECTION, `📊 Log level changed to: ${LogLevel[level]}`);
    }

    enableDebugMode() {
        this.setLevel(LogLevel.VERBOSE);
    }

    enableMinimalMode() {
        this.setLevel(LogLevel.MINIMAL);
    }

    private updateCategories() {
        switch (this.currentLevel) {
            case LogLevel.MINIMAL:
                // MINIMAL : Grandes étapes + erreurs (connexion, déconnexion, nombre personnes)
                this.enabledCategories = new Set([
                    LogCategory.CONNECTION, // Connexions principales
                    LogCategory.ERROR       // Erreurs
                ]);
                break;
            case LogLevel.NORMAL:
                // NORMAL : On sait ce qui se passe (ICE, SDP, arrivées...)
                this.enabledCategories = new Set([
                    LogCategory.CONNECTION,
                    LogCategory.NEGOTIATION,
                    LogCategory.SIGNALING,
                    LogCategory.DATACHANNEL,
                    LogCategory.ERROR
                ]);
                break;
            case LogLevel.VERBOSE:
                // VERBOSE : Debug complet - tout
                this.enabledCategories = new Set(Object.values(LogCategory));
                break;
        }
    }

    // 🔴 MINIMAL : Grandes étapes (connexion, déconnexion, participants)
    minimal(category: LogCategory, message: string, ...args: any[]) {
        if (this.currentLevel >= LogLevel.MINIMAL && this.enabledCategories.has(category)) {
            console.log(`🔴 [${category}] ${message}`, ...args);
        }
    }

    // 🟡 NORMAL : Ce qui se passe (ICE, SDP, arrivées...)
    info(category: LogCategory, message: string, ...args: any[]) {
        if (this.currentLevel >= LogLevel.NORMAL && this.enabledCategories.has(category)) {
            console.log(`🟡 [${category}] ${message}`, ...args);
        }
    }

    // 🟢 SUCCESS : Réussites importantes
    success(category: LogCategory, message: string, ...args: any[]) {
        if (this.currentLevel >= LogLevel.NORMAL && this.enabledCategories.has(category)) {
            console.log(`🟢 [${category}] ${message}`, ...args);
        }
    }

    // 🔵 VERBOSE : Debug complet
    debug(category: LogCategory, message: string, ...args: any[]) {
        if (this.currentLevel >= LogLevel.VERBOSE && this.enabledCategories.has(category)) {
            console.log(`🔵 [${category}] ${message}`, ...args);
        }
    }

    // ⚠️ WARNINGS : Toujours en NORMAL+
    warn(category: LogCategory, message: string, ...args: any[]) {
        if (this.currentLevel >= LogLevel.NORMAL && this.enabledCategories.has(category)) {
            console.warn(`⚠️ [${category}] ${message}`, ...args);
        }
    }

    // ❌ ERRORS : Toujours affichées
    error(category: LogCategory, message: string, ...args: any[]) {
        console.error(`❌ [${category}] ${message}`, ...args);
    }

    // Logs spéciaux pour les diagnostics (toujours avec préfixe 🩺)
    diagnostic(message: string, ...args: any[]) {
        if (this.currentLevel >= LogLevel.VERBOSE) {
            console.log(`🩺 ${message}`, ...args);
        }
    }

    private shouldLog(category: LogCategory, requiredLevel: LogLevel): boolean {
        return this.currentLevel >= requiredLevel && this.enabledCategories.has(category);
    }

    // Méthode pour obtenir l'état actuel
    getStatus() {
        return {
            level: LogLevel[this.currentLevel],
            enabledCategories: Array.from(this.enabledCategories)
        };
    }
}

// Instance globale
export const logger = new WebRTCLogger();

// Export des méthodes pour usage facile
export const {
    minimal: logMinimal,
    info: logInfo,
    success: logSuccess,
    debug: logDebug,
    warn: logWarn,
    error: logError,
    diagnostic: logDiagnostic
} = logger;

// Fonction pour activer/désactiver facilement le debug depuis la console
(window as any).webrtcDebug = {
    enable: () => logger.enableDebugMode(),
    disable: () => logger.enableMinimalMode(),
    normal: () => logger.setLevel(LogLevel.NORMAL),
    status: () => logger.getStatus()
};

// Log d'initialisation
logger.info(LogCategory.CONNECTION, `WebRTC Logger initialized - Level: ${LogLevel[logger.getStatus().level as any]}`);
