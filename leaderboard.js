// ============================
// LEADERBOARD SYSTEM (GitHub Pages + Google Sheets)
// ============================

const Leaderboard = {
    config: {
        apiUrl: 'https://script.google.com/macros/s/ВАШ_APP_SCRIPT_ID/exec',
        apiKey: 'ВАШ_СЕКРЕТНЫЙ_КЛЮЧ',
        cacheTime: 30000 // 30 секунд
    },
    
    // Состояние
    state: {
        isOnline: false,
        lastUpdate: 0,
        cache: null,
        stats: null
    },
    
    // Инициализация
    init: async function() {
        console.log('Инициализация рейтинга...');
        
        try {
            // Проверяем соединение
            await this.checkConnection();
            
            if (this.state.isOnline) {
                console.log('Рейтинг онлайн, API доступен');
                this.showOnlineStatus();
            } else {
                console.log('Рейтинг оффлайн, используем локальное хранилище');
                this.showOfflineStatus();
            }
            
            // Загружаем статистику
            await this.loadStats();
            
        } catch (error) {
            console.error('Ошибка инициализации рейтинга:', error);
            this.state.isOnline = false;
        }
        
        return this.state.isOnline;
    },
    
    // Проверка соединения
    checkConnection: async function() {
        try {
            const response = await fetch(`${this.config.apiUrl}?action=getStats&apiKey=${this.config.apiKey}`, {
                method: 'GET',
                mode: 'no-cors'
            });
            
            this.state.isOnline = true;
            return true;
        } catch (error) {
            console.log('Оффлайн режим рейтинга');
            this.state.isOnline = false;
            return false;
        }
    },
    
    // Сохранить результат
    saveScore: async function(playerData) {
        // Локальное сохранение
        this.saveToLocal(playerData);
        
        if (!this.state.isOnline) {
            return {
                success: false,
                message: 'Оффлайн. Рекорд сохранен локально',
                position: 0
            };
        }
        
        try {
            const data = {
                action: 'saveScore',
                apiKey: this.config.apiKey,
                ...playerData,
                timestamp: Date.now()
            };
            
            // Отправляем на сервер
            const response = await this.sendRequest('saveScore', data);
            
            if (response && response.success) {
                console.log('Рекорд сохранен онлайн! Позиция:', response.position);
                
                // Обновляем кэш
                this.state.cache = null;
                await this.loadScores();
                
                return {
                    success: true,
                    message: '🏆 Рекорд в таблице лидеров!',
                    position: response.position
                };
            }
        } catch (error) {
            console.error('Ошибка сохранения рекорда:', error);
        }
        
        return {
            success: false,
            message: 'Ошибка сохранения рекорда',
            position: 0
        };
    },
    
    // Получить рекорды
    getScores: async function(limit = 100) {
        // Используем кэш, если он актуален
        if (this.state.cache && Date.now() - this.state.lastUpdate < this.config.cacheTime) {
            return this.state.cache.slice(0, limit);
        }
        
        if (!this.state.isOnline) {
            return this.getLocalScores().slice(0, limit);
        }
        
        try {
            const scores = await this.loadScores(limit);
            this.state.cache = scores;
            this.state.lastUpdate = Date.now();
            return scores;
        } catch (error) {
            console.error('Ошибка загрузки рекордов:', error);
            return this.getLocalScores().slice(0, limit);
        }
    },
    
    // Загрузить рекорды с сервера
    loadScores: async function(limit = 100) {
        if (!this.state.isOnline) return [];
        
        try {
            const url = `${this.config.apiUrl}?action=getScores&apiKey=${this.config.apiKey}&limit=${limit}&_=${Date.now()}`;
            const response = await fetch(url);
            
            if (!response.ok) throw new Error('Network error');
            
            const data = await response.json();
            
            if (data.success) {
                return data.scores || [];
            }
        } catch (error) {
            console.error('Ошибка загрузки рекордов:', error);
            this.state.isOnline = false;
        }
        
        return [];
    },
    
    // Загрузить статистику
    loadStats: async function() {
        if (!this.state.isOnline) {
            const localScores = this.getLocalScores();
            this.state.stats = {
                totalPlayers: localScores.length,
                averageScore: localScores.length > 0 ? 
                    Math.round(localScores.reduce((a, b) => a + b.score, 0) / localScores.length) : 0,
                topScore: localScores.length > 0 ? Math.max(...localScores.map(s => s.score)) : 0
            };
            return;
        }
        
        try {
            const url = `${this.config.apiUrl}?action=getStats&apiKey=${this.config.apiKey}&_=${Date.now()}`;
            const response = await fetch(url);
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.state.stats = data;
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    },
    
    // Локальное хранение
    saveToLocal: function(playerData) {
        const scores = this.getLocalScores();
        scores.push({
            ...playerData,
            timestamp: Date.now(),
            source: 'local'
        });
        
        // Сортировка
        scores.sort((a, b) => b.score - a.score);
        
        // Сохраняем только топ-50
        const topScores = scores.slice(0, 50);
        
        try {
            localStorage.setItem('game_leaderboard_local', JSON.stringify(topScores));
        } catch (error) {
            console.error('Ошибка локального сохранения:', error);
        }
    },
    
    getLocalScores: function() {
        try {
            const data = localStorage.getItem('game_leaderboard_local');
            return data ? JSON.parse(data) : [];
        } catch (error) {
            return [];
        }
    },
    
    clearLocal: function() {
        localStorage.removeItem('game_leaderboard_local');
        this.state.cache = null;
    },
    
    // Отправить запрос
    sendRequest: async function(action, data) {
        if (!this.state.isOnline) return null;
        
        try {
            const formData = new FormData();
            formData.append('action', action);
            formData.append('apiKey', this.config.apiKey);
            formData.append('data', JSON.stringify(data));
            
            const response = await fetch(this.config.apiUrl, {
                method: 'POST',
                body: formData,
                mode: 'cors'
            });
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка запроса:', error);
            return null;
        }
    },
    
    // Рассчитать очки
    calculateScore: function(gameState, finalRank) {
        let score = 0;
        
        // Бюджетные очки
        if (gameState.budget > 800000) score += 1000;
        else if (gameState.budget > 600000) score += 800;
        else if (gameState.budget > 400000) score += 600;
        else if (gameState.budget > 200000) score += 400;
        else if (gameState.budget > 100000) score += 200;
        else score += 100;
        
        // Атмосфера
        score += Math.round(gameState.atmosphere * 10);
        
        // Качество
        score += Math.round(gameState.quality * 10);
        
        // Бонус за ранг
        const rankMultiplier = {
            'AAA': 3.0, 'AAB': 2.8, 'ABA': 2.8, 'BAA': 2.8,
            'BBB': 2.5, 'BBC': 2.3, 'BCB': 2.3, 'CBB': 2.3,
            'CCC': 2.0, 'CCD': 1.8, 'CDC': 1.8, 'DCC': 1.8,
            'DDD': 1.5
        };
        
        score = Math.round(score * (rankMultiplier[finalRank] || 1.5));
        
        // Бонус за завершение всех ситуаций
        if (gameState.currentSituation > 14) {
            score += 1000;
        }
        
        return score;
    },
    
    // Показать статус
    showOnlineStatus: function() {
        this.showNotification('✅ Онлайн-рейтинг доступен', 'online');
    },
    
    showOfflineStatus: function() {
        this.showNotification('⚠️ Оффлайн-режим. Рекорды сохраняются локально', 'offline');
    },
    
    showNotification: function(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `leaderboard-notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'online' ? 'rgba(0, 212, 138, 0.15)' : 'rgba(255, 210, 0, 0.15)'};
            border: 2px solid ${type === 'online' ? '#00D48A' : '#FFD200'};
            border-radius: 6px;
            font-family: 'Press Start 2P', monospace;
            font-size: 11px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 0 12px ${type === 'online' ? 'rgba(0, 212, 138, 0.5)' : 'rgba(255, 210, 0, 0.5)'};
            max-width: 300px;
            text-align: center;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
};