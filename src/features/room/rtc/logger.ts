/**
 * Système de logs centralisé pour WebRTC
 * 
 * Niveaux de logs :
 * - MINIMAL : Seulement les événements critiques et erreurs
 * - NORMAL : Logs essentiels pour suivre le flux (par défaut)
 * - VERBOSE : Tous les détails techniques (mode debug)
 */

// Types de logs
export enum LogLevel {
    MINIMAL = 0,  // Seulement erreurs et événements critiques
    NORMAL = 1,   // Logs essentiels (par défaut)
    VERBOSE = 2   // Tous les détails (debug)
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

// Configuration centralisée
class WebRTCLogger {
    private currentLevel: LogLevel;
    private enabledCategories: Set<LogCategory>;

    constructor() {
        // Niveau par défaut basé sur l'environnement
        this.currentLevel = import.meta.env.DEV ? LogLevel.NORMAL : LogLevel.MINIMAL;
        
        // Catégories activées par défaut en mode NORMAL
        this.enabledCategories = new Set([
            LogCategory.CONNECTION,
            LogCategory.NEGOTIATION,
            LogCategory.DATACHANNEL,
            LogCategory.ERROR
        ]);
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
                this.enabledCategories = new Set([LogCategory.ERROR]);
                break;
            case LogLevel.NORMAL:
                this.enabledCategories = new Set([
                    LogCategory.CONNECTION,
                    LogCategory.NEGOTIATION,
                    LogCategory.DATACHANNEL,
                    LogCategory.ERROR
                ]);
                break;
            case LogLevel.VERBOSE:
                this.enabledCategories = new Set(Object.values(LogCategory));
                break;
        }
    }

    // Méthodes de logging par niveau d'importance
    error(category: LogCategory, message: string, ...args: any[]) {
        // Les erreurs sont toujours affichées
        console.error(`❌ [${category}] ${message}`, ...args);
    }

    warn(category: LogCategory, message: string, ...args: any[]) {
        if (this.shouldLog(category, LogLevel.NORMAL)) {
            console.warn(`⚠️ [${category}] ${message}`, ...args);
        }
    }

    info(category: LogCategory, message: string, ...args: any[]) {
        if (this.shouldLog(category, LogLevel.NORMAL)) {
            console.log(`ℹ️ [${category}] ${message}`, ...args);
        }
    }

    success(category: LogCategory, message: string, ...args: any[]) {
        if (this.shouldLog(category, LogLevel.NORMAL)) {
            console.log(`✅ [${category}] ${message}`, ...args);
        }
    }

    debug(category: LogCategory, message: string, ...args: any[]) {
        if (this.shouldLog(category, LogLevel.VERBOSE)) {
            console.log(`🔧 [${category}] ${message}`, ...args);
        }
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

// Export des méthodes pour un usage simple
export const {
    error: logError,
    warn: logWarn,
    info: logInfo,
    success: logSuccess,
    debug: logDebug,
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
