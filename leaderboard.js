// ============================
// LEADERBOARD SYSTEM (Simplified)
// ============================

const Leaderboard = {
    config: {
        // ЗАМЕНИТЕ НА ВАШ URL Google Apps Script
        apiUrl: 'https://script.google.com/macros/s/AKfycbz7EGk06M2K_kYhZTwfBzmUa5icFHeeu23-g6sfyReMmdivc9E3nQCPL7sZZ0fdlWJU/exec',
        // ЗАМЕНИТЕ НА ВАШ СЕКРЕТНЫЙ КЛЮЧ
        apiKey: 'game_leaderboard_2024_secret_key_123',
        useLocalStorage: true // Фолбэк на localStorage
    },
    
    state: {
        isOnline: false,
        scores: [],
        stats: null
    },
    
    // Инициализация
    init: function() {
        console.log('Инициализация рейтинга...');
        
        // Всегда используем localStorage как запасной вариант
        this.loadLocalScores();
        
        // Пытаемся проверить онлайн-соединение
        this.checkConnection();
        
        return true;
    },
    
    // Проверка соединения (упрощенная)
    checkConnection: async function() {
        try {
            const testUrl = `${this.config.apiUrl}?action=test&apiKey=${this.config.apiKey}`;
            const response = await fetch(testUrl, {
                mode: 'no-cors'
            });
            
            this.state.isOnline = true;
            console.log('✅ Рейтинг онлайн');
            
            // Показываем статус
            this.showStatus('✅ Онлайн-рейтинг доступен');
            
        } catch (error) {
            this.state.isOnline = false;
            console.log('⚠️ Рейтинг оффлайн, используем localStorage');
            this.showStatus('⚠️ Оффлайн-режим');
        }
    },
    
    // Сохранить результат
    saveScore: async function(playerData) {
        console.log('Сохранение результата:', playerData);
        
        // 1. Всегда сохраняем локально
        const localResult = this.saveToLocal(playerData);
        
        // 2. Пытаемся сохранить онлайн
        if (this.state.isOnline) {
            try {
                const onlineResult = await this.saveToOnline(playerData);
                
                if (onlineResult.success) {
                    return {
                        success: true,
                        message: '🏆 Рекорд сохранен в таблице лидеров!',
                        position: onlineResult.position,
                        isOnline: true
                    };
                }
            } catch (error) {
                console.error('Ошибка онлайн-сохранения:', error);
            }
        }
        
        // 3. Возвращаем локальный результат
        return {
            success: true,
            message: '💾 Рекорд сохранен локально (оффлайн)',
            position: localResult.position,
            isOnline: false
        };
    },
    
    // Сохранить онлайн
    saveToOnline: async function(playerData) {
        if (!this.state.isOnline) return null;
        
        try {
            // Формируем URL с параметрами
            const params = new URLSearchParams({
                action: 'saveScore',
                apiKey: this.config.apiKey,
                name: playerData.name.substring(0, 15),
                score: playerData.score,
                rank: playerData.rank || 'AAA',
                budget: playerData.budget || 0,
                atmosphere: playerData.atmosphere || 0,
                quality: playerData.quality || 0,
                timestamp: Date.now(),
                ip: 'github_pages'
            });
            
            const url = `${this.config.apiUrl}?${params.toString()}`;
            console.log('Отправка запроса:', url);
            
            // Используем fetch с mode 'no-cors' для обхода ограничений
            const response = await fetch(url, {
                method: 'GET',
                mode: 'no-cors'
            });
            
            // При mode 'no-cors' мы не можем прочитать ответ, но запрос отправлен
            console.log('Запрос отправлен (no-cors mode)');
            
            // Обновляем кэш
            setTimeout(() => {
                this.loadOnlineScores();
            }, 1000);
            
            return {
                success: true,
                position: 1
            };
            
        } catch (error) {
            console.error('Ошибка сохранения онлайн:', error);
            throw error;
        }
    },
    
    // Сохранить локально
    saveToLocal: function(playerData) {
        const scores = this.getLocalScores();
        
        const entry = {
            ...playerData,
            date: new Date().toLocaleDateString('ru-RU'),
            timestamp: Date.now(),
            source: 'local'
        };
        
        scores.push(entry);
        
        // Сортировка по очкам
        scores.sort((a, b) => b.score - a.score);
        
        // Ограничиваем до 100 записей
        const topScores = scores.slice(0, 100);
        
        // Сохраняем в localStorage
        try {
            localStorage.setItem('project_triage_leaderboard', JSON.stringify(topScores));
            console.log('✅ Рекорд сохранен локально');
        } catch (error) {
            console.error('❌ Ошибка localStorage:', error);
        }
        
        // Находим позицию
        const position = scores.findIndex(s => s.score <= entry.score) + 1;
        
        return {
            success: true,
            position: position || scores.length
        };
    },
    
    // Получить рекорды
    getScores: async function(limit = 100) {
        // Сначала пытаемся загрузить онлайн
        if (this.state.isOnline) {
            try {
                await this.loadOnlineScores();
                
                // Сортируем онлайн-рекорды
                this.state.scores.sort((a, b) => b.score - a.score);
                return this.state.scores.slice(0, limit);
            } catch (error) {
                console.log('Используем локальные рекорды');
            }
        }
        
        // Возвращаем локальные
        return this.getLocalScores().slice(0, limit);
    },
    
    // Загрузить онлайн-рекорды
    loadOnlineScores: async function() {
        if (!this.state.isOnline) return;
        
        try {
            const url = `${this.config.apiUrl}?action=getScores&apiKey=${this.config.apiKey}&limit=100&_=${Date.now()}`;
            const response = await fetch(url);
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.state.scores = data.scores || [];
                    console.log(`Загружено ${this.state.scores.length} онлайн-рекордов`);
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки онлайн-рекордов:', error);
        }
    },
    
    // Загрузить локальные рекорды
    loadLocalScores: function() {
        try {
            const data = localStorage.getItem('project_triage_leaderboard');
            this.state.scores = data ? JSON.parse(data) : [];
            console.log(`Загружено ${this.state.scores.length} локальных рекордов`);
        } catch (error) {
            this.state.scores = [];
        }
    },
    
    // Получить локальные рекорды
    getLocalScores: function() {
        return this.state.scores;
    },
    
    // Загрузить статистику
    loadStats: async function() {
        // Простая статистика из локальных данных
        const scores = this.getLocalScores();
        
        this.state.stats = {
            totalPlayers: scores.length,
            averageScore: scores.length > 0 ? 
                Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length) : 0,
            topScore: scores.length > 0 ? Math.max(...scores.map(s => s.score)) : 0
        };
    },
    
    // Рассчитать очки
    calculateScore: function(gameState, finalRank) {
        let score = 0;
        
        // Базовые очки
        score += Math.round(gameState.budget / 1000); // 1 очко за каждые 1000₽
        score += gameState.atmosphere * 10; // 10 очков за каждый %
        score += gameState.quality * 10; // 10 очков за каждый %
        
        // Множитель ранга
        const multipliers = {
            'AAA': 2.0, 'AAB': 1.8, 'ABA': 1.8, 'BAA': 1.8,
            'BBB': 1.5, 'BBC': 1.3, 'BCB': 1.3, 'CBB': 1.3,
            'CCC': 1.2, 'CCD': 1.1, 'CDC': 1.1, 'DCC': 1.1,
            'DDD': 1.0
        };
        
        score = Math.round(score * (multipliers[finalRank] || 1.0));
        
        // Бонус за завершение всех ситуаций
        if (gameState.currentSituation >= 15) {
            score += 5000;
        }
        
        return score;
    },
    
    // Показать статус
    showStatus: function(message) {
        const statusElement = document.getElementById('leaderboard-status');
        if (!statusElement) return;
        
        statusElement.textContent = message;
        statusElement.className = 'leaderboard-status ' + 
            (this.state.isOnline ? 'status-online' : 'status-offline');
        statusElement.style.display = 'block';
        
        // Автоскрытие через 5 секунд
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 5000);
    },
    
    // Показать уведомление
    showNotification: function(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `leaderboard-notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? 'rgba(0, 212, 138, 0.15)' : 'rgba(255, 210, 0, 0.15)'};
            border: 2px solid ${type === 'success' ? '#00D48A' : '#FFD200'};
            border-radius: 6px;
            font-family: 'Press Start 2P', monospace;
            font-size: 11px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 0 12px ${type === 'success' ? 'rgba(0, 212, 138, 0.5)' : 'rgba(255, 210, 0, 0.5)'};
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